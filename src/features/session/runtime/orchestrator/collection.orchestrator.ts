import { commandBus } from '../command-bus';
import { eventBus } from '../event-bus';
import { applyEventToProjection } from '../projectors';
import type { SessionCommand, SessionEvent, Artifact } from '../../data-access/types';
import { searchExecutor } from '../executors/search-executor';
import { collectionExecutor } from '../executors/collection-executor';
import { sessionRepository } from '../../data-access/session-repository';
import { literatureDataAccess } from '@/features/literature/data-access';
import { interpret, StateFrom } from 'xstate';
import { collectionMachine } from './collection.machine';

function newId() { return crypto.randomUUID(); }
async function emit(e: SessionEvent) { await eventBus.publish(e); applyEventToProjection(e); }

const runners = new Map<string, { service: any }>();

commandBus.register(async (cmd: SessionCommand) => {
    if (cmd.type === 'InitCollection') {
        const sessionId = cmd.params.sessionId;
        // 1) 若未绑定集合：创建 temporary 集合并绑定
        // 简化：集合名用时间戳
        const collection = await literatureDataAccess.collections.createCollection({
            name: `Session ${new Date().toLocaleString()}`,
            description: 'Auto-created for session',
            type: 'temporary' as any,
            ownerUid: '' as any,
            isPublic: false,
            parentId: null as any
        } as any);
        await emit({ id: newId(), type: 'SessionCollectionBound', ts: Date.now(), sessionId, payload: { collectionId: collection.id, created: true } });

        // 2) 初次检索 → 直接写入绑定集合
        const batch = await searchExecutor.execute('initial seed');
        await sessionRepository.putArtifact(batch as Artifact);
        await emit({ id: newId(), type: 'SearchExecuted', ts: Date.now(), sessionId, payload: { batchId: batch.id, count: batch.data.paperIds.length } });

        if (batch.data.paperIds.length > 0) {
            await literatureDataAccess.collections.addItemsToCollection(collection.id, batch.data.paperIds);
        }
        await emit({ id: newId(), type: 'PapersIngested', ts: Date.now(), sessionId, payload: { batchId: batch.id, added: batch.data.paperIds.length, total: batch.data.paperIds.length } });
        await emit({ id: newId(), type: 'CollectionUpdated', ts: Date.now(), sessionId, payload: { collectionId: collection.id, version: 1, total: batch.data.paperIds.length } });
        return;
    }
    if (cmd.type === 'StartExpansion') {
        const sessionId = cmd.params.sessionId;
        await emit({ id: newId(), type: 'ExpansionStarted', ts: Date.now(), sessionId, payload: {} });
        // 启动 machine
        const service = interpret(collectionMachine, { context: { sessionId, rounds: 0, lastAdded: 0, total: 0 } } as any);
        service.subscribe((state) => { /* 可扩展：投影进度 */ });
        service.start();
        runners.set(sessionId, { service });
        // 执行一轮
        async function oneRound() {
            const batch = await searchExecutor.execute('expand');
            await sessionRepository.putArtifact(batch as Artifact);
            const ids = batch.data.paperIds;
            // 需要已有绑定集合 id，此处简化：略过读取，直接以事件提示
            await emit({ id: newId(), type: 'SearchExecuted', ts: Date.now(), sessionId, payload: { batchId: batch.id, count: ids.length } });
            // 假设已绑定集合：此处不重复添加，作为示意，发 ingest + evaluate
            await emit({ id: newId(), type: 'PapersIngested', ts: Date.now(), sessionId, payload: { batchId: batch.id, added: ids.length, total: 0 } });
            service.send({ type: 'EXECUTED', added: ids.length, total: 0 });
            const recentGrowth = ids.length / Math.max(1, 100);
            service.send({ type: 'EVALUATED', recentGrowth });
            if (!service.getSnapshot().matches('done')) setTimeout(oneRound, 200);
        }
        setTimeout(oneRound, 0);
        return;
    }
    if (cmd.type === 'StopExpansion') {
        const sessionId = cmd.params.sessionId;
        const r = runners.get(sessionId);
        if (r) { try { r.service.stop(); } catch { } runners.delete(sessionId); }
        await emit({ id: newId(), type: 'ExpansionStopped', ts: Date.now(), sessionId, payload: { by: 'user' } as any });
        return;
    }
});


