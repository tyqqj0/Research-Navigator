"use client";

import React from 'react';
import { toast } from 'sonner';

export function ClientDiagnostics() {
    React.useEffect(() => {
        const mark = (name: string, detail?: Record<string, unknown>) => {
            try {
                performance.mark(name);
                const g: any = window as any;
                if (!g.__diagMarks) g.__diagMarks = [];
                g.__diagMarks.push({ name, ts: Date.now(), detail });
            } catch { /* noop */ }
        };
        const expose = () => {
            try { (window as any).__diagMark = mark; } catch { /* noop */ }
        };
        expose();

        const onError = (ev: ErrorEvent) => {
            const msg = String(ev?.message || '').toLowerCase();
            const stack = String((ev as any)?.error?.stack || '').toLowerCase();
            const isExtPort = msg.includes('disconnected port') || stack.includes('disconnected port') || stack.includes('chrome-extension://');
            if (isExtPort) {
                try { console.warn('[diag][ext_port_disconnected]', { url: location.href, at: ev.filename, line: ev.lineno }); } catch { }
                try { toast.info('检测到浏览器扩展端口断开（可能的噪声错误）'); } catch { }
                mark('ext:port_disconnected', { at: ev.filename, line: ev.lineno });
            }
        };
        const onRejection = (ev: PromiseRejectionEvent) => {
            const reason = (ev?.reason && (ev.reason.message || ev.reason.toString())) || '';
            const msg = String(reason).toLowerCase();
            const isExtPort = msg.includes('disconnected port');
            if (isExtPort) {
                try { console.warn('[diag][ext_port_disconnected][promise]', { url: location.href }); } catch { }
                try { toast.info('检测到扩展端口断开（Promise）'); } catch { }
                mark('ext:port_disconnected:promise');
            }
        };

        // Intercept console.error to annotate well-known extension errors
        const origError = console.error;
        const patchedError = (...args: any[]) => {
            try {
                const joined = args.map(a => (typeof a === 'string' ? a : (a?.message || ''))).join(' ').toLowerCase();
                if (joined.includes('disconnected port')) {
                    console.warn('[diag][note] 可能来自浏览器扩展的错误（可忽略，不影响功能）');
                    mark('ext:port_disconnected:console');
                }
            } catch { /* noop */ }
            return (origError as any).apply(console, args);
        };

        window.addEventListener('error', onError);
        window.addEventListener('unhandledrejection', onRejection as any);
        (console as any).error = patchedError as any;

        const onVis = () => { mark('page:visibility', { state: document.visibilityState }); };
        document.addEventListener('visibilitychange', onVis);

        return () => {
            try { window.removeEventListener('error', onError); } catch { }
            try { window.removeEventListener('unhandledrejection', onRejection as any); } catch { }
            try { (console as any).error = origError; } catch { }
            try { document.removeEventListener('visibilitychange', onVis); } catch { }
        };
    }, []);

    return null;
}

export default ClientDiagnostics;


