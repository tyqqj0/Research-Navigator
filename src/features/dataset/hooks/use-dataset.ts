"use client";

import React from 'react';
import { datasetService } from '../data-access/dataset-service';
import type { DatasetNode, DatasetPaperItem } from '../data-access/dataset-types';

export function useDataset() {
    const [nodes, setNodes] = React.useState<DatasetNode[]>([]);
    const [loading, setLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);

    const [currentNodeId, setCurrentNodeId] = React.useState<string | null>(null);
    const [items, setItems] = React.useState<DatasetPaperItem[]>([]);
    const [cursor, setCursor] = React.useState<string | undefined>(undefined);

    const loadNodes = React.useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const ns = await datasetService.listNodes();
            setNodes(ns);
        } catch (e: any) {
            setError(e?.message || 'Failed to load nodes');
        } finally {
            setLoading(false);
        }
    }, []);

    const loadPapers = React.useCallback(async (nodeId: string, limit = 20) => {
        setLoading(true);
        setError(null);
        try {
            const { items: its, next } = await datasetService.listPapers(nodeId, { limit });
            setCurrentNodeId(nodeId);
            setItems(its);
            setCursor(next);
        } catch (e: any) {
            setError(e?.message || 'Failed to load items');
        } finally {
            setLoading(false);
        }
    }, []);

    const loadMore = React.useCallback(async () => {
        if (!currentNodeId || !cursor) return;
        setLoading(true);
        setError(null);
        try {
            const { items: its, next } = await datasetService.listPapers(currentNodeId, { cursor });
            setItems(prev => [...prev, ...its]);
            setCursor(next);
        } catch (e: any) {
            setError(e?.message || 'Failed to load more');
        } finally {
            setLoading(false);
        }
    }, [currentNodeId, cursor]);

    return {
        nodes,
        items,
        loading,
        error,
        cursor,
        currentNodeId,
        loadNodes,
        loadPapers,
        loadMore
    };
}


