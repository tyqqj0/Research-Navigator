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

    constructor(onTick: () => void) {
        this.onTick = onTick;
    }

    start(nodes: Node[], edges: Edge[]): d3.Simulation<any, any> {
        this.stop();
        if (nodes.length === 0) throw new Error('Cannot start physics simulation with empty nodes');
        const { BASE } = PHYSICS_CONFIG;

        this.simulation = d3.forceSimulation(nodes as any)
            .force('link', d3.forceLink(JSON.parse(JSON.stringify(edges)) as any)
                .id((d: any) => (d as Node).id)
                .distance(BASE.LINK_DISTANCE)
                .strength(BASE.LINK_STRENGTH)
            )
            .force('charge', d3.forceManyBody().strength(BASE.CHARGE_STRENGTH))
            .force('center', d3.forceCenter(BASE.CENTER_X, BASE.CENTER_Y))
            .force('collision', d3.forceCollide().radius(BASE.COLLISION_RADIUS))
            .force('x', d3.forceX(BASE.CENTER_X).strength(BASE.CONSTRAINT_STRENGTH))
            .force('y', d3.forceY(BASE.CENTER_Y).strength(BASE.CONSTRAINT_STRENGTH))
            .alpha(1)
            .alphaDecay(PHYSICS_CONFIG.ANIMATION.ALPHA_DECAY)
            .velocityDecay(PHYSICS_CONFIG.ANIMATION.VELOCITY_DECAY)
            .on('tick', this.onTick);

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
}

export const ZOOM_THRESHOLD = PHYSICS_CONFIG.ZOOM_THRESHOLD;


