"use client";

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

export const Markdown: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
    return (
        <div className={className ?? 'leading-relaxed break-words'}>
            <ReactMarkdown
                // GitHub Flavored Markdown (tables, strikethrough, task lists)
                remarkPlugins={[remarkGfm, remarkMath]}
                // Render math via KaTeX
                rehypePlugins={[rehypeKatex]}
            >
                {text}
            </ReactMarkdown>
        </div>
    );
};

export default Markdown;


