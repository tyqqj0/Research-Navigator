"use client";

import React from 'react';
import ReactMarkdown from 'react-markdown';

export const Markdown: React.FC<{ text: string; className?: string }> = ({ text, className }) => {
    return (
        <div className={className ?? 'leading-relaxed break-words'}>
            <ReactMarkdown>{text}</ReactMarkdown>
        </div>
    );
};

export default Markdown;


