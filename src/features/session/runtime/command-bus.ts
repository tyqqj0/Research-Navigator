import type { SessionCommand } from '../data-access/types';

type CommandHandler = (cmd: SessionCommand) => void | Promise<void>;

const handlers = new Set<CommandHandler>();

export const commandBus = {
    register(handler: CommandHandler): () => void {
        handlers.add(handler);
        return () => handlers.delete(handler);
    },
    async dispatch(cmd: SessionCommand) {
        for (const h of Array.from(handlers)) {
            try { await Promise.resolve(h(cmd)); } catch { /* ignore */ }
        }
    }
};


