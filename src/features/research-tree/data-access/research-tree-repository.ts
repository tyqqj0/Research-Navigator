// Research Tree Domain - Repository (Dexie)
// 研究树领域数据仓库

import Dexie, { Table } from 'dexie';
import type {
    ResearchTree,
    ResearchTreeNode,
    MCTSIteration,
    ResearchExpansion,
    TreeStatistics
} from './research-tree-types';

class ResearchTreeDatabase extends Dexie {
    trees!: Table<ResearchTree>;
    nodes!: Table<ResearchTreeNode>;
    iterations!: Table<MCTSIteration>;
    expansions!: Table<ResearchExpansion>;

    constructor() {
        super('ResearchNavigatorTree');

        this.version(1).stores({
            trees: 'id, sessionId, title, status, createdAt, updatedAt',
            nodes: 'id, parentId, treeId, topic, status, visits, wins, depth, createdAt, updatedAt',
            iterations: 'id, treeId, iterationNumber, selectedNodeId, createdAt',
            expansions: 'id, nodeId, selectedTopic, relevanceScore, createdAt'
        });

        // Add treeId to nodes schema for better querying
        this.version(2).stores({
            trees: 'id, sessionId, title, status, createdAt, updatedAt',
            nodes: 'id, parentId, treeId, topic, status, visits, wins, depth, createdAt, updatedAt',
            iterations: 'id, treeId, iterationNumber, selectedNodeId, createdAt',
            expansions: 'id, nodeId, selectedTopic, relevanceScore, createdAt'
        }).upgrade(tx => {
            // Add treeId field to existing nodes
            return tx.table('nodes').toCollection().modify(node => {
                if (!node.treeId) {
                    // We'll need to infer treeId from the tree-node relationships
                    // This is a migration helper - in practice, treeId should always be set
                    node.treeId = 'unknown';
                }
            });
        });
    }
}

const db = new ResearchTreeDatabase();

export class ResearchTreeRepository {
    // Tree CRUD operations
    async getAllTrees(): Promise<ResearchTree[]> {
        return await db.trees.orderBy('createdAt').reverse().toArray();
    }

    async getTreeById(id: string): Promise<ResearchTree | undefined> {
        return await db.trees.get(id);
    }

    async getTreesBySession(sessionId: string): Promise<ResearchTree[]> {
        return await db.trees.where('sessionId').equals(sessionId).toArray();
    }

    async addTree(tree: ResearchTree): Promise<string> {
        return await db.trees.add(tree);
    }

    async updateTree(id: string, updates: Partial<ResearchTree>): Promise<number> {
        return await db.trees.update(id, { ...updates, updatedAt: new Date() });
    }

    async deleteTree(id: string): Promise<void> {
        await db.transaction('rw', [db.trees, db.nodes, db.iterations, db.expansions], async () => {
            // Delete tree
            await db.trees.delete(id);

            // Delete all nodes belonging to this tree
            await db.nodes.where('treeId').equals(id).delete();

            // Delete all iterations for this tree
            await db.iterations.where('treeId').equals(id).delete();

            // Delete all expansions for nodes in this tree
            const nodeIds = await db.nodes.where('treeId').equals(id).primaryKeys();
            if (nodeIds.length > 0) {
                await db.expansions.where('nodeId').anyOf(nodeIds as string[]).delete();
            }
        });
    }

    // Node operations
    async getNodesByTree(treeId: string): Promise<ResearchTreeNode[]> {
        return await db.nodes.where('treeId').equals(treeId).toArray();
    }

    async getNodeById(id: string): Promise<ResearchTreeNode | undefined> {
        return await db.nodes.get(id);
    }

    async addNode(node: ResearchTreeNode & { treeId: string }): Promise<string> {
        return await db.nodes.add(node);
    }

    async updateNode(id: string, updates: Partial<ResearchTreeNode>): Promise<number> {
        return await db.nodes.update(id, { ...updates, updatedAt: new Date() });
    }

    async deleteNode(id: string): Promise<void> {
        await db.transaction('rw', [db.nodes, db.expansions], async () => {
            // Get child nodes to update their parent references
            const childNodes = await db.nodes.where('parentId').equals(id).toArray();

            // Remove parent reference from children (make them orphaned or handle as needed)
            for (const child of childNodes) {
                await db.nodes.update(child.id, { parentId: undefined });
            }

            // Delete the node
            await db.nodes.delete(id);

            // Delete related expansions
            await db.expansions.where('nodeId').equals(id).delete();
        });
    }

    // Tree structure operations
    async getRootNode(treeId: string): Promise<ResearchTreeNode | undefined> {
        const tree = await this.getTreeById(treeId);
        if (!tree) return undefined;

        return await this.getNodeById(tree.rootNodeId);
    }

    async getChildNodes(nodeId: string): Promise<ResearchTreeNode[]> {
        return await db.nodes.where('parentId').equals(nodeId).toArray();
    }

    async getNodePath(nodeId: string): Promise<ResearchTreeNode[]> {
        const path: ResearchTreeNode[] = [];
        let currentId: string | undefined = nodeId;

        while (currentId) {
            const node = await this.getNodeById(currentId);
            if (!node) break;

            path.unshift(node);
            currentId = node.parentId;
        }

        return path;
    }

    // MCTS iteration operations
    async getIterationsByTree(treeId: string): Promise<MCTSIteration[]> {
        return await db.iterations
            .orderBy('iterationNumber')
            .filter(iteration => iteration.treeId === treeId)
            .toArray();
    }

