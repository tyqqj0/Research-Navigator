"use client";

import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import * as d3 from 'd3-force';
import { useGraphStore } from '@/features/graph/data-access/graph-store';
import type { PaperSummary } from '../paper-catalog';

interface GraphCanvasProps {
    graphId: string;
    getPaperSummary?: (paperId: string) => PaperSummary | undefined;
    onNodeOpenDetail?: (paperId: string) => void;
    layoutMode?: 'free' | 'timeline';
}

type Pos = { x: number; y: number };

type SimNode = { id: string; x: number; y: number; vx?: number; vy?: number; fx?: number | null; fy?: number | null };

export const GraphCanvas: React.FC<GraphCanvasProps> = ({ graphId, getPaperSummary, onNodeOpenDetail, layoutMode = 'free' }) => {
    const store = useGraphStore();
    const graph = store.getGraphById(graphId);

    // local UI state: node positions and simple pan/zoom (MVP)
    const [nodePos, setNodePos] = useState<Record<string, Pos>>({});
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [drag, setDrag] = useState<{ id: string; offset: Pos } | null>(null);
    const [linking, setLinking] = useState<{ fromId: string; start: Pos; current: Pos } | null>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

    // timeline zoom scale (affects vertical mapping granularity)
    const [timelineScale, setTimelineScale] = useState<number>(1);
    const scaleTargetRef = useRef<number>(1);
    const scaleAnimRafRef = useRef<number | null>(null);
    const scaleCurrentRef = useRef<number>(1);
    const pivotRef = useRef<{ t: number; mouseY: number } | null>(null);

    // physics simulation refs
    const simRef = useRef<d3.Simulation<SimNode, any> | null>(null);
    const simNodesRef = useRef<SimNode[]>([]);
    const rafRef = useRef<number | null>(null);

    // edge context menu / editor state
    const [edgeMenu, setEdgeMenu] = useState<{ edgeId: string; x: number; y: number } | null>(null);
    const [edgeEdit, setEdgeEdit] = useState<{ edgeId: string; relation: string; x: number; y: number } | null>(null);

    // background panning state
    const [panning, setPanning] = useState<{ start: Pos; scrollLeft: number; scrollTop: number } | null>(null);

    // layout constants
    const NODE_HALF_HEIGHT = 22; // approx node half height for anchor
    const LEFT_AXIS_WIDTH = 96; // px, wider to include months/quarters inside axis
    const NODE_START_OFFSET_X = 72; // px after axis

    const nodes = useMemo(() => Object.values(graph?.nodes || {}), [graph]);
    const edges = useMemo(() => Object.values(graph?.edges || {}), [graph]);

    // timeline scale
    const timeline = useMemo(() => {
        const summaries = nodes.map((n) => getPaperSummary?.(n.id)).filter(Boolean) as PaperSummary[];
        let minDate: Date | null = null;
        let maxDate: Date | null = null;
        const parseDate = (s: PaperSummary): Date | null => {
            if (s.publicationDate) {
                const d = new Date(s.publicationDate);
                if (!isNaN(d.getTime())) return d;
            }
            if (s.year) return new Date(s.year, 0, 1);
            return null;
        };
        summaries.forEach(s => {
            const d = parseDate(s);
            if (!d) return;
            if (!minDate || d < minDate) minDate = d;
            if (!maxDate || d > maxDate) maxDate = d;
        });
        if (!minDate || !maxDate) {
            const now = new Date();
            minDate = new Date(now.getFullYear() - 10, 0, 1);
            maxDate = new Date(now.getFullYear(), 0, 1);
        }
        // breathing room: extend domain by ±1 year
        minDate = new Date(minDate.getFullYear() - 1, 0, 1);
        maxDate = new Date(maxDate.getFullYear() + 1, 0, 1);
        const rangeMs = Math.max(1, maxDate.getTime() - minDate.getTime());
        const MS_PER_YEAR = 365.2425 * 24 * 3600 * 1000;
        const yearsSpan = Math.max(0.25, rangeMs / MS_PER_YEAR);
        const paddingTop = 56;   // extra top/bottom padding for gradients
        const paddingBottom = 72;
        const BASE_PX_PER_YEAR = 120; // base density at scale=1
        const pxPerYear = BASE_PX_PER_YEAR * Math.max(0.1, Math.min(10, timelineScale));
        const trackHeight = pxPerYear * yearsSpan;
        const contentHeight = paddingTop + trackHeight + paddingBottom;
        const yFromDate = (d: Date) => paddingTop + ((d.getTime() - minDate!.getTime()) / rangeMs) * trackHeight;
        const dateFromY = (y: number) => {
            const t = Math.max(0, Math.min(1, (y - paddingTop) / trackHeight));
            const ms = minDate!.getTime() + t * rangeMs;
            return new Date(ms);
        };
        const yFromSummary = (s: PaperSummary) => {
            const d = s.publicationDate ? new Date(s.publicationDate) : (s.year ? new Date(s.year, 0, 1) : null);
            return d ? yFromDate(d) : paddingTop + trackHeight / 2;
        };
        const years: number[] = [];
        const startYear = minDate.getFullYear();
        const endYear = maxDate.getFullYear();
        for (let y = startYear; y <= endYear; y++) years.push(y);
        // tri-level with cross-fade
        const QUARTER_THRESHOLD = 150; // px/year: years -> quarters
        const MONTH_THRESHOLD = 240;   // px/year: quarters -> months
        const FADE_BAND = 14;          // cross-fade width in px/year
        const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
        const quarterIn = clamp01((pxPerYear - QUARTER_THRESHOLD) / FADE_BAND);
        const quarterOut = 1 - clamp01((pxPerYear - MONTH_THRESHOLD) / FADE_BAND);
        const quarterAlpha = quarterIn * quarterOut; // 0..1
        const monthAlpha = clamp01((pxPerYear - MONTH_THRESHOLD) / FADE_BAND);
        const tickMode: 'year' | 'quarter' | 'month' = pxPerYear < QUARTER_THRESHOLD
            ? 'year'
            : (pxPerYear < MONTH_THRESHOLD ? 'quarter' : 'month');
        const quarters: { label: string; y: number }[] = [];
        const months: { label: string; y: number }[] = [];
        if (tickMode !== 'year') {
            for (let y = startYear; y <= endYear; y++) {
                if (tickMode === 'quarter') {
                    [0, 3, 6, 9].forEach((m) => {
                        const d = new Date(y, m, 1);
                        quarters.push({ label: `Q${Math.floor(m / 3) + 1}`, y: yFromDate(d) });
                    });
                } else if (tickMode === 'month') {
                    for (let m = 0; m < 12; m++) {
                        const d = new Date(y, m, 1);
                        months.push({ label: `${m + 1}`.padStart(2, '0'), y: yFromDate(d) });
                    }
                }
            }
        }
        return { minDate, maxDate, rangeMs, yFromDate, dateFromY, yFromSummary, contentHeight, years, quarters, months, pxPerYear, paddingTop, paddingBottom, trackHeight, tickMode, quarterAlpha, monthAlpha } as const;
    }, [nodes, getPaperSummary, timelineScale]);

    // node UI scaling and label density based on zoom
    const nodeUi = useMemo(() => {
        const ppy = timeline.pxPerYear;
        if (ppy < 120) return { scale: 0.78, mode: 'micro' as const, handleSize: 10, showDate: false };
        if (ppy < 170) return { scale: 0.9, mode: 'compact' as const, handleSize: 14, showDate: true };
        return { scale: 1.0, mode: 'full' as const, handleSize: 16, showDate: true };
    }, [timeline.pxPerYear]);

    // initialize positions for new nodes without causing updates during render
    React.useEffect(() => {
        if (!nodes.length) return;
        setNodePos((prev) => {
            let changed = false;
            const next = { ...prev } as Record<string, Pos>;
            nodes.forEach((n, idx) => {
                if (!next[n.id]) {
                    if (layoutMode === 'timeline' && getPaperSummary) {
                        const summary = getPaperSummary(n.id);
                        const y = summary ? timeline.yFromSummary(summary) : 60 + idx * 20;
                        const x = LEFT_AXIS_WIDTH + NODE_START_OFFSET_X + (idx % 6) * 160; // offset for left axis and stagger columns
                        next[n.id] = { x, y };
                    } else {
                        const col = idx % 5;
                        const row = Math.floor(idx / 5);
                        next[n.id] = { x: 40 + col * 160, y: 40 + row * 120 };
                    }
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [nodes, layoutMode, getPaperSummary, timeline]);

    // ----- physics simulation (timeline mode) -----
    React.useEffect(() => {
        if (layoutMode !== 'timeline' || !nodes.length) {
            if (simRef.current) { simRef.current.stop(); simRef.current = null; simNodesRef.current = []; }
            return;
        }
        const cw = containerRef.current?.clientWidth ?? 1000;
        const centerX = Math.max(LEFT_AXIS_WIDTH + NODE_START_OFFSET_X + 140, cw * 0.52);
        const simNodes: SimNode[] = nodes.map((n, idx) => {
            const pos = nodePos[n.id];
            const summary = getPaperSummary?.(n.id);
            const y = summary ? timeline.yFromSummary(summary) : (60 + idx * 20);
            const x = pos?.x ?? (LEFT_AXIS_WIDTH + NODE_START_OFFSET_X + (idx % 6) * 160);
            return { id: n.id, x, y };
        });
        const links = edges.map(e => ({ source: e.from, target: e.to }));

        // stop previous
        if (simRef.current) { simRef.current.stop(); simRef.current = null; }
        simNodesRef.current = simNodes;

        const sim = d3.forceSimulation(simNodes as any)
            .force('link', d3.forceLink(simNodes as any)
                .id((d: any) => (d as SimNode).id)
                .links(links as any)
                .distance(180)
                .strength(0.25)
            )
            .force('charge', d3.forceManyBody().strength(-160))
            .force('collision', d3.forceCollide().radius(90))
            .force('x', d3.forceX(centerX).strength(0.02))
            .force('y', d3.forceY((d: any) => {
                const id = (d as SimNode).id;
                const s = getPaperSummary?.(id);
                return s ? timeline.yFromSummary(s) : timeline.paddingTop + timeline.trackHeight / 2;
            }).strength(1.0))
            .alpha(1)
            .alphaDecay(0.05)
            .velocityDecay(0.4)
            .on('tick', () => {
                if (rafRef.current != null) return;
                rafRef.current = requestAnimationFrame(() => {
                    rafRef.current = null;
                    const latest = Object.fromEntries(simNodesRef.current.map(n => [n.id, { x: n.x, y: n.y } as Pos]));
                    setNodePos(latest);
                });
            });
        simRef.current = sim as any;

        return () => {
            sim.stop();
            if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [layoutMode, nodes, edges, timeline.minDate, timeline.maxDate, timelineScale]);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        const raw = e.dataTransfer.getData('application/x-paper-ids');
        if (!raw) return;
        let ids: string[] = [];
        try { ids = JSON.parse(raw); } catch { return; }
        for (const id of ids) {
            await store.addNode({ id, kind: 'paper' }, { graphId });
        }

        // after nodes are added, if in timeline mode, set their y according to publicationDate
        if (layoutMode === 'timeline' && getPaperSummary) {
            setNodePos((prev) => {
                const next = { ...prev } as Record<string, Pos>;
                ids.forEach((id, idx) => {
                    const sum = getPaperSummary(id);
                    const y = sum ? timeline.yFromSummary(sum) : (40 + idx * 20);
                    // keep current x or place to staggered column
                    const x = next[id]?.x ?? (LEFT_AXIS_WIDTH + NODE_START_OFFSET_X + (idx % 6) * 160);
                    next[id] = { x, y };
                });
                return next;
            });
        }
    }, [graphId, store, layoutMode, getPaperSummary, timeline]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        if (Array.from(e.dataTransfer.types).includes('application/x-paper-ids')) {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
        }
    }, []);

    const onMouseDownNode = (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        const rect = (containerRef.current as HTMLDivElement).getBoundingClientRect();
        const pos: Pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const current = nodePos[id] || { x: pos.x, y: pos.y };
        setDrag({ id, offset: { x: pos.x - current.x, y: pos.y - current.y } });
        setSelectedNodeId(id);
        setSelectedEdgeId(null);
    };

    const onMouseMove = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const pos: Pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        if (panning && containerRef.current) {
            const dx = pos.x - panning.start.x;
            const dy = pos.y - panning.start.y;
            containerRef.current.scrollLeft = panning.scrollLeft - dx;
            containerRef.current.scrollTop = panning.scrollTop - dy;
        }
        if (drag) {
            if (layoutMode === 'timeline' && simRef.current) {
                const sim = simRef.current;
                const sn = simNodesRef.current.find(n => n.id === drag.id);
                if (sn) {
                    sn.fx = pos.x - drag.offset.x;
                    const s = getPaperSummary?.(drag.id);
                    sn.fy = s ? timeline.yFromSummary(s) : (pos.y - drag.offset.y);
                    sim.alpha(0.3).restart();
                }
            } else {
                setNodePos((prev) => ({ ...prev, [drag.id]: { x: pos.x - drag.offset.x, y: pos.y - drag.offset.y } }));
            }
        }
        if (linking) {
            setLinking({ ...linking, current: pos });
        }
    };

    const onMouseUp = () => {
        if (drag && simRef.current) {
            const sn = simNodesRef.current.find(n => n.id === drag.id);
            if (sn) { sn.fx = null; sn.fy = null; simRef.current.alpha(0.2).restart(); }
        }
        setDrag(null);
        setLinking((l) => l ? { ...l, current: l.current } : null);
        setPanning(null);
    };

    const startLink = (fromId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const pos: Pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        setLinking({ fromId, start: pos, current: pos });
    };

    const completeLink = async (toId: string) => {
        if (!linking) return;
        const from = linking.fromId;
        if (from !== toId) {
            await store.addEdge({ from, to: toId, relation: 'related' }, { graphId });
        }
        setLinking(null);
    };

    const onMouseDownEdge = (edgeId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setSelectedEdgeId(edgeId);
        setSelectedNodeId(null);
    };

    const onContextMenuEdge = (edgeId: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedEdgeId(edgeId);
        setSelectedNodeId(null);
        setEdgeMenu({ edgeId, x: e.clientX, y: e.clientY });
    };

    const onContainerMouseDown = (e?: React.MouseEvent) => {
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setLinking(null);
        setEdgeMenu(null);
        setEdgeEdit(null);
        if (containerRef.current) {
            try { containerRef.current.focus(); } catch { /* ignore */ }
            if (e) {
                const rect = containerRef.current.getBoundingClientRect();
                const pos: Pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
                setPanning({ start: pos, scrollLeft: containerRef.current.scrollLeft, scrollTop: containerRef.current.scrollTop });
            }
        }
    };

    const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Delete') {
            e.preventDefault();
            if (selectedNodeId) {
                store.removeNode(selectedNodeId, { graphId }).catch(() => { });
                setSelectedNodeId(null);
                setSelectedEdgeId(null);
                return;
            }
            if (selectedEdgeId) {
                store.removeEdge(selectedEdgeId, { graphId }).catch(() => { });
                setSelectedEdgeId(null);
            }
            return;
        }
        if (e.key === 'Escape') {
            setLinking(null);
            setSelectedEdgeId(null);
            setSelectedNodeId(null);
            setEdgeMenu(null);
            setEdgeEdit(null);
        }
    };

    const handleWheel = useCallback((e: WheelEvent) => {
        if (layoutMode !== 'timeline' || !containerRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        const mouseY = e.clientY - rect.top; // within container viewport
        const absY = container.scrollTop + mouseY;
        const dateUnder = timeline.dateFromY(absY);
        const scaleFactor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
        const newScale = Math.max(0.2, Math.min(8, timelineScale * scaleFactor));

        // compute new y for same date under cursor using same mapping constants
        const t = Math.max(0, Math.min(1, (dateUnder.getTime() - (timeline.minDate as Date).getTime()) / timeline.rangeMs));
        const MS_PER_YEAR = 365.2425 * 24 * 3600 * 1000;
        const yearsSpan = Math.max(0.25, timeline.rangeMs / MS_PER_YEAR);
        const BASE_PX_PER_YEAR = 120;
        const newPxPerYear = BASE_PX_PER_YEAR * newScale;
        const newTrackHeight2 = newPxPerYear * yearsSpan;
        const newAbsY = timeline.paddingTop + t * newTrackHeight2;
        const newScrollTop = Math.max(0, newAbsY - mouseY);
        container.scrollTop = newScrollTop;
        setTimelineScale(newScale);
    }, [layoutMode, timeline, timelineScale]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const listener = (e: WheelEvent) => handleWheel(e);
        el.addEventListener('wheel', listener, { passive: false } as any);
        return () => { el.removeEventListener('wheel', listener as any); };
    }, [handleWheel]);

    const closeMenus = () => { setEdgeMenu(null); setEdgeEdit(null); };
    const deleteEdge = async (edgeId: string) => { await store.removeEdge(edgeId, { graphId }); closeMenus(); };
    const beginEditEdge = (edgeId: string) => {
        const e = edges.find(x => x.id === edgeId);
        if (!e) return;
        if (!containerRef.current || !edgeMenu) return;
        setEdgeEdit({ edgeId, relation: e.relation, x: edgeMenu.x, y: edgeMenu.y });
        setEdgeMenu(null);
    };
    const saveEdgeEdit = async () => {
        if (!edgeEdit) return;
        const old = edges.find(x => x.id === edgeEdit.edgeId);
        if (!old) { closeMenus(); return; }
        // re-create with new relation
        await store.removeEdge(old.id, { graphId });
        await store.addEdge({ from: old.from, to: old.to, relation: edgeEdit.relation }, { graphId });
        closeMenus();
    };

    return (
        <div
            ref={containerRef}
            className="h-full relative overflow-auto overscroll-y-contain bg-[conic-gradient(at_10%_10%,#fafafa,#f6f6f6)]"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseDown={onContainerMouseDown}
            onKeyDown={onKeyDown}
            onWheelCapture={() => { /* handled via native listener to ensure preventDefault */ }}
            tabIndex={0}
        >
            <div className="relative" style={{ height: layoutMode === 'timeline' ? timeline.contentHeight : '100%' }}>
                {layoutMode === 'timeline' && (
                    <>
                        {/* top gradient fade for overall content */}
                        <div className="pointer-events-none absolute left-0 right-0 top-0 h-10 z-[9] bg-gradient-to-b from-white via-white/80 to-transparent" />

                        {/* left axis with year + quarters/months inside */}
                        <div className="absolute left-0 top-0 bottom-0 border-r bg-white/70 z-10" style={{ width: LEFT_AXIS_WIDTH }}>
                            {/* axis bottom-only fade */}
                            <div className="pointer-events-none absolute left-0 right-0 bottom-0 h-14 z-[11] bg-gradient-to-b from-transparent to-white" />

                            {/* years and horizontal ticks */}
                            {timeline.years.map((y) => {
                                const yPos = timeline.yFromDate(new Date(y, 0, 1));
                                return (
                                    <div key={y} className="absolute left-0 right-0" style={{ top: yPos }}>
                                        <div className="flex items-center gap-2">
                                            <div className="text-[11px] text-slate-600 pl-1 w-[48px] text-right">{y}</div>
                                            <div className="h-px bg-slate-200 flex-1" />
                                        </div>
                                    </div>
                                );
                            })}

                            {/* quarters/months column inside axis, aligned to right, cross-fade */}
                            <div className="absolute inset-0 pointer-events-none">
                                {timeline.quarters.map((q, i) => {
                                    const top = q.y + 0;
                                    const opacity = timeline.quarterAlpha;
                                    return (
                                        <div key={`q-${i}`} className="absolute" style={{ top, right: 8, opacity }}>
                                            <div className="text-[10px] text-slate-500 w-[44px] text-right">{q.label}</div>
                                        </div>
                                    );
                                })}
                                {timeline.months.map((m, i) => {
                                    const top = m.y + 0;
                                    const opacity = timeline.monthAlpha;
                                    return (
                                        <div key={`m-${i}`} className="absolute" style={{ top, right: 8, opacity }}>
                                            <div className="text-[9px] text-slate-400 w-[44px] text-right">{m.label}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
                {/* edges */}
                <svg className="absolute inset-0 w-full h-full">
                    <defs>
                        <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="#64748b" />
                        </marker>
                        <marker id="arrow-active" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="#2563eb" />
                        </marker>
                    </defs>
                    {edges.map((e) => {
                        const p1 = nodePos[e.from];
                        const p2 = nodePos[e.to];
                        if (!p1 || !p2) return null;
                        const sx = p1.x, sy = p1.y + NODE_HALF_HEIGHT;
                        const tx = p2.x, ty = p2.y - NODE_HALF_HEIGHT;
                        const my = (sy + ty) / 2;
                        const d = `M ${sx} ${sy} C ${sx} ${my} ${tx} ${my} ${tx} ${ty}`;
                        const active = selectedEdgeId === e.id;
                        return (
                            <g key={e.id}>
                                {/* visible stroke */}
                                <path
                                    d={d}
                                    fill="none"
                                    stroke={active ? '#2563eb' : '#94a3b8'}
                                    strokeWidth={active ? 3 : 2}
                                    markerEnd={`url(#${active ? 'arrow-active' : 'arrow'})`}
                                    pointerEvents="none"
                                />
                                {/* invisible wide hit area */}
                                <path
                                    d={d}
                                    fill="none"
                                    stroke="transparent"
                                    strokeWidth={12}
                                    className="cursor-pointer"
                                    onMouseDown={(evt) => onMouseDownEdge(e.id, evt)}
                                    onContextMenu={(evt) => onContextMenuEdge(e.id, evt)}
                                />
                            </g>
                        );
                    })}
                    {linking && (() => {
                        const sx = linking.start.x, sy = linking.start.y;
                        const tx = linking.current.x, ty = linking.current.y;
                        const my = (sy + ty) / 2;
                        const d = `M ${sx} ${sy} C ${sx} ${my} ${tx} ${my} ${tx} ${ty}`;
                        return (<path d={d} fill="none" stroke="#64748b" strokeDasharray="6 6" strokeWidth={2} />);
                    })()}
                </svg>

                {/* nodes */}
                {nodes.map((n, idx) => {
                    const pos = nodePos[n.id] || { x: 20 + idx * 40, y: 20 + idx * 20 };
                    const summary = getPaperSummary?.(n.id);
                    const title = summary?.name || summary?.title || n.id;
                    const words = (title || '').split(/\s+/).filter(Boolean);
                    const maxWords = nodeUi.mode === 'micro' ? 2 : (nodeUi.mode === 'compact' ? 4 : 8);
                    const shortTitle = words.slice(0, maxWords).join(' ');
                    const dateStr = summary?.publicationDate ? new Date(summary.publicationDate).toISOString().slice(0, 10) : (summary?.year ? String(summary.year) : '');
                    return (
                        <div
                            key={n.id}
                            className="absolute select-none"
                            style={{ left: pos.x, top: pos.y, transform: `translate(-50%, -50%) scale(${nodeUi.scale})`, transition: 'transform 120ms ease' }}
                            onMouseDown={(e) => onMouseDownNode(n.id, e)}
                            onDoubleClick={() => { onNodeOpenDetail?.(n.id); }}
                            onMouseUp={() => completeLink(n.id)}
                        >
                            <div className={`px-3 py-2 rounded-md bg-white shadow border text-sm min-w-[140px] ${selectedNodeId === n.id ? 'border-blue-500 ring-2 ring-blue-500' : ''} relative`}>
                                <div className="font-medium truncate max-w-[200px]">{nodeUi.mode === 'full' ? title : shortTitle}</div>
                                {nodeUi.showDate && (<div className="text-xs text-muted-foreground truncate">{dateStr}</div>)}
                                {/* handles for linking (top/bottom) */}
                                <div className="absolute left-1/2 -translate-x-1/2 -top-2 rounded-full bg-blue-500 shadow cursor-crosshair hover:scale-110 transition-transform" style={{ width: nodeUi.handleSize, height: nodeUi.handleSize }} onMouseDown={(e) => startLink(n.id, e)} title="拖动以连线" />
                                <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 rounded-full bg-blue-500 shadow cursor-crosshair hover:scale-110 transition-transform" style={{ width: nodeUi.handleSize, height: nodeUi.handleSize }} onMouseDown={(e) => startLink(n.id, e)} title="拖动以连线" />
                            </div>
                        </div>
                    );
                })}

                {/* edge context menu / editor */}
                {(edgeMenu || edgeEdit) && (
                    <div className="absolute inset-0 z-50" onMouseDown={closeMenus}>
                        {(edgeMenu && containerRef.current) && (() => {
                            const rect = containerRef.current!.getBoundingClientRect();
                            const left = edgeMenu.x - rect.left + containerRef.current!.scrollLeft;
                            const top = edgeMenu.y - rect.top + containerRef.current!.scrollTop;
                            return (
                                <div className="absolute bg-white shadow-lg border rounded-md text-sm" style={{ left, top }} onMouseDown={(e) => e.stopPropagation()}>
                                    <button className="block w-full text-left px-3 py-2 hover:bg-slate-100" onClick={() => beginEditEdge(edgeMenu.edgeId)}>编辑关系</button>
                                    <button className="block w-full text-left px-3 py-2 text-red-600 hover:bg-red-50" onClick={() => deleteEdge(edgeMenu.edgeId)}>删除</button>
                                </div>
                            );
                        })()}
                        {(edgeEdit && containerRef.current) && (() => {
                            const rect = containerRef.current!.getBoundingClientRect();
                            const left = edgeEdit.x - rect.left + containerRef.current!.scrollLeft;
                            const top = edgeEdit.y - rect.top + containerRef.current!.scrollTop;
                            return (
                                <div className="absolute bg-white shadow-xl border rounded-md p-3 w-64" style={{ left, top }} onMouseDown={(e) => e.stopPropagation()}>
                                    <div className="text-xs mb-2">关系类型</div>
                                    <input className="w-full border rounded px-2 py-1 text-sm" value={edgeEdit.relation} onChange={(e) => setEdgeEdit({ ...edgeEdit, relation: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') saveEdgeEdit(); }} />
                                    <div className="flex justify-end gap-2 mt-2">
                                        <button className="px-2 py-1 text-sm" onClick={closeMenus}>取消</button>
                                        <button className="px-2 py-1 text-sm bg-blue-600 text-white rounded" onClick={saveEdgeEdit}>保存</button>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                )}
            </div>
        </div>
    );
};

export default GraphCanvas;


