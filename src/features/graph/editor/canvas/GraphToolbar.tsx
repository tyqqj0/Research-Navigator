"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface GraphToolbarProps {
    className?: string;
    graphId?: string;
}

export const GraphToolbar: React.FC<GraphToolbarProps> = ({ className, graphId }) => {
    return (
        <div className={`flex items-center gap-2 ${className || ''}`}>
            <div className="text-xs text-muted-foreground flex flex-wrap gap-3">
                <span>Ctrl+滚轮：缩放</span>
                <span>滚轮：上下滚动</span>
                <span>右键边：编辑</span>
                <span>单击节点：打开</span>
            </div>
            {/* <Button size="sm" variant="outline"><ZoomOut className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline"><ZoomIn className="h-4 w-4" /></Button> */}
            {/* <Button size="sm" variant="outline"><RotateCcw className="h-4 w-4" /> 重置</Button> */}
            <div className="text-xs text-muted-foreground ml-auto">{graphId ? `Graph: ${graphId}` : '未选择图谱'}</div>
        </div>
    );
};

export default GraphToolbar;


