"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useGraphStore } from '@/features/graph/data-access/graph-store';
import { Download, Upload, Link2, Circle, GitBranch } from 'lucide-react';

interface GraphMetaPanelProps {
    className?: string;
    graphId: string;
}

export const GraphMetaPanel: React.FC<GraphMetaPanelProps> = ({ className, graphId }) => {
    const store = useGraphStore();
    const graph = store.getGraphById(graphId);

    const stats = useMemo(() => {
        if (!graph) return { nodes: 0, edges: 0 };
        return { nodes: Object.keys(graph.nodes).length, edges: Object.keys(graph.edges).length };
    }, [graph]);

    const handleExport = async () => {
        const json = await store.exportCurrentGraphJson().catch(async () => {
            store.setCurrentGraphId(graphId);
            return await store.exportCurrentGraphJson();
        });
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `graph_${graphId}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImport = async (file: File) => {
        const text = await file.text();
        await store.importGraphJson(text, { overwrite: false, generateNewId: true });
    };

    return (
        <Card className={className}>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">图谱信息</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="text-sm text-muted-foreground mb-2">ID: <span className="text-xs">{graphId}</span></div>
                <div className="flex items-center gap-4 mb-3 text-sm">
                    <div className="flex items-center gap-1"><Circle className="h-4 w-4" /> 节点 {stats.nodes}</div>
                    <div className="flex items-center gap-1"><GitBranch className="h-4 w-4" /> 边 {stats.edges}</div>
                </div>
                <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" onClick={handleExport}>
                        <Download className="h-4 w-4 mr-1" /> 导出JSON
                    </Button>
                    <label className="inline-flex items-center">
                        <input
                            type="file"
                            accept="application/json"
                            className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImport(f); e.currentTarget.value = ''; }}
                        />
                        <Button size="sm" variant="outline">
                            <Upload className="h-4 w-4 mr-1" /> 导入JSON
                        </Button>
                    </label>
                </div>
            </CardContent>
        </Card>
    );
};

export default GraphMetaPanel;


