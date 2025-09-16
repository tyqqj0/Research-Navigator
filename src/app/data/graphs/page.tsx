"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { MainLayout } from '@/components/layout';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui';
import RequireAuth from '@/components/auth/RequireAuth';
import CitationGraphPanel from '@/features/literature/visualization/citation-graph/CitationGraphPanel';
import { useLiteratureOperations } from '@/features/literature/hooks/use-literature-operations';

export default function DataGraphsPage() {
    const { literatures, uiState, loadLiteratures } = useLiteratureOperations();
    const [visiblePaperIds, setVisiblePaperIds] = useState<string[]>([]);

    useEffect(() => {
        loadLiteratures({ force: false }).catch(() => { });
    }, [loadLiteratures]);

    const allIds = useMemo(() => literatures.map(i => i.literature.paperId), [literatures]);

    useEffect(() => {
        setVisiblePaperIds(allIds);
    }, [allIds]);

    return (
        <RequireAuth>
            <MainLayout headerTitle="数据管理" showSidebar={true}>
                <div className="p-6">
                    <div className="max-w-7xl mx-auto space-y-6">
                        <CitationGraphPanel
                            className="h-[70vh]"
                            visiblePaperIds={visiblePaperIds}
                            isLoading={uiState.isLoading}
                            refreshKey={`datagraphs:${visiblePaperIds.length}`}
                        />
                    </div>
                </div>
            </MainLayout>
        </RequireAuth>
    );
}


