import type { QualityMode, QualityWeights } from '../ports/types';

export const DEFAULT_WEIGHTS: Required<QualityWeights> = {
    influentialPerYear: 1.5,
    recency: 0.4,
    velocity: 0.0,
    venue: 0.0, // 设为 0，因为只考虑 AI 期刊会有问题
    alpha: 0.6,
    tau: 8,
    epsilon: 0.25
};

export const QUALITY_PRESETS: Record<QualityMode, Required<QualityWeights>> = {
    balanced: {
        influentialPerYear: 1.5,
        recency: 0.4,
        velocity: 0.0,
        venue: 0.0, // 设为 0，因为只考虑 AI 期刊会有问题
        alpha: 0.6,
        tau: 8,
        epsilon: 0.25
    },
    classic: {
        influentialPerYear: 1.8,
        recency: 0.2,
        velocity: 0.0,
        venue: 0.0, // 设为 0，因为只考虑 AI 期刊会有问题
        alpha: 0.6,
        tau: 10,
        epsilon: 0.10
    },
    emerging: {
        influentialPerYear: 1.2,
        recency: 0.7,
        velocity: 0.0,
        venue: 0.0, // 设为 0，因为只考虑 AI 期刊会有问题
        alpha: 0.55,
        tau: 5,
        epsilon: 0.30
    }
};

export function getQualityWeights(mode?: QualityMode, custom?: Partial<QualityWeights>): Required<QualityWeights> {
    const base = mode ? QUALITY_PRESETS[mode] : DEFAULT_WEIGHTS;
    return { ...base, ...(custom || {}) } as Required<QualityWeights>;
}



