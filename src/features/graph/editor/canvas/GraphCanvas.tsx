"use client";

import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useGraphStore } from '@/features/graph/data-access/graph-store';
import type { PaperSummary } from '../paper-catalog';

interface GraphCanvasProps {
    graphId: string;
    getPaperSummary?: (paperId: string) => PaperSummary | undefined;
}

type Pos = { x: number; y: number };

export const GraphCanvas: React.FC<GraphCanvasProps> = ({ graphId, getPaperSummary }) => {
    const store = useGraphStore();
    const graph = store.getGraphById(graphId);

    // local UI state: node positions and simple pan/zoom (MVP)
    const [nodePos, setNodePos] = useState<Record<string, Pos>>({});
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [drag, setDrag] = useState<{ id: string; offset: Pos } | null>(null);
    const [linking, setLinking] = useState<{ fromId: string; start: Pos; current: Pos } | null>(null);
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

    const nodes = useMemo(() => Object.values(graph?.nodes || {}), [graph]);
    const edges = useMemo(() => Object.values(graph?.edges || {}), [graph]);

    // initialize positions for new nodes without causing updates during render
    React.useEffect(() => {
        if (!nodes.length) return;
        setNodePos((prev) => {
            let changed = false;
            const next = { ...prev } as Record<string, Pos>;
            nodes.forEach((n, idx) => {
                if (!next[n.id]) {
                    const col = idx % 5;
                    const row = Math.floor(idx / 5);
                    next[n.id] = { x: 40 + col * 160, y: 40 + row * 120 };
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [nodes]);

    const handleDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        const raw = e.dataTransfer.getData('application/x-paper-ids');
        if (!raw) return;
        let ids: string[] = [];
        try { ids = JSON.parse(raw); } catch { return; }
        for (const id of ids) {
            await store.addNode({ id, kind: 'paper' }, { graphId });
        }
    }, [graphId, store]);

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
        if (drag) {
            setNodePos((prev) => ({ ...prev, [drag.id]: { x: pos.x - drag.offset.x, y: pos.y - drag.offset.y } }));
        }
        if (linking) {
            setLinking({ ...linking, current: pos });
        }
    };

    const onMouseUp = () => {
        setDrag(null);
        setLinking((l) => l ? { ...l, current: l.current } : null);
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

    const onContainerMouseDown = () => {
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        if (containerRef.current) {
            try { containerRef.current.focus(); } catch { /* ignore */ }
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
        }
    };

    return (
        <div
            ref={containerRef}
            className="h-full relative bg-[conic-gradient(at_10%_10%,#fafafa,#f6f6f6)]"
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseDown={onContainerMouseDown}
            onKeyDown={onKeyDown}
            tabIndex={0}
        >
            {/* edges */}
            <svg className="absolute inset-0 w-full h-full">
                {edges.map((e) => {
                    const p1 = nodePos[e.from];
                    const p2 = nodePos[e.to];
                    if (!p1 || !p2) return null;
                    return (
                        <line
                            key={e.id}
                            x1={p1.x}
                            y1={p1.y}
                            x2={p2.x}
                            y2={p2.y}
                            stroke={selectedEdgeId === e.id ? '#2563eb' : '#94a3b8'}
                            strokeWidth={selectedEdgeId === e.id ? 3 : 2}
                            className="cursor-pointer"
                            onMouseDown={(evt) => onMouseDownEdge(e.id, evt)}
                        />
                    );
                })}
                {linking && (
                    <line x1={linking.start.x} y1={linking.start.y} x2={linking.current.x} y2={linking.current.y} stroke="#64748b" strokeDasharray="4 4" strokeWidth={2} />
                )}
            </svg>

            {/* nodes */}
            {nodes.map((n, idx) => {
                const pos = nodePos[n.id] || { x: 20 + idx * 40, y: 20 + idx * 20 };
                const summary = getPaperSummary?.(n.id);
                return (
                    <div
                        key={n.id}
                        className="absolute select-none"
                        style={{ left: pos.x, top: pos.y, transform: 'translate(-50%, -50%)' }}
                        onMouseDown={(e) => onMouseDownNode(n.id, e)}
                        onDoubleClick={() => { /* open details later */ }}
                        onMouseUp={() => completeLink(n.id)}
                    >
                        <div className={`px-3 py-2 rounded-md bg-white shadow border text-sm min-w-[140px] ${selectedNodeId === n.id ? 'border-blue-500 ring-2 ring-blue-500' : ''}`}>
                            <div className="font-medium truncate max-w-[200px]">{summary?.title || n.id}</div>
                            <div className="text-xs text-muted-foreground truncate">
                                {summary?.authors?.[0] || ''}{summary?.year ? ` · ${summary.year}` : ''}
                            </div>
                            <div className="pt-1 flex items-center justify-end">
                                <button className="text-[10px] text-blue-600 hover:underline" onClick={(e) => startLink(n.id, e)}>连线</button>
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

export default GraphCanvas;


