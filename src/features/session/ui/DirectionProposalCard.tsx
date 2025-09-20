"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Markdown } from '@/components/ui/markdown';

interface DirectionProposalCardProps {
    content: string;
}

export const DirectionProposalCard: React.FC<DirectionProposalCardProps> = ({ content }) => {
    return (
        <Card className="border rounded-md">
            <CardHeader className="py-3" variant="blue">
                <CardTitle className="text-sm">研究方向提案</CardTitle>
            </CardHeader>
            <CardContent className="text-sm" variant="blue" rounded="md">
                <Markdown text={content} />
            </CardContent>
        </Card>
    );
};

export default DirectionProposalCard;


