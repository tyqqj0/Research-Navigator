"use client";

import React, { useMemo } from 'react';
import createDOMPurify from 'isomorphic-dompurify';

const dompurify = ((): ReturnType<typeof createDOMPurify> | null => {
    if (typeof window === 'undefined') {
        return null;
    }
    return createDOMPurify(window as any);
})();

type HtmlContentProps = {
    html: string;
    className?: string;
    emptyFallback?: React.ReactNode;
};

const sanitizeHtml = (html: string): string => {
    if (!html) return '';
    if (!dompurify) return html;
    return dompurify.sanitize(html, { USE_PROFILES: { html: true } }).trim();
};

const HtmlContent: React.FC<HtmlContentProps> = ({ html, className, emptyFallback = null }) => {
    const sanitized = useMemo(() => sanitizeHtml(html), [html]);

    if (!sanitized) {
        return emptyFallback ? <>{emptyFallback}</> : null;
    }

    return <div className={className} dangerouslySetInnerHTML={{ __html: sanitized }} />;
};

export default HtmlContent;

