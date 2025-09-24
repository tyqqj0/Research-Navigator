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
                components={{
                    a: (props) => <a {...props} className="underline text-blue-600 hover:text-blue-700" />,
                    code: (props) => <code {...props} className="bg-slate-100 px-1 py-0.5 rounded text-[90%]" />,
                    pre: (props) => <pre {...props} className="bg-slate-50 p-2 rounded border overflow-x-auto" />,
                    h1: (props) => <h1 {...props} className="text-lg font-semibold mt-2 mb-1" />,
                    h2: (props) => <h2 {...props} className="text-base font-semibold mt-2 mb-1" />,
                    h3: (props) => <h3 {...props} className="text-sm font-semibold mt-2 mb-1" />,
                    ul: (props) => <ul {...props} className="list-disc pl-5" />,
                    ol: (props) => <ol {...props} className="list-decimal pl-5" />,
                    blockquote: (props) => <blockquote {...props} className="border-l-2 pl-3 italic text-muted-foreground" />,
                    table: (props) => <table {...props} className="table-auto border-collapse" />,
                    th: (props) => <th {...props} className="border px-2 py-1 bg-slate-50" />,
                    td: (props) => <td {...props} className="border px-2 py-1" />,
                }}
            >
                {text}
            </ReactMarkdown>
        </div>
    );
};

export default Markdown;


