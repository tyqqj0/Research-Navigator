"use client";

import React, { useCallback, useMemo, useRef, useState, useEffect } from 'react';
import * as d3 from 'd3-force';
import TimelineAxis from './TimelineAxis';
import { useGraphStore } from '@/features/graph/data-access/graph-store';
import type { GraphDataSource, GraphSnapshot } from '@/features/graph/data-access';
import { graphStoreDataSource } from '@/features/graph/data-access/graph-store';
import type { PaperSummary } from '../paper-catalog';

interface GraphCanvasProps {
    graphId: string;
    getPaperSummary?: (paperId: string) => PaperSummary | undefined;
    onNodeOpenDetail?: (paperId: string) => void;
    layoutMode?: 'free' | 'timeline';
    dataSource?: GraphDataSource; // optional injection for decoupling storage/backend
    className?: string;
    style?: React.CSSProperties;
    axisWidth?: number;
    densityWidth?: number;
    edgeHitbox?: number;
    handleBaseSize?: number;
    nodeRenderer?: (ctx: { nodeId: string; title: string; dateStr: string; scale: number; selected: boolean }) => React.ReactNode;
    onNodeSelect?: (nodeId: string | null) => void;
    onEdgeSelect?: (edgeId: string | null) => void;
    onEdgeCreate?: (edge: { from: string; to: string; relation: string }) => void;
    onViewportChange?: (v: { pxPerYear: number; scrollTop: number }) => void;
}

export interface GraphCanvasRef {
    center: () => void;
    zoomBy: (factor: number, anchorY?: number) => void;
    zoomToDate: (d: Date, anchorY?: number) => void;
    setLayoutMode: (mode: 'free' | 'timeline') => void;
}

type Pos = { x: number; y: number };

type SimNode = { id: string; x: number; y: number; vx?: number; vy?: number; fx?: number | null; fy?: number | null };

