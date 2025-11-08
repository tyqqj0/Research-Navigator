import type { ThresholdMethod, ThresholdParams, ThresholdResult } from '../ports/types';

function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

function quantile(sortedDesc: number[], q: number): number {
    const n = sortedDesc.length;
    if (n === 0) return 0;
    const p = clamp(q, 0, 1);
    const idx = Math.max(0, Math.min(n - 1, Math.floor((1 - p) * (n - 1))));
    return sortedDesc[idx];
}

function zscoreThreshold(values: number[], z: number): number {
    if (values.length === 0) return 0;
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / values.length;
    const std = Math.sqrt(variance) || 1e-9;
    return mean + z * std;
}

function paretoThreshold(sortedDesc: number[], topRatio: number): number {
    const n = sortedDesc.length;
    if (n === 0) return 0;
    const k = Math.max(1, Math.floor(clamp(topRatio, 0, 1) * n));
    return sortedDesc[k - 1];
}

function kneedleThreshold(sortedDesc: number[]): { value: number; index: number; maxDrop: number } {
    const n = sortedDesc.length;
    if (n === 0) return { value: 0, index: 0, maxDrop: 0 };
    if (n === 1) return { value: sortedDesc[0], index: 0, maxDrop: 0 };

    // Simple knee approximation: largest consecutive drop
    let maxDrop = -Infinity;
    let kneeIdx = 0;
    for (let i = 0; i < n - 1; i++) {
        const drop = sortedDesc[i] - sortedDesc[i + 1];
        if (drop > maxDrop) {
            maxDrop = drop;
            kneeIdx = i;
        }
    }
    const value = sortedDesc[kneeIdx];
    return { value, index: kneeIdx, maxDrop };
}

export function computeThreshold(scores: number[], method: ThresholdMethod = 'quantile', params: ThresholdParams = {}): ThresholdResult {
    const sortedDesc = [...scores].sort((a, b) => b - a);
    if (sortedDesc.length === 0) {
        return { method, value: 0, selectedCount: 0, diagnostics: { empty: true } };
    }

    let value = 0;
    let selectedCount = 0;
    let diagnostics: Record<string, unknown> | undefined;

    switch (method) {
        case 'kneedle': {
            const { value: v, index, maxDrop } = kneedleThreshold(sortedDesc);
            value = v;
            selectedCount = index + 1;
            diagnostics = { index, maxDrop };
            break;
        }
        case 'pareto': {
            const topRatio = params.topRatio ?? 0.2;
            value = paretoThreshold(sortedDesc, topRatio);
            selectedCount = Math.max(1, Math.floor(clamp(topRatio, 0, 1) * sortedDesc.length));
            diagnostics = { topRatio };
            break;
        }
        case 'zscore': {
            const z = params.z ?? 1.0;
            value = zscoreThreshold(sortedDesc, z);
            selectedCount = sortedDesc.filter(s => s >= value).length;
            diagnostics = { z };
            break;
        }
        case 'quantile':
        default: {
            const q = params.q ?? 0.8;
            value = quantile(sortedDesc, q);
            selectedCount = sortedDesc.filter(s => s >= value).length;
            diagnostics = { q };
            break;
        }
    }

    return { method, value, selectedCount, diagnostics };
}




