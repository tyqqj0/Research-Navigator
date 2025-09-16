"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import ReactFlow, {
    MiniMap,
    Controls,
    Background,
    BackgroundVariant,
    useNodesState,
    useEdgesState,
    Node,
    Edge,
    NodeTypes,
    MarkerType,
    Position,
    Handle,
    ReactFlowProvider,
    useViewport,
    useReactFlow,
    ConnectionMode
} from 'reactflow';
import 'reactflow/dist/style.css';

import { Card, CardContent } from '@/components/ui/card';
import { literatureDataAccess, useLiteratureStore } from '../../data-access';
import type { EnhancedLibraryItem } from '../../data-access/models';
import { cn } from '@/lib/utils';

// Physics engine
import { CitationGraphPhysics, ZOOM_THRESHOLD } from '@/features/literature/visualization/citation-graph/physics';

type CitationGraphPanelProps = {
    visiblePaperIds: string[];
    className?: string;
    isLoading?: boolean;
    onNodeClick?: (paperId: string) => void;
    refreshKey?: number | string;
};

type NodeDetailLevel = 'detailed' | 'simplified';

type LiteratureNodeData = {
    item: EnhancedLibraryItem;
    levelOfDetail: NodeDetailLevel;
    onNodeClick?: (paperId: string) => void;
};

const AdaptiveNode = React.memo(({ data }: { data: LiteratureNodeData }) => {
    const { item, onNodeClick, levelOfDetail } = data;
    const isDetailed = levelOfDetail === 'detailed';

    return (
        <div className={`relative flex items-center justify-center transition-all duration-300 ${isDetailed ? 'w-56 h-24' : 'w-10 h-10'}`}>
            <div
                className={`absolute transition-all duration-300 ease-in-out ${isDetailed ? 'opacity-100 scale-100' : 'opacity-0 scale-50'}`}
                style={{ pointerEvents: isDetailed ? 'all' : 'none' }}
            >
                <Card
                    className="w-56 p-2 cursor-pointer border-2 hover:border-blue-500"
                    onClick={() => onNodeClick?.(item.literature.paperId)}
                >
                    <h3 className="font-semibold text-xs leading-tight mb-1 truncate">{item.literature.title}</h3>
                    <div className="space-y-1 text-muted-foreground text-[10px]">
                        <div className="flex items-center gap-1 truncate">
                            <span>{(item.literature.authors || []).slice(0, 1).join(', ')}{(item.literature.authors || []).length > 1 ? ' et al.' : ''}</span>
                        </div>
                        <div className="flex items-center gap-1">
                            <span>{item.literature.year ?? ''}</span>
                        </div>
                    </div>
                </Card>
            </div>

            <div
                className={`absolute transition-all duration-300 ease-in-out ${!isDetailed ? 'opacity-100 scale-100' : 'opacity-0 scale-0'}`}
                style={{ pointerEvents: !isDetailed ? 'all' : 'none' }}
            >
                <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-mono cursor-pointer shadow-lg bg-gradient-to-br from-blue-400 to-indigo-500"
                    onClick={() => onNodeClick?.(item.literature.paperId)}
                    title={item.literature.title}
                >
                    {(item.literature.title || '').slice(0, 2)}
                </div>
            </div>

            <Handle type="target" position={Position.Left} className="!bg-transparent" />
            <Handle type="source" position={Position.Right} className="!bg-transparent" />
        </div>
    );
});
AdaptiveNode.displayName = 'AdaptiveNode';

const nodeTypes: NodeTypes = { adaptive: AdaptiveNode };

const ViewportMonitor = () => {
    const { zoom } = useViewport();
    const { setNodes } = useReactFlow();
    const lastKnownLevel = useRef<NodeDetailLevel>('detailed');

    useEffect(() => {
        const targetLevel: NodeDetailLevel = zoom < ZOOM_THRESHOLD ? 'simplified' : 'detailed';
        if (targetLevel !== lastKnownLevel.current) {
            lastKnownLevel.current = targetLevel;
            setNodes((nds: Node[]) => nds.map((n: Node) => ({
                ...n,
                data: { ...n.data, levelOfDetail: targetLevel },
            })));

            const physics = (window as any).citationGraphPhysics as CitationGraphPhysics;
            physics?.updateForDetailLevel(targetLevel);
        }
    }, [zoom, setNodes]);
    return null;
};

