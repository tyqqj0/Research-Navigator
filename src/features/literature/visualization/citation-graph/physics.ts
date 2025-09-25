import * as d3 from 'd3-force';
import { Node, Edge } from 'reactflow';

export const PHYSICS_CONFIG = {
    BASE: {
        LINK_DISTANCE: 180,
        LINK_STRENGTH: 0.7,
        CHARGE_STRENGTH: -600,
        COLLISION_RADIUS: 120,
        CENTER_X: 400,
        CENTER_Y: 300,
        CONSTRAINT_STRENGTH: 0.08,
    },
    DETAILED: {
        CHARGE_STRENGTH: -800,
        COLLISION_RADIUS: 140,
        LINK_DISTANCE: 280,
        LINK_STRENGTH: 0.6,
    },
    SIMPLIFIED: {
        CHARGE_STRENGTH: -450,
        COLLISION_RADIUS: 50,
        LINK_DISTANCE: 120,
        LINK_STRENGTH: 0.8,
    },
    ZOOM_THRESHOLD: 0.7,
    ANIMATION: {
        ALPHA_TARGET: 0.3,
        ALPHA_MIN: 0.001,
        ALPHA_DECAY: 0.0228,
        VELOCITY_DECAY: 0.4,
    }
};

export class CitationGraphPhysics {
    private simulation: d3.Simulation<any, any> | null = null;
    private onTick: () => void;
    // Rendering/throttle controls
    private rafId: number | null = null;
    private lastEmit = 0;
    private readonly emitIntervalMs = 1000 / 30; // ~30fps
    // Stability detection and auto-freeze
    private stableSince: number | null = null;
    private readonly alphaStableThreshold = 0.02;
    private readonly autoFreezeMs = 400; // freeze after stable for 400ms
    private isInteracting = false;

    constructor(onTick: () => void) {
        this.onTick = onTick;
    }

    start(nodes: Node[], edges: Edge[]): d3.Simulation<any, any> {
        this.stop();
        if (nodes.length === 0) throw new Error('Cannot start physics simulation with empty nodes');
        const { BASE } = PHYSICS_CONFIG;

        // Scale-adaptive parameters (quick heuristic by node count)
        const nodeCount = nodes.length;
        const alphaDecay = nodeCount > 250 ? 0.12 : nodeCount > 160 ? 0.09 : PHYSICS_CONFIG.ANIMATION.ALPHA_DECAY;
        const velocityDecay = nodeCount > 250 ? 0.68 : nodeCount > 160 ? 0.58 : PHYSICS_CONFIG.ANIMATION.VELOCITY_DECAY;
        const chargeStrength = nodeCount > 250 ? Math.min(-350, BASE.CHARGE_STRENGTH) : nodeCount > 160 ? Math.min(-450, BASE.CHARGE_STRENGTH) : BASE.CHARGE_STRENGTH;
        const linkDistance = nodeCount > 250 ? Math.max(120, BASE.LINK_DISTANCE - 60) : nodeCount > 160 ? Math.max(140, BASE.LINK_DISTANCE - 40) : BASE.LINK_DISTANCE;
        const linkStrength = nodeCount > 250 ? Math.min(0.9, BASE.LINK_STRENGTH + 0.15) : nodeCount > 160 ? Math.min(0.85, BASE.LINK_STRENGTH + 0.1) : BASE.LINK_STRENGTH;

        this.simulation = d3.forceSimulation(nodes as any)
            .force('link', d3.forceLink(JSON.parse(JSON.stringify(edges)) as any)
                .id((d: any) => (d as Node).id)
                .distance(linkDistance)
                .strength(linkStrength)
            )
            .force('charge', d3.forceManyBody().strength(chargeStrength))
            .force('center', d3.forceCenter(BASE.CENTER_X, BASE.CENTER_Y))
            .force('collision', d3.forceCollide().radius(BASE.COLLISION_RADIUS))
            .force('x', d3.forceX(BASE.CENTER_X).strength(BASE.CONSTRAINT_STRENGTH))
            .force('y', d3.forceY(BASE.CENTER_Y).strength(BASE.CONSTRAINT_STRENGTH))
            .alpha(1)
            .alphaDecay(alphaDecay)
            .velocityDecay(velocityDecay)
            .on('tick', () => this.handleTick());

        (window as any).d3_simulation = this.simulation;
        return this.simulation;
    }

