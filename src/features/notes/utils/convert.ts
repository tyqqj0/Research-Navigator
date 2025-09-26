// Utilities to convert Zotero HTML notes into Markdown and extract a reasonable title

import TurndownService from 'turndown';
import { gfm, tables } from 'turndown-plugin-gfm';

function getTurndown(): TurndownService {
    const service = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced',
        bulletListMarker: '-',
    });
    // Enable GitHub Flavored Markdown features
    service.use(gfm);
    service.use(tables);
    // Keep line breaks closer to original intent
    service.addRule('preserveLineBreaks', {
        filter: ['br'],
        replacement: () => '  \n',
    });
    return service;
}

function fallbackPlainText(html: string): string {
    if (!html) return '';

    const normalize = (input: string) => (
        input
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .join('\n')
            .trim()
    );

    try {
        if (typeof window !== 'undefined' && window.document) {
            const container = window.document.createElement('div');
            container.innerHTML = html;
            const textContent = container.textContent || container.innerText || '';
            const normalized = normalize(textContent);
            if (normalized) return normalized;
        }
    } catch {
        // ignore DOM failures and fall through to regex-based fallback
    }

    const withBreaks = html
        .replace(/<\s*br\s*\/?>(?![^<]*>)/gi, '\n')
        .replace(/<\/(p|div|li|h[1-6]|blockquote|tr)>/gi, '\n');

    const stripped = withBreaks
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ');

    const normalized = normalize(stripped);
    if (normalized) return normalized;

    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function htmlToMarkdown(html: string): string {
    if (!html) return '';
    try {
        const td = getTurndown();
        const md = td.turndown(html).trim();
        if (md) {
            return md;
        }
    } catch {
        // ignore and fall through
    }
    return fallbackPlainText(html);
}

function extractFirstNonEmptyText(root: ParentNode): string {
    const preferredTags = ['h1', 'h2', 'h3', 'p', 'li', 'blockquote'];
    for (const tag of preferredTags) {
        const el = root.querySelector?.(tag);
        if (el) {
            const text = el.textContent?.trim();
            if (text) return text;
        }
    }
    const text = (root as any).textContent?.trim?.() || '';
    if (text) return text;
    return '';
}

export function extractTitleFromZoteroHtml(html: string, maxLength = 80): string {
    if (!html) return '';
    let text = '';
    try {
        if (typeof window !== 'undefined' && 'DOMParser' in window) {
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            text = extractFirstNonEmptyText(doc.body || doc);
        } else {
            // Non-DOM environment fallback: strip tags
            text = String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
        }
    } catch {
        text = String(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    }
    if (!text) return '';
    const normalized = text.replace(/\s+/g, ' ').trim();
    if (normalized.length <= maxLength) return normalized;
    return normalized.slice(0, maxLength - 1) + '…';
}

export function deriveTitleFromMarkdown(markdown: string, maxLength = 80): string {
    const lines = (markdown || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    for (const line of lines) {
        const plain = line.replace(/^#+\s*/, '').replace(/^[-*]\s*/, '').trim();
        if (plain) {
            if (plain.length <= maxLength) return plain;
            return plain.slice(0, maxLength - 1) + '…';
        }
    }
    return '';
}


