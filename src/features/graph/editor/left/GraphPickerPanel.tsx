"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useGraphStore } from '@/features/graph/data-access/graph-store';
import { Download, Upload, Plus, Trash2 } from 'lucide-react';

interface GraphPickerPanelProps {
    className?: string;
    onSelectGraph?: (graphId: string) => void;
}

export const GraphPickerPanel: React.FC<GraphPickerPanelProps> = ({ className, onSelectGraph }) => {
    const store = useGraphStore();
    const [graphList, setGraphList] = useState<{ id: string }[]>([]);
    const [creating, setCreating] = useState(false);
    const [importing, setImporting] = useState(false);

    useEffect(() => {
        store.listGraphs().then(setGraphList).catch(() => { });
    }, [store.listGraphs]);

    const handleCreate = async () => {
        setCreating(true);
        try {
            const g = await store.createGraph();
            const list = await store.listGraphs();
            setGraphList(list);
            onSelectGraph?.(g.id);
        } finally { setCreating(false); }
    };

    const handleDelete = async (id: string) => {
        await store.deleteGraph(id);
        const list = await store.listGraphs();
        setGraphList(list);
        if (store.currentGraphId === id) {
            store.setCurrentGraphId(null);
        }
    };

    const handleExport = async (id: string) => {
        const json = await store.exportCurrentGraphJson().catch(async () => {
            // ensure current is id
            store.setCurrentGraphId(id);
            return await store.exportCurrentGraphJson();
        });
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `graph_${id}.json`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleImport = async (file: File) => {
        setImporting(true);
        try {
            const text = await file.text();
            const { graph } = await store.importGraphJson(text, { generateNewId: true });
            const list = await store.listGraphs();
            setGraphList(list);
            onSelectGraph?.(graph.id);
        } finally { setImporting(false); }
    };

    return (
        <Card className={className}>
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium flex items-center justify-between">
                    <span>图谱</span>
                    <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={handleCreate} disabled={creating}>
                            <Plus className="h-4 w-4 mr-1" /> 新建
                        </Button>
                        <label className="inline-flex items-center">
                            <input
                                type="file"
                                accept="application/json"
                                className="hidden"
                                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.currentTarget.value = ''; }}
                                disabled={importing}
                            />
                            <Button size="sm" variant="outline" asChild={false} disabled={importing}>
                                <span className="inline-flex items-center"><Upload className="h-4 w-4 mr-1" /> 导入</span>
                            </Button>
                        </label>
                    </div>
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="space-y-2 max-h-[14rem] overflow-auto">
                    {graphList.length === 0 && (
                        <div className="text-sm text-muted-foreground">暂无图谱，点击“新建”创建</div>
                    )}
                    {graphList.map((g) => {
                        const selected = store.currentGraphId === g.id;
                        return (
                            <div key={g.id} className={`flex items-center gap-2 px-2 py-1 rounded-md ${selected ? 'bg-primary/10' : 'hover:bg-muted'}`}>
                                <button
                                    type="button"
                                    className="flex-1 text-left truncate"
                                    onClick={() => { store.setCurrentGraphId(g.id); onSelectGraph?.(g.id); }}
                                >
                                    {g.id}
                                </button>
                                <Button size="sm" variant="ghost" onClick={() => handleExport(g.id)}>
                                    <Download className="h-4 w-4" />
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => handleDelete(g.id)}>
                                    <Trash2 className="h-4 w-4 text-red-600" />
                                </Button>
                            </div>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
};

export default GraphPickerPanel;