    stop(): void {
        if (this.simulation) {
            this.simulation.stop();
            this.simulation = null;
        }
        delete (window as any).d3_simulation;
    }

    /** 固定节点到指定位置（用于拖拽时与物理引擎联动） */
    fixNode(nodeId: string, x?: number, y?: number): void {
        if (!this.simulation) return;
        const nodes = this.simulation.nodes();
        const n = nodes.find((sn: any) => (sn as any).id === nodeId) as any;
        if (!n) return;
        // 若未提供坐标则保持当前坐标
        const targetX = typeof x === 'number' ? x : n.x;
        const targetY = typeof y === 'number' ? y : n.y;
        n.fx = targetX;
        n.fy = targetY;
        // 提升能量让系统快速响应
        this.simulation.alpha(PHYSICS_CONFIG.ANIMATION.ALPHA_TARGET).restart();
        this.isInteracting = true;
    }

    /** 释放节点（拖拽结束） */
    releaseNode(nodeId: string): void {
        if (!this.simulation) return;
        const nodes = this.simulation.nodes();
        const n = nodes.find((sn: any) => (sn as any).id === nodeId) as any;
        if (!n) return;
        n.fx = null;
        n.fy = null;
        this.simulation.alpha(PHYSICS_CONFIG.ANIMATION.ALPHA_TARGET).restart();
        this.isInteracting = false;
    }

    updateForDetailLevel(level: 'detailed' | 'simplified'): void {
        if (!this.simulation) return;
        const config = level === 'detailed' ? PHYSICS_CONFIG.DETAILED : PHYSICS_CONFIG.SIMPLIFIED;
        this.simulation
            .force('charge', d3.forceManyBody().strength(config.CHARGE_STRENGTH))
            .force('collision', d3.forceCollide().radius(config.COLLISION_RADIUS));
        const linkForce = this.simulation.force('link') as d3.ForceLink<any, any>;
        if (linkForce) linkForce.distance(config.LINK_DISTANCE).strength(config.LINK_STRENGTH);
        this.simulation.alpha(PHYSICS_CONFIG.ANIMATION.ALPHA_TARGET).restart();
    }

    getSimulation(): d3.Simulation<any, any> | null {
        return this.simulation;
    }

    /** 交互状态由外部告知（缩放/平移/框选/拖拽），影响自动冻结 */
    setInteracting(isInteracting: boolean): void {
        this.isInteracting = isInteracting;
        if (this.simulation) {
            if (isInteracting) {
                this.simulation.alpha(PHYSICS_CONFIG.ANIMATION.ALPHA_TARGET).restart();
            }
        }
    }

    private handleTick(): void {
        const sim = this.simulation;
        if (!sim) return;

        // Auto-freeze when stable for a while and not interacting
        const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
        if (!this.isInteracting && sim.alpha() < this.alphaStableThreshold) {
            if (this.stableSince == null) {
                this.stableSince = now;
            } else if (now - this.stableSince >= this.autoFreezeMs) {
                sim.stop();
                this.stableSince = null;
                // No emit on freeze frame
                return;
            }
        } else {
            this.stableSince = null;
        }

        // Throttle emits to ~30fps using RAF
        if (this.rafId != null) return;
        const elapsed = now - this.lastEmit;
        if (elapsed < this.emitIntervalMs) {
            // still schedule next frame to coalesce multiple ticks
        }
        this.rafId = requestAnimationFrame(() => {
            this.rafId = null;
            this.lastEmit = typeof performance !== 'undefined' ? performance.now() : Date.now();
            this.onTick();
        });
    }
}

export const ZOOM_THRESHOLD = PHYSICS_CONFIG.ZOOM_THRESHOLD;