export function CitationGraphPanel(props: CitationGraphPanelProps) {
    const { visiblePaperIds, isLoading, className, onNodeClick, refreshKey } = props;

    const [nodes, setNodes, onNodesChange] = useNodesState([]);
    const [edges, setEdges, onEdgesChange] = useEdgesState([]);
    const [isLayouting, setIsLayouting] = useState(false);
    const physicsRef = useRef<CitationGraphPhysics | null>(null);
    const literatureStore = useLiteratureStore();
   

    // Initialize physics
    useEffect(() => {
        const onTick = () => {
            setNodes((prevNodes: Node[]) => {
                const physics = physicsRef.current;
                const sim = physics?.getSimulation();
                if (!sim || prevNodes.length === 0) return prevNodes;
                return prevNodes.map((n: Node) => {
                    const simNode = sim.nodes().find((sn: any) => (sn as any).id === n.id);
                    return simNode ? { ...n, position: { x: (simNode as any).x, y: (simNode as any).y } } : n;
                });
            });
        };

        physicsRef.current = new CitationGraphPhysics(onTick);
        (window as any).citationGraphPhysics = physicsRef.current;
        return () => {
            physicsRef.current?.stop();
            physicsRef.current = null;
            delete (window as any).citationGraphPhysics;
        };
    }, [setNodes]);

    const loadNetwork = useCallback(async () => {
        if (!visiblePaperIds || visiblePaperIds.length === 0) {
            setNodes([]);
            setEdges([]);
            return;
        }

        setIsLayouting(true);
        try {
            // Items: read from store for current ids
            const items = literatureStore.getLiteratures(visiblePaperIds) as EnhancedLibraryItem[];

            // Edges: query data-access for internal edges within the set
            const internal = await literatureDataAccess.getInternalCitations(visiblePaperIds, { direction: 'both' });
            let edgesFiltered: Edge[] = internal.edges.map(e => ({
                id: `${e.source}-${e.target}`,
                source: e.source,
                target: e.target,
                type: 'default',
                animated: true,
                markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
            }));

            // Fallback: derive edges from parsedContent if DB has no internal edges yet
            let fallbackEdgesCount = 0;
            if (edgesFiltered.length === 0) {
                const presentIdSet = new Set(visiblePaperIds);
                const generated: Edge[] = [];

                // Helper: normalize titles and DOIs for fuzzy matching
                const normalizeTitle = (s?: string) => (s || '')
                    .toLowerCase()
                    .replace(/[\s\-_:;,./\\]+/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim();
                const normalizeDoi = (s?: string | null) => (s || '')
                    .toLowerCase()
                    .replace(/^https?:\/\/doi\.org\//, '')
                    .trim();

                // Build maps for quick lookup by title and doi among visible items
                const titleToId = new Map<string, string>();
                const doiToId = new Map<string, string>();
                for (const it of items) {
                    const id = it.literature.paperId;
                    const t = normalizeTitle(it.literature.title);
                    if (t) titleToId.set(t, id);
                    const doi = normalizeDoi(it.literature.doi || null);
                    if (doi) doiToId.set(doi, id);
                }

                for (const it of items) {
                    const srcId = it.literature.paperId;

                    // 1) From extractedReferences (string ids or objects)
                    const refs = it.literature.parsedContent?.extractedReferences;
                    if (Array.isArray(refs)) {
                        for (const r of refs as any[]) {
                            let targetId: string | null = null;
                            if (typeof r === 'string') {
                                // direct id match within visible set
                                targetId = r;
                            } else if (r && typeof r === 'object') {
                                if (typeof r.paperId === 'string') targetId = r.paperId;
                                if (!targetId && typeof r.title === 'string') {
                                    const t = titleToId.get(normalizeTitle(r.title));
                                    if (t) targetId = t;
                                }
                                if (!targetId && typeof r.doi === 'string') {
                                    const d = doiToId.get(normalizeDoi(r.doi));
                                    if (d) targetId = d;
                                }
                            }
                            if (targetId && targetId !== srcId && presentIdSet.has(targetId)) {
                                generated.push({
                                    id: `${srcId}-${targetId}`,
                                    source: srcId,
                                    target: targetId,
                                    type: 'default',
                                    animated: true,
                                    markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
                                } as Edge);
                            }
                        }
                    }

                    // 2) From referenceDetails (objects with optional paperId/title)
                    const details = it.literature.parsedContent?.referenceDetails as any[] | undefined;
                    if (Array.isArray(details) && details.length) {
                        for (const d of details) {
                            let targetId: string | null = null;
                            if (typeof d?.paperId === 'string') targetId = d.paperId;
                            if (!targetId && typeof d?.title === 'string') {
                                const t = titleToId.get(normalizeTitle(d.title));
                                if (t) targetId = t;
                            }
                            if (targetId && targetId !== srcId && presentIdSet.has(targetId)) {
                                generated.push({
                                    id: `${srcId}-${targetId}`,
                                    source: srcId,
                                    target: targetId,
                                    type: 'default',
                                    animated: true,
                                    markerEnd: { type: MarkerType.ArrowClosed, color: '#3b82f6' },
                                } as Edge);
                            }
                        }
                    }
                }
                // de-duplicate
                const uniq = new Map<string, Edge>();
                for (const e of generated) uniq.set(e.id, e);
                edgesFiltered = Array.from(uniq.values());
                fallbackEdgesCount = edgesFiltered.length;
            }

            const rfNodes: Node<LiteratureNodeData>[] = items.map(item => ({
                id: item.literature.paperId,
                type: 'adaptive',
                position: { x: 0, y: 0 },
                data: { item, levelOfDetail: 'detailed', onNodeClick },
            }));

            // Set static initial positions (grid) to avoid overlap on start
            const num = rfNodes.length;
            const cols = Math.max(1, Math.ceil(Math.sqrt(num)));
            const padX = 300; const padY = 150;
            rfNodes.forEach((n, i) => {
                const col = i % cols; const row = Math.floor(i / cols);
                n.position = { x: col * padX, y: row * padY };
            });

            setNodes(rfNodes);
            setEdges(edgesFiltered);


            // Start physics
            if (physicsRef.current && rfNodes.length > 0) {
                physicsRef.current.start(rfNodes, edgesFiltered);
            }
        } finally {
            setIsLayouting(false);
        }
    }, [visiblePaperIds, onNodeClick, setNodes, setEdges, literatureStore.stats.lastUpdated]);

    // Debounce network reload on inputs
    useEffect(() => {
        const handle = setTimeout(() => {
            physicsRef.current?.stop();
            loadNetwork();
        }, 150);
        return () => clearTimeout(handle);
    }, [loadNetwork, refreshKey]);

    return (
        <ReactFlowProvider>
            <Card className={cn('flex-1 flex flex-col', className)}>
                <CardContent className="p-0 flex-1">
                    <div className="relative h-full">
                        <ReactFlow
                            nodes={nodes}
                            edges={edges}
                            onNodesChange={onNodesChange}
                            onEdgesChange={onEdgesChange}
                            nodeTypes={nodeTypes}
                            fitView
                            nodesDraggable
                            connectionMode={ConnectionMode.Loose}
                            proOptions={{ hideAttribution: true }}
                            onNodeDragStart={(_, node) => {
                                const physics = physicsRef.current;
                                if (!physics) return;
                                const id = String(node.id);
                                const x = node.position.x; const y = node.position.y;
                                const hasFix = typeof (physics as any).fixNode === 'function';
                                if (hasFix) {
                                    (physics as any).fixNode(id, x, y);
                                } else {
                                    const sim = physics.getSimulation();
                                    if (!sim) return;
                                    const simNode = sim.nodes().find((sn: any) => (sn as any).id === id) as any;
                                    if (!simNode) return;
                                    simNode.fx = x; simNode.fy = y;
                                    sim.alpha(0.3).restart();
                                }
                            }}
                            onNodeDrag={(_, node) => {
                                const physics = physicsRef.current;
                                if (!physics) return;
                                const id = String(node.id);
                                const x = node.position.x; const y = node.position.y;
                                const hasFix = typeof (physics as any).fixNode === 'function';
                                if (hasFix) {
                                    (physics as any).fixNode(id, x, y);
                                } else {
                                    const sim = physics.getSimulation();
                                    if (!sim) return;
                                    const simNode = sim.nodes().find((sn: any) => (sn as any).id === id) as any;
                                    if (!simNode) return;
                                    simNode.fx = x; simNode.fy = y;
                                    sim.alpha(0.3).restart();
                                }
                            }}
                            onNodeDragStop={(_, node) => {
                                const physics = physicsRef.current;
                                if (!physics) return;
                                const id = String(node.id);
                                const hasRelease = typeof (physics as any).releaseNode === 'function';
                                if (hasRelease) {
                                    (physics as any).releaseNode(id);
                                } else {
                                    const sim = physics.getSimulation();
                                    if (!sim) return;
                                    const simNode = sim.nodes().find((sn: any) => (sn as any).id === id) as any;
                                    if (!simNode) return;
                                    simNode.fx = null; simNode.fy = null;
                                    sim.alpha(0.3).restart();
                                }
                            }}
                        >
                            <Controls showInteractive={false} />
                            <MiniMap nodeColor="#3b82f6" maskColor="rgba(0,0,0,0.2)" style={{ width: 120, height: 80 }} />
                            <Background variant={BackgroundVariant.Dots} gap={16} size={1} />
                            <ViewportMonitor />
                        </ReactFlow>
                        {(isLoading || isLayouting) && (
                            <div className="absolute inset-0 bg-white/50 dark:bg-black/50 flex items-center justify-center z-10">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
                            </div>
                        )}

                    </div>
                </CardContent>
            </Card>
        </ReactFlowProvider>
    );
}

export default CitationGraphPanel;


