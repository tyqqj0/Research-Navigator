import type { SessionCommand } from '../data-access/types';

type CommandHandler = (cmd: SessionCommand) => void | Promise<void>;

const handlers = new Set<CommandHandler>();
const g: any = globalThis as any;
if (!g.__commandBusId) g.__commandBusId = `cmdbus:${Math.random().toString(36).slice(2, 8)}`;
const BUS_ID: string = g.__commandBusId;

export const commandBus = {
    register(handler: CommandHandler): () => void {
        handlers.add(handler);
        // try { console.debug('[bus][command][register]', BUS_ID, 'handlers=', handlers.size); } catch { }
        return () => handlers.delete(handler);
    },
    async dispatch(cmd: SessionCommand) {
        // try { console.debug('[bus][command][dispatch]', BUS_ID, cmd.type, cmd.id, 'handlers=', handlers.size); } catch { }
        for (const h of Array.from(handlers)) {
            try { await Promise.resolve(h(cmd)); } catch (e) { try { console.warn('[bus][command][handler_error]', BUS_ID, (e as Error)?.message); } catch { } }
        }
    }
};


1