export const GraphCanvas = React.forwardRef<GraphCanvasRef, GraphCanvasProps>((props, ref) => {
    const { graphId, getPaperSummary, onNodeOpenDetail, layoutMode = 'free', dataSource, className, style, axisWidth, densityWidth, edgeHitbox, handleBaseSize, nodeRenderer, onNodeSelect, onEdgeSelect, onEdgeCreate, onViewportChange } = props;
    const store = useGraphStore();
    const ds: GraphDataSource = dataSource || graphStoreDataSource;
    const [snapshot, setSnapshot] = useState<GraphSnapshot | null>(null);
    const [internalLayoutMode, setInternalLayoutMode] = useState<'free' | 'timeline'>(layoutMode);
    useEffect(() => { setInternalLayoutMode(layoutMode); }, [layoutMode]);

    // subscribe to data source for live updates
    useEffect(() => {
        setSnapshot(ds.getSnapshot(graphId));
        const unsub = ds.subscribe(graphId, (snap) => setSnapshot(snap));
        return () => { try { unsub?.(); } catch { /* ignore */ } };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [graphId, ds]);

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
    const hasCenteredRef = useRef<boolean>(false);
    const userScrolledRef = useRef<boolean>(false);
    const programmaticScrollRef = useRef<boolean>(false);

    // physics simulation refs
    const simRef = useRef<d3.Simulation<SimNode, any> | null>(null);
    const simNodesRef = useRef<SimNode[]>([]);
    const rafRef = useRef<number | null>(null);

    // edge context menu / editor state
    const [edgeMenu, setEdgeMenu] = useState<{ edgeId: string; x: number; y: number } | null>(null);
    const [edgeEdit, setEdgeEdit] = useState<{ edgeId: string; relation: string; x: number; y: number } | null>(null);

    // background panning state
    const [panning, setPanning] = useState<{ start: Pos; scrollLeft: number; scrollTop: number } | null>(null);
    // viewport height for vertical centering when content is shorter than the viewport
    const [viewportH, setViewportH] = useState<number>(0);

    // layout constants
    const NODE_HALF_HEIGHT = 22; // approx node half height for anchor
    const LEFT_AXIS_WIDTH = axisWidth ?? 96; // px, wider to include months/quarters inside axis
    const NODE_START_OFFSET_X = 72; // px after axis
    const DENSITY_WIDTH = densityWidth ?? 36; // px, density bar rendered to the RIGHT of the axis (adjust here)
    const DENSITY_RIGHT_MARGIN = 5; // px, margin between density and right edge

    const nodes = useMemo(() => Object.values(snapshot?.nodes || {}), [snapshot]);
    const edges = useMemo(() => Object.values(snapshot?.edges || {}), [snapshot]);

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
        // 新增第四级（nano）：更小，仅显示首字母圆点
        if (ppy < 80) return { scale: 0.55, mode: 'nano' as const, handleSize: 8, showDate: false };
        if (ppy < 150) return { scale: 0.78, mode: 'micro' as const, handleSize: 10, showDate: false };
        if (ppy < 240) return { scale: 0.9, mode: 'compact' as const, handleSize: 14, showDate: true };
        return { scale: 1.0, mode: 'full' as const, handleSize: 16, showDate: true };
    }, [timeline.pxPerYear]);

    // density curve data for axis (minimal version)
    const axisDensity = useMemo(() => {
        if (!nodes.length || !getPaperSummary) return null;
        const parseDate = (s: PaperSummary): Date | null => {
            if (s.publicationDate) {
                const d = new Date(s.publicationDate);
                if (!isNaN(d.getTime())) return d;
            }
            if (s.year) return new Date(s.year, 0, 1);
            return null;
        };
        const dates: Date[] = [];
        nodes.forEach(n => { const s = getPaperSummary(n.id); const d = s ? parseDate(s) : null; if (d) dates.push(d); });
        if (!dates.length) return null;

        type Gran = 'year' | 'quarter' | 'month';
        const gran: Gran = timeline.tickMode;

        const startYear = timeline.minDate.getFullYear();
        const endYear = timeline.maxDate.getFullYear();
        const bucketStarts: Date[] = [];
        const keyToIndex = new Map<string, number>();
        const pushBucket = (d: Date) => {
            if (d < timeline.minDate || d > timeline.maxDate) return;
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            if (!keyToIndex.has(key)) { keyToIndex.set(key, bucketStarts.length); bucketStarts.push(d); }
        };
        for (let y = startYear; y <= endYear; y++) {
            if (gran === 'year') {
                pushBucket(new Date(y, 0, 1));
            } else if (gran === 'quarter') {
                [0, 3, 6, 9].forEach(m => pushBucket(new Date(y, m, 1)));
            } else {
                for (let m = 0; m < 12; m++) pushBucket(new Date(y, m, 1));
            }
        }
        bucketStarts.sort((a, b) => a.getTime() - b.getTime());
        const counts = new Array(bucketStarts.length).fill(0) as number[];
        const bucketIndexForDate = (d: Date): number | null => {
            let m = d.getMonth();
            if (gran === 'year') m = 0;
            if (gran === 'quarter') m = Math.floor(m / 3) * 3;
            const key = `${d.getFullYear()}-${m}`;
            const idx = keyToIndex.get(key);
            return (idx === undefined) ? null : idx;
        };
        dates.forEach(d => { const idx = bucketIndexForDate(d); if (idx != null) counts[idx] += 1; });

        // light smoothing (triangular 1-2-1)
        const smoothed = counts.map((c, i) => {
            const c0 = i > 0 ? counts[i - 1] : 0;
            const c2 = i + 1 < counts.length ? counts[i + 1] : 0;
            return 0.25 * c0 + 0.5 * c + 0.25 * c2;
        });
        const maxC = smoothed.reduce((m, v) => Math.max(m, v), 0);
        if (maxC <= 0) return null;
        const logMax = Math.log1p(maxC);
        const points = bucketStarts.map((d, i) => ({
            y: timeline.yFromDate(d),
            t: logMax > 0 ? Math.log1p(smoothed[i]) / logMax : 0
        }));
        // Always visible across zoom levels
        return { points, alpha: 0.65 };
    }, [nodes, getPaperSummary, timeline.minDate, timeline.maxDate, timeline.tickMode, timeline.pxPerYear, timeline.yFromDate]);

    // build density overlay path (outside the axis, anchored to the axis RIGHT edge)
    const densityOverlayPath = useMemo(() => {
        if (!axisDensity || !axisDensity.points.length) return null;
        const pts = axisDensity.points;
        const clampY = (y: number) => Math.max(0, Math.min(timeline.contentHeight, y));
        const baseWidth = 6; // minimal visible width in px
        const N = pts.length;
        const getWidth = (t: number) => {
            const tt = Math.max(0, Math.min(1, t));
            return baseWidth + tt * (DENSITY_WIDTH - baseWidth) - DENSITY_RIGHT_MARGIN;
        };
        const ys = pts.map(p => clampY(p.y));
        const ws = pts.map(p => getWidth(p.t));
        // Build smooth Catmull-Rom -> Bezier curve for the RIGHT edge (x=ws[i], y=ys[i])
        const rightPts = ys.map((y, i) => ({ x: ws[i], y }));
        const parts: string[] = [];
        // start from very top-left so the shape does not abruptly start
        parts.push(`M 0 0`);
        // straight down-left to first right point to form a filled triangle at the top
        parts.push(`L ${rightPts[0].x} ${rightPts[0].y}`);
        const catmullRomToBezier = (p0: any, p1: any, p2: any, p3: any) => {
            const c1x = p1.x + (p2.x - p0.x) / 6;
            const c1y = p1.y + (p2.y - p0.y) / 6;
            const c2x = p2.x - (p3.x - p1.x) / 6;
            const c2y = p2.y - (p3.y - p1.y) / 6;
            return { c1x, c1y, c2x, c2y };
        };
        for (let i = 0; i < rightPts.length - 1; i++) {
            const p0 = i === 0 ? rightPts[0] : rightPts[i - 1];
            const p1 = rightPts[i];
            const p2 = rightPts[i + 1];
            const p3 = i + 2 < rightPts.length ? rightPts[i + 2] : rightPts[rightPts.length - 1];
            const { c1x, c1y, c2x, c2y } = catmullRomToBezier(p0, p1, p2, p3);
            parts.push(`C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`);
        }
        // back along the left edge to bottom to close the shape
        parts.push(`L 0 ${timeline.contentHeight}`);
        parts.push('Z');
        return parts.join(' ');
    }, [axisDensity, timeline.contentHeight]);

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
        if (internalLayoutMode !== 'timeline' || !nodes.length) {
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

        // 参数基于缩放调整：级别越小，横向力更强、碰撞半径更小
        const level = nodeUi.mode; // 'nano' | 'micro' | 'compact' | 'full'
        const collideR = level === 'nano' ? 42 : level === 'micro' ? 68 : level === 'compact' ? 84 : 90;
        const xStrength = level === 'nano' ? 0.08 : level === 'micro' ? 0.05 : 0.02;
        const yStrength = level === 'nano' ? 0.9 : level === 'micro' ? 0.8 : 0.7;
        const linkDist = level === 'nano' ? 140 : 180;

        const sim = d3.forceSimulation(simNodes as any)
            .force('link', d3.forceLink(simNodes as any)
                .id((d: any) => (d as SimNode).id)
                .links(links as any)
                .distance(linkDist)
                .strength(0.25)
            )
            .force('charge', d3.forceManyBody().strength(-160))
            .force('collision', d3.forceCollide().radius(collideR))
            .force('x', d3.forceX(centerX).strength(xStrength))
            .force('y', d3.forceY((d: any) => {
                const id = (d as SimNode).id;
                const s = getPaperSummary?.(id);
                return s ? timeline.yFromSummary(s) : timeline.paddingTop + timeline.trackHeight / 2;
            }).strength(yStrength))
            // 左右边界斥力：靠近边缘时推回
            .force('left-bound', d3.forceX((d: any) => {
                const x = (d as SimNode).x || 0;
                const bound = LEFT_AXIS_WIDTH + 8;
                return x < bound ? bound : x;
            }).strength(0.1))
            .force('right-bound', d3.forceX((d: any) => {
                const w = containerRef.current?.clientWidth ?? 1200;
                const margin = 14;
                const x = (d as SimNode).x || 0;
                const target = w - margin;
                return x > target ? target : x;
            }).strength(0.1))
            .alpha(1)
            .alphaDecay(0.05)
            .velocityDecay(0.4)
            .on('tick', () => {
                if (rafRef.current != null) return;
                rafRef.current = requestAnimationFrame(() => {
                    rafRef.current = null;
                    // clamp to horizontal bounds to avoid nodes running outside the canvas
                    const el = containerRef.current;
                    const w = el?.clientWidth ?? 1200;
                    const minX = LEFT_AXIS_WIDTH + 16;
                    const maxX = Math.max(minX + 80, w - 16);
                    for (const sn of simNodesRef.current) {
                        if (sn.x < minX) { sn.x = minX; if (typeof sn.vx === 'number') sn.vx = Math.max(0, sn.vx) * 0.1; }
                        if (sn.x > maxX) { sn.x = maxX; if (typeof sn.vx === 'number') sn.vx = Math.min(0, sn.vx) * 0.1; }
                    }
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
        // ensure target graph is available in store (lazy-load as fallback)
        try {
            if (!store.getGraphById(graphId)) {
                await store.loadGraph(graphId);
            }
        } catch { /* ignore */ }
        for (const id of ids) {
            await ds.addNode(graphId, { id, kind: 'paper' });
        }

        // after nodes are added, if in timeline mode, set their y according to publicationDate
        if (internalLayoutMode === 'timeline' && getPaperSummary) {
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
        const container = containerRef.current as HTMLDivElement;
        const rect = container.getBoundingClientRect();
        const pos: Pos = { x: e.clientX - rect.left + container.scrollLeft, y: e.clientY - rect.top + container.scrollTop };
        const current = nodePos[id] || { x: pos.x, y: pos.y };
        setDrag({ id, offset: { x: pos.x - current.x, y: pos.y - current.y } });
        setSelectedNodeId(id);
        setSelectedEdgeId(null);
    };

    const onMouseMove = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        const container = containerRef.current;
        const rect = container.getBoundingClientRect();
        const viewPos: Pos = { x: e.clientX - rect.left, y: e.clientY - rect.top };
        const contentPos: Pos = { x: viewPos.x + container.scrollLeft, y: viewPos.y + container.scrollTop };
        if (panning) {
            const dx = viewPos.x - panning.start.x;
            const dy = viewPos.y - panning.start.y;
            container.scrollLeft = panning.scrollLeft - dx;
            container.scrollTop = panning.scrollTop - dy;
        }
        if (drag) {
            if (internalLayoutMode === 'timeline' && simRef.current) {
                const sim = simRef.current;
                const sn = simNodesRef.current.find(n => n.id === drag.id);
                if (sn) {
                    sn.fx = contentPos.x - drag.offset.x;
                    const s = getPaperSummary?.(drag.id);
                    sn.fy = s ? timeline.yFromSummary(s) : (contentPos.y - drag.offset.y);
                    sim.alpha(0.3).restart();
                }
            } else {
                setNodePos((prev) => ({ ...prev, [drag.id]: { x: contentPos.x - drag.offset.x, y: contentPos.y - drag.offset.y } }));
            }
        }
        if (linking) {
            setLinking({ ...linking, current: contentPos });
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

    const startLink = (fromId: string, side: 'top' | 'bottom', e: React.MouseEvent) => {
        e.stopPropagation();
        if (!containerRef.current) return;
        const p = nodePos[fromId];
        if (!p) return;
        const half = NODE_HALF_HEIGHT * nodeUi.scale;
        const anchor: Pos = { x: p.x, y: p.y + (side === 'top' ? -half : half) };
        setLinking({ fromId, start: anchor, current: anchor });
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
        if (internalLayoutMode !== 'timeline' || !containerRef.current) return;
        // Zoom only when Ctrl is pressed; otherwise let native scrolling happen
        if (!e.ctrlKey) return;
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
    }, [internalLayoutMode, timeline, timelineScale]);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const listener = (e: WheelEvent) => handleWheel(e);
        // capture:true to cancel native scroll BEFORE it scrolls the page
        el.addEventListener('wheel', listener, { passive: false, capture: true } as any);
        return () => { el.removeEventListener('wheel', listener as any, { capture: true } as any); };
    }, [handleWheel]);

    // track container height for vertical centering
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const update = () => setViewportH(el.clientHeight);
        update();
        const RO: typeof ResizeObserver | undefined = (window as any).ResizeObserver;
        if (RO) {
            const ro = new RO(update);
            ro.observe(el);
            return () => { try { ro.disconnect(); } catch { /* ignore */ } };
        } else {
            const onResize = () => update();
            window.addEventListener('resize', onResize);
            return () => window.removeEventListener('resize', onResize);
        }
    }, []);

    // mark when user manually scrolls to avoid auto-centering afterwards
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const onScroll = () => {
            if (!programmaticScrollRef.current) userScrolledRef.current = true;
        };
        el.addEventListener('scroll', onScroll, { passive: true } as any);
        return () => { el.removeEventListener('scroll', onScroll as any); };
    }, []);

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

    // center timeline on mount/changes when content taller than viewport (via scroll)
    useEffect(() => {
        if (internalLayoutMode !== 'timeline') return;
        const el = containerRef.current;
        if (!el) return;
        if (timeline.contentHeight <= el.clientHeight) return; // handled via margins in render
        const target = Math.max(0, timeline.contentHeight / 2 - el.clientHeight / 2);
        const needsCenter = !userScrolledRef.current && Math.abs(el.scrollTop - target) > 2;
        if (!needsCenter) return;
        programmaticScrollRef.current = true;
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                el.scrollTop = target;
                programmaticScrollRef.current = false;
            });
        });
        hasCenteredRef.current = true;
    }, [internalLayoutMode, timeline.contentHeight, timeline.minDate, timeline.maxDate]);

    // responsive fades and center margins
    // Simple rule: zoom in -> fades get shorter; zoom out -> fades get taller
    const stickyFadeH = useMemo(() => {
        const ppy = timeline.pxPerYear; // grows with zoom
        // map 60..280 px/year -> 72..20px roughly, then clamp
        const mapped = 92 - 0.26 * Math.max(60, Math.min(280, ppy));
        return Math.round(Math.max(18, Math.min(90, mapped)));
    }, [timeline.pxPerYear]);
    const fadeHeight = useMemo(() => Math.round(Math.max(16, Math.min(80, timeline.pxPerYear * 0.35))), [timeline.pxPerYear]);
    const centerMargin = useMemo(() => internalLayoutMode === 'timeline' ? Math.max(0, (viewportH - timeline.contentHeight) / 2) : 0, [internalLayoutMode, viewportH, timeline.contentHeight]);

    return (
        <div
            ref={containerRef}
            className={`h-full relative overflow-auto overscroll-y-contain outline-none focus:outline-none ${className || ''}`}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseDown={onContainerMouseDown}
            onKeyDown={onKeyDown}
            onWheelCapture={() => { /* handled via native listener to ensure preventDefault */ }}
            tabIndex={0}
            style={{
                backgroundImage: 'conic-gradient(at 10% 10%, var(--color-background-secondary), var(--color-background-tertiary))'
                , ...(style || {})
            }}
        >
            {/* sticky, non-layout overlays: top and bottom gradients stick to viewport edges of the scroll container */}
            {internalLayoutMode === 'timeline' && (
                <>
                    <div className="pointer-events-none sticky top-0 z-[30] overflow-visible relative" style={{ height: 0 }}>
                        <div className="absolute left-0 right-0 top-0" style={{ height: stickyFadeH, background: 'linear-gradient(to bottom, var(--color-background-primary) 0%, color-mix(in srgb, var(--color-background-primary) 80%, transparent) 60%, transparent 100%)' }} />
                    </div>
                    <div className="pointer-events-none sticky bottom-0 z-[30] overflow-visible relative" style={{ height: 0 }}>
                        <div className="absolute left-0 right-0 bottom-0" style={{ height: stickyFadeH, background: 'linear-gradient(to top, var(--color-background-primary) 0%, color-mix(in srgb, var(--color-background-primary) 80%, transparent) 60%, transparent 100%)' }} />
                    </div>
                </>
            )}

            <div className="relative" style={{ height: internalLayoutMode === 'timeline' ? timeline.contentHeight : '100%', marginTop: centerMargin, marginBottom: centerMargin }}>
                {internalLayoutMode === 'timeline' && (
                    <>
                        <TimelineAxis width={LEFT_AXIS_WIDTH} timeline={timeline as any} density={null as any} densityWidth={DENSITY_WIDTH} />
                        {/* density bar to the RIGHT of the axis */}
                        {densityOverlayPath && (
                            <div className="absolute top-0 bottom-0 pointer-events-none z-[8]" style={{ left: LEFT_AXIS_WIDTH, width: DENSITY_WIDTH }}>
                                <svg className="absolute inset-0 w-full h-full">
                                    <rect x={0} y={0} width="100%" height="100%" fill="var(--color-border-primary)" fillOpacity={0.08} />
                                    <path d={densityOverlayPath} fill="var(--color-foreground-tertiary)" stroke="none" opacity={axisDensity?.alpha ?? 0.65} />
                                </svg>
                            </div>
                        )}
                    </>
                )}
                {/* edges */}
                <svg className="absolute inset-0 w-full h-full">
                    <defs>
                        <marker id="arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-foreground-tertiary)" />
                        </marker>
                        <marker id="arrow-active" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-primary)" />
                        </marker>
                        {/* smaller markers for nano level */}
                        <marker id="arrow-small" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-foreground-tertiary)" />
                        </marker>
                        <marker id="arrow-active-small" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--color-primary)" />
                        </marker>
                    </defs>
                    {edges.map((e) => {
                        const p1 = nodePos[e.from];
                        const p2 = nodePos[e.to];
                        if (!p1 || !p2) return null;
                        const half = NODE_HALF_HEIGHT * nodeUi.scale;
                        const sx = p1.x, sy = p1.y + half;
                        const tx = p2.x, ty = p2.y - half;
                        const my = (sy + ty) / 2;
                        const d = `M ${sx} ${sy} C ${sx} ${my} ${tx} ${my} ${tx} ${ty}`;
                        const active = selectedEdgeId === e.id;
                        const marker = nodeUi.mode === 'nano' ? (active ? 'arrow-active-small' : 'arrow-small') : (active ? 'arrow-active' : 'arrow');
                        return (
                            <g key={e.id}>
                                {/* visible stroke */}
                                <path
                                    d={d}
                                    fill="none"
                                    stroke={active ? 'var(--color-primary)' : 'var(--color-foreground-tertiary)'}
                                    strokeWidth={active ? 3 : 2}
                                    markerEnd={`url(#${marker})`}
                                    pointerEvents="none"
                                />
                                {/* invisible wide hit area */}
                                <path
                                    d={d}
                                    fill="none"
                                    stroke="transparent"
                                    strokeWidth={edgeHitbox ?? 12}
                                    className="cursor-pointer"
                                    onMouseDown={(evt) => { onMouseDownEdge(e.id, evt); onEdgeSelect?.(e.id); }}
                                    onContextMenu={(evt) => { onContextMenuEdge(e.id, evt); onEdgeSelect?.(e.id); }}
                                />
                            </g>
                        );
                    })}
                    {linking && (() => {
                        const sx = linking.start.x, sy = linking.start.y;
                        const tx = linking.current.x, ty = linking.current.y;
                        const my = (sy + ty) / 2;
                        const d = `M ${sx} ${sy} C ${sx} ${my} ${tx} ${my} ${tx} ${ty}`;
                        return (<path d={d} fill="none" stroke="var(--color-foreground-tertiary)" strokeDasharray="6 6" strokeWidth={2} />);
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
                            onMouseDown={(e) => { onMouseDownNode(n.id, e); onNodeSelect?.(n.id); }}
                            onDoubleClick={() => { onNodeOpenDetail?.(n.id); }}
                            onMouseUp={() => completeLink(n.id)}
                        >
                            {nodeRenderer ? (
                                nodeRenderer({ nodeId: n.id, title: nodeUi.mode === 'full' ? title : shortTitle, dateStr, scale: nodeUi.scale, selected: selectedNodeId === n.id })
                            ) : (
                                nodeUi.mode === 'nano' ? (
                                    <div className={`px-2 py-1 rounded-full border text-[11px] font-semibold grid place-items-center`} style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)', backgroundColor: 'theme-background-primary', minWidth: 28, fontSize: '17px' }}>
                                        {words.slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('')}
                                    </div>
                                ) : (
                                    <div className={`px-3 py-2 rounded-md shadow border text-sm min-w-[140px] ${selectedNodeId === n.id ? 'ring-2' : ''} relative`} style={{ backgroundColor: 'theme-background-primary', borderColor: selectedNodeId === n.id ? 'var(--color-primary)' : 'var(--color-border-primary)', boxShadow: selectedNodeId === n.id ? '0 0 0 2px var(--color-primary) inset' : undefined }}>
                                        <div className="font-medium truncate max-w-[200px]">{nodeUi.mode === 'full' ? title : shortTitle}</div>
                                        {nodeUi.showDate && (<div className="text-xs text-muted-foreground truncate">{dateStr}</div>)}
                                        {/* handles for linking (top/bottom) */}
                                        <div className="absolute left-1/2 -translate-x-1/2 -top-2 rounded-full shadow cursor-crosshair hover:scale-110 transition-transform" style={{ width: (handleBaseSize ?? nodeUi.handleSize), height: (handleBaseSize ?? nodeUi.handleSize), backgroundColor: 'var(--color-primary)' }} onMouseDown={(e) => startLink(n.id, 'top', e)} title="拖动以连线" />
                                        <div className="absolute left-1/2 -translate-x-1/2 -bottom-2 rounded-full shadow cursor-crosshair hover:scale-110 transition-transform" style={{ width: (handleBaseSize ?? nodeUi.handleSize), height: (handleBaseSize ?? nodeUi.handleSize), backgroundColor: 'var(--color-primary)' }} onMouseDown={(e) => startLink(n.id, 'bottom', e)} title="拖动以连线" />
                                    </div>
                                )
                            )}
                        </div>
                    );
                })}

                {/* edge context menu / editor */}
                {(edgeMenu || edgeEdit) && (
                    <div className="absolute inset-0 z-50" onMouseDown={() => { closeMenus(); onNodeSelect?.(null); onEdgeSelect?.(null); }}>
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
    // viewport change notifications
    useEffect(() => {
        if (!onViewportChange) return;
        const el = containerRef.current;
        if (!el) return;
        const notify = () => onViewportChange({ pxPerYear: timeline.pxPerYear, scrollTop: el.scrollTop });
        notify();
        const onScroll = () => notify();
        el.addEventListener('scroll', onScroll, { passive: true } as any);
        return () => { el.removeEventListener('scroll', onScroll as any); };
    }, [onViewportChange, timeline.pxPerYear]);

    // imperative api
    React.useImperativeHandle(ref, () => ({
        center() {
            const el = containerRef.current; if (!el) return;
            const target = Math.max(0, timeline.contentHeight / 2 - el.clientHeight / 2);
            el.scrollTop = target;
        },
        zoomBy(factor: number, anchorY?: number) {
            const el = containerRef.current; if (!el) return;
            const mouseY = Math.max(0, Math.min(el.clientHeight, (anchorY ?? el.clientHeight / 2)));
            const absY = el.scrollTop + mouseY;
            const dateUnder = timeline.dateFromY(absY);
            const newScale = Math.max(0.2, Math.min(8, timelineScale * factor));
            const t = Math.max(0, Math.min(1, (dateUnder.getTime() - (timeline.minDate as Date).getTime()) / timeline.rangeMs));
            const MS_PER_YEAR = 365.2425 * 24 * 3600 * 1000;
            const yearsSpan = Math.max(0.25, timeline.rangeMs / MS_PER_YEAR);
            const BASE_PX_PER_YEAR = 120;
            const newPxPerYear = BASE_PX_PER_YEAR * newScale;
            const newTrackHeight2 = newPxPerYear * yearsSpan;
            const newAbsY = timeline.paddingTop + t * newTrackHeight2;
            el.scrollTop = Math.max(0, newAbsY - mouseY);
            setTimelineScale(newScale);
        },
        zoomToDate(d: Date, anchorY?: number) {
            const el = containerRef.current; if (!el) return;
            const mouseY = Math.max(0, Math.min(el.clientHeight, (anchorY ?? el.clientHeight / 2)));
            const t = Math.max(0, Math.min(1, (d.getTime() - (timeline.minDate as Date).getTime()) / timeline.rangeMs));
            const MS_PER_YEAR = 365.2425 * 24 * 3600 * 1000;
            const yearsSpan = Math.max(0.25, timeline.rangeMs / MS_PER_YEAR);
            const BASE_PX_PER_YEAR = 120;
            const newPxPerYear = BASE_PX_PER_YEAR * timelineScale;
            const newTrackHeight2 = newPxPerYear * yearsSpan;
            const newAbsY = timeline.paddingTop + t * newTrackHeight2;
            el.scrollTop = Math.max(0, newAbsY - mouseY);
        },
        setLayoutMode(mode: 'free' | 'timeline') {
            setInternalLayoutMode(mode);
        }
    }), [timeline, timelineScale]);

    return (
        // component body already returned above
        null as any
    );
});

export default GraphCanvas;