    async addIteration(iteration: MCTSIteration): Promise<string> {
        return await db.iterations.add(iteration);
    }

    async getLastIteration(treeId: string): Promise<MCTSIteration | undefined> {
        const iterations = await db.iterations
            .orderBy('iterationNumber')
            .filter(iteration => iteration.treeId === treeId)
            .reverse()
            .toArray();
        return iterations[0];
    }

    // Expansion operations
    async getExpansionsByNode(nodeId: string): Promise<ResearchExpansion[]> {
        return await db.expansions.where('nodeId').equals(nodeId).toArray();
    }

    async addExpansion(expansion: ResearchExpansion): Promise<string> {
        return await db.expansions.add(expansion);
    }

    // Statistics and analysis
    async calculateTreeStatistics(treeId: string): Promise<TreeStatistics> {
        const nodes = await this.getNodesByTree(treeId);

        if (nodes.length === 0) {
            return {
                totalNodes: 0,
                maxDepth: 0,
                averageDepth: 0,
                totalVisits: 0,
                averageVisits: 0,
                branchingFactor: 0,
                bestPaths: [],
                topicClusters: []
            };
        }

        const totalNodes = nodes.length;
        const maxDepth = Math.max(...nodes.map(n => n.depth));
        const averageDepth = nodes.reduce((sum, n) => sum + n.depth, 0) / totalNodes;
        const totalVisits = nodes.reduce((sum, n) => sum + n.visits, 0);
        const averageVisits = totalVisits / totalNodes;

        // Calculate branching factor
        const nonLeafNodes = nodes.filter(n => n.children.length > 0);
        const branchingFactor = nonLeafNodes.length > 0
            ? nonLeafNodes.reduce((sum, n) => sum + n.children.length, 0) / nonLeafNodes.length
            : 0;

        // Find best paths (top 5)
        const bestPaths = this.findBestPaths(nodes, 5);

        // Topic clustering
        const topicMap = new Map<string, { count: number; totalScore: number }>();
        nodes.forEach(node => {
            const topic = node.topic.toLowerCase();
            const score = node.visits > 0 ? node.wins / node.visits : 0;

            if (topicMap.has(topic)) {
                const existing = topicMap.get(topic)!;
                existing.count++;
                existing.totalScore += score;
            } else {
                topicMap.set(topic, { count: 1, totalScore: score });
            }
        });

        const topicClusters = Array.from(topicMap.entries())
            .map(([topic, data]) => ({
                topic,
                nodeCount: data.count,
                averageScore: data.totalScore / data.count
            }))
            .sort((a, b) => b.nodeCount - a.nodeCount)
            .slice(0, 10);

        return {
            totalNodes,
            maxDepth,
            averageDepth,
            totalVisits,
            averageVisits,
            branchingFactor,
            bestPaths,
            topicClusters
        };
    }

    private findBestPaths(nodes: ResearchTreeNode[], limit: number) {
        // Build node map for quick lookup
        const nodeMap = new Map(nodes.map(n => [n.id, n]));

        // Find leaf nodes (potential path endpoints)
        const leafNodes = nodes.filter(n => n.children.length === 0);

        const paths = leafNodes.map(leaf => {
            const path: string[] = [];
            let current: ResearchTreeNode | undefined = leaf;
            let totalScore = 0;
            let nodeCount = 0;

            while (current) {
                path.unshift(current.id);
                if (current.visits > 0) {
                    totalScore += current.wins / current.visits;
                    nodeCount++;
                }
                current = current.parentId ? nodeMap.get(current.parentId) : undefined;
            }

            return {
                nodeIds: path,
                totalScore,
                averageScore: nodeCount > 0 ? totalScore / nodeCount : 0,
                depth: path.length - 1
            };
        });

        return paths
            .sort((a, b) => b.averageScore - a.averageScore)
            .slice(0, limit);
    }

    // Bulk operations
    async bulkAddNodes(nodes: (ResearchTreeNode & { treeId: string })[]): Promise<string[]> {
        return await db.nodes.bulkAdd(nodes, { allKeys: true });
    }

    async exportTreeData(treeId: string): Promise<{
        tree: ResearchTree;
        nodes: ResearchTreeNode[];
        iterations: MCTSIteration[];
        expansions: ResearchExpansion[];
    }> {
        const [tree, nodes, iterations, expansions] = await Promise.all([
            this.getTreeById(treeId),
            this.getNodesByTree(treeId),
            this.getIterationsByTree(treeId),
            db.expansions.where('nodeId').anyOf(
                (await this.getNodesByTree(treeId)).map(n => n.id)
            ).toArray()
        ]);

        if (!tree) {
            throw new Error(`Tree with id ${treeId} not found`);
        }

        return { tree, nodes, iterations, expansions };
    }

    async importTreeData(data: {
        tree: ResearchTree;
        nodes: ResearchTreeNode[];
        iterations: MCTSIteration[];
        expansions: ResearchExpansion[];
    }): Promise<void> {
        await db.transaction('rw', [db.trees, db.nodes, db.iterations, db.expansions], async () => {
            await db.trees.put(data.tree);

            // Add treeId to nodes
            const nodesWithTreeId = data.nodes.map(node => ({
                ...node,
                treeId: data.tree.id
            }));

            await db.nodes.bulkPut(nodesWithTreeId);
            await db.iterations.bulkPut(data.iterations);
            await db.expansions.bulkPut(data.expansions);
        });
    }
}

// Singleton instance
export const researchTreeRepository = new ResearchTreeRepository();
