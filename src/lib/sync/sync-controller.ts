import { subscribeLocalWrites } from './sync-events';
import type { DataSyncService, DomainSyncService } from './data-sync-service';
import { syncConfig } from '@/config/sync.config';

export class SyncController {
    private service: DataSyncService;
    private domainServices: DomainSyncService[] = [];
    private unsub: (() => void) | null = null;
    private timer: any = null;
    private poller: any = null;
    private pending = new Set<string>();

    constructor(service: DataSyncService, domains?: DomainSyncService[]) {
        this.service = service;
        if (Array.isArray(domains)) this.domainServices = domains;
    }

    start(): void {
        if (!syncConfig.enabled) return;
        if (!this.unsub) this.unsub = subscribeLocalWrites(e => this.onLocalWrite(e.sessionId));
        // initial pull soon, then schedule poll
        this.safePull();
        this.startPolling();
        if (typeof window !== 'undefined') {
            try { window.addEventListener('online', this.safePull); } catch { /* noop */ }
            try { document.addEventListener('visibilitychange', this.onVisibility, false); } catch { /* noop */ }
        }
    }

    stop(): void {
        if (this.unsub) { try { this.unsub(); } catch { /* noop */ } this.unsub = null; }
        if (this.timer) { try { clearTimeout(this.timer); } catch { /* noop */ } this.timer = null; }
        if (this.poller) { try { clearInterval(this.poller); } catch { /* noop */ } this.poller = null; }
        if (typeof window !== 'undefined') {
            try { window.removeEventListener('online', this.safePull); } catch { /* noop */ }
            try { document.removeEventListener('visibilitychange', this.onVisibility, false); } catch { /* noop */ }
        }
    }

    private onVisibility = () => {
        if (document.visibilityState === 'visible') this.safePull();
    };

    private onLocalWrite(sessionId: string): void {
        this.pending.add(sessionId);
        if (this.timer) { try { clearTimeout(this.timer); } catch { /* noop */ } this.timer = null; }
        this.timer = setTimeout(() => {
            this.flush().catch(() => void 0);
        }, Math.max(300, syncConfig.debounceMs));
    }

    private startPolling(): void {
        if (this.poller) { try { clearInterval(this.poller); } catch { /* noop */ } }
        this.poller = setInterval(() => this.safePull(), Math.max(5000, syncConfig.pollIntervalMs));
    }

    private safePull = async (): Promise<void> => {
        try { await this.service.pullIndexAndSessions(); } catch { /* noop */ }
        // pull for other domains in background (fire-and-forget sequencing)
        for (const d of this.domainServices) {
            try { await d.pull(); } catch { /* noop */ }
        }
    };

    async flush(): Promise<void> {
        if (this.pending.size === 0) return;
        try {
            await this.service.pushDirtySessions();
            for (const d of this.domainServices) {
                try { await d.push(); } catch { /* noop */ }
            }
        } finally {
            this.pending.clear();
        }
    }
}


