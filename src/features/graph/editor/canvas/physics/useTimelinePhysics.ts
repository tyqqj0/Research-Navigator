import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import * as d3 from 'd3-force';

export type Pos = { x: number; y: number };

export type TimelinePhysicsAPI = {
    startDrag: (nodeId: string, at: Pos) => void;
    moveDragTo: (at: Pos) => void;
    endDrag: () => void;
};

type NodeLike = { id: string };
type EdgeLike = { from: string; to: string };

type SimNode = { id: string; x: number; y: number; vx?: number; vy?: number; fx?: number | null; fy?: number | null };

export type TimelinePhysicsParams = {
    enabled: boolean;
    nodes: NodeLike[];
    edges: EdgeLike[];
    nodeUiMode: 'nano' | 'micro' | 'compact' | 'full';
    containerRef: RefObject<HTMLDivElement | null>;
    leftAxisWidth: number;
    nodeStartOffsetX: number;
    getTargetY: (id: string) => number;
    initialPositions: Record<string, Pos>;
    onPositions: (posById: Record<string, Pos>) => void;
};

export function useTimelinePhysics(params: TimelinePhysicsParams): TimelinePhysicsAPI {
    const {
        enabled,
        nodes,
        edges,
        nodeUiMode,
        containerRef,
        leftAxisWidth,
        nodeStartOffsetX,
        getTargetY,
        initialPositions,
        onPositions,
    } = params;

    const simRef = useRef<d3.Simulation<SimNode, any> | null>(null);
    const simNodesRef = useRef<SimNode[]>([]);
    const rafRef = useRef<number | null>(null);
    const draggingIdRef = useRef<string | null>(null);

    const SETTINGS = (() => {
        const centerXStrength = nodeUiMode === 'nano' ? 0.08 : nodeUiMode === 'micro' ? 0.05 : 0.02;
        const collisionRadius = nodeUiMode === 'nano' ? 42 : nodeUiMode === 'micro' ? 68 : nodeUiMode === 'compact' ? 84 : 90;
        const linkDistance = nodeUiMode === 'nano' ? 140 : 180;
        return {
            centerXStrength,
            charge: -160,
            link: { distance: linkDistance, strength: 0.25 },
            collisionRadius,
            dragYRepel: { xRadius: 220, yRadius: 120 },
            ySpringDragging: 0.22,
            ySpringRelease: 0.18,
            dragYRepelPush: 1.1,
            alpha: 1,
            alphaDecay: 0.05,
            velocityDecay: 0.4,
            sideBoundStrength: 0.1,
        } as const;
    })();

    useEffect(() => {
        if (!enabled || nodes.length === 0) {
            if (simRef.current) { simRef.current.stop(); simRef.current = null; simNodesRef.current = []; }
            return;
        }

        const cw = containerRef.current?.clientWidth ?? 1000;
        const centerX = Math.max(leftAxisWidth + nodeStartOffsetX + 140, cw * 0.52);

        const simNodes: SimNode[] = nodes.map((n, idx) => {
            const pos = initialPositions[n.id];
            const y = getTargetY(n.id);
            const x = pos?.x ?? (leftAxisWidth + nodeStartOffsetX + (idx % 6) * 160);
            return { id: n.id, x, y };
        });
        const links = edges.map(e => ({ source: e.from, target: e.to }));

        if (simRef.current) { simRef.current.stop(); simRef.current = null; }
        simNodesRef.current = simNodes;

        const sim = d3.forceSimulation(simNodes as any)
            .force('link', d3.forceLink(simNodes as any)
                .id((d: any) => (d as SimNode).id)
                .links(links as any)
                .distance(SETTINGS.link.distance)
                .strength(SETTINGS.link.strength)
            )
            .force('charge', d3.forceManyBody().strength(SETTINGS.charge))
            .force('collision', d3.forceCollide().radius(SETTINGS.collisionRadius))
            .force('x', d3.forceX(centerX).strength(SETTINGS.centerXStrength))
            // Y handled manually in RAF below
            .force('left-bound', d3.forceX((d: any) => {
                const x = (d as SimNode).x || 0;
                const bound = leftAxisWidth + 8;
                return x < bound ? bound : x;
            }).strength(SETTINGS.sideBoundStrength))
            .force('right-bound', d3.forceX((d: any) => {
                const w = containerRef.current?.clientWidth ?? 1200;
                const margin = 14;
                const x = (d as SimNode).x || 0;
                const target = w - margin;
                return x > target ? target : x;
            }).strength(SETTINGS.sideBoundStrength))
            .alpha(SETTINGS.alpha)
            .alphaDecay(SETTINGS.alphaDecay)
            .velocityDecay(SETTINGS.velocityDecay)
            .on('tick', () => {
                if (rafRef.current != null) return;
                rafRef.current = requestAnimationFrame(() => {
                    rafRef.current = null;
                    const el = containerRef.current;
                    const w = el?.clientWidth ?? 1200;
                    const minX = leftAxisWidth + 16;
                    const maxX = Math.max(minX + 80, w - 16);
                    for (const sn of simNodesRef.current) {
                        if (sn.x < minX) { sn.x = minX; if (typeof sn.vx === 'number') sn.vx = Math.max(0, sn.vx) * 0.1; }
                        if (sn.x > maxX) { sn.x = maxX; if (typeof sn.vx === 'number') sn.vx = Math.min(0, sn.vx) * 0.1; }
                    }

                    const draggingId = draggingIdRef.current;
                    const draggedNode = draggingId ? simNodesRef.current.find(n => n.id === draggingId) : null;
                    const xr = SETTINGS.dragYRepel.xRadius;
                    const yr = SETTINGS.dragYRepel.yRadius;
                    const pushBase = SETTINGS.dragYRepelPush;
                    const ySpring = draggingId ? SETTINGS.ySpringDragging : SETTINGS.ySpringRelease;
                    for (const sn of simNodesRef.current) {
                        if (draggedNode && sn.id === draggedNode.id) continue;
                        const targetY = getTargetY(sn.id);
                        let newY = sn.y + ySpring * (targetY - sn.y);
                        if (draggedNode) {
                            const dx = Math.abs(sn.x - draggedNode.x);
                            if (dx <= xr) {
                                const dy = sn.y - draggedNode.y;
                                const ady = Math.abs(dy);
                                if (ady <= yr && ady > 0.001) {
                                    const wx = 1 - dx / xr;
                                    const wy = 1 - ady / yr;
                                    newY += pushBase * wx * wy * (dy >= 0 ? 1 : -1);
                                }
                            }
                        }
                        sn.y = newY;
                        sn.vy = 0;
                    }

                    const latest = Object.fromEntries(simNodesRef.current.map(n => [n.id, { x: n.x, y: n.y } as Pos]));
                    onPositions(latest);
                });
            });

        simRef.current = sim as any;
        for (const sn of simNodesRef.current) { sn.vy = 0; }
        sim.alpha(0.9).restart();

        return () => {
            sim.stop();
            if (rafRef.current != null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, nodes, edges, nodeUiMode, leftAxisWidth, nodeStartOffsetX]);

    const api: TimelinePhysicsAPI = {
        startDrag: (nodeId: string, at: Pos) => {
            draggingIdRef.current = nodeId;
            const sn = simNodesRef.current.find(n => n.id === nodeId);
            if (sn) { sn.fx = at.x; sn.fy = at.y; }
            for (const n of simNodesRef.current) { if (n.id !== nodeId) { n.fy = null; } n.vy = 0; }
            simRef.current?.alpha(0.3).restart();
        },
        moveDragTo: (at: Pos) => {
            const id = draggingIdRef.current; if (!id) return;
            const sn = simNodesRef.current.find(n => n.id === id);
            if (!sn) return;
            sn.fx = at.x;
            sn.fy = at.y;
            simRef.current?.alpha(0.3).restart();
        },
        endDrag: () => {
            const id = draggingIdRef.current;
            if (id) {
                const sn = simNodesRef.current.find(n => n.id === id);
                if (sn) { sn.fx = null; sn.fy = null; }
            }
            for (const n of simNodesRef.current) { n.fy = null; n.vy = 0; }
            simRef.current?.alpha(0.25).restart();
            draggingIdRef.current = null;
        }
    };

    return api;
}


