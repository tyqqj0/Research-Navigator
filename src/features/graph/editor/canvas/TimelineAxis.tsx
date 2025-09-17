"use client";

import React from 'react';

export interface TimelineComputed {
    minDate: Date;
    maxDate: Date;
    rangeMs: number;
    yFromDate: (d: Date) => number;
    dateFromY: (y: number) => Date;
    yFromSummary?: (s: any) => number;
    contentHeight: number;
    years: number[];
    quarters: { label: string; y: number }[];
    months: { label: string; y: number }[];
    pxPerYear: number;
    paddingTop: number;
    paddingBottom: number;
    trackHeight: number;
    tickMode: 'year' | 'quarter' | 'month';
    quarterAlpha: number;
    monthAlpha: number;
}

interface DensityData { points: { y: number; t: number }[]; alpha: number; }

interface TimelineAxisProps {
    width: number;
    timeline: TimelineComputed;
    density?: DensityData | null;
    densityWidth?: number; // keep in sync with GraphCanvas
}

export const TimelineAxis: React.FC<TimelineAxisProps> = ({ width, timeline, density, densityWidth }) => {
    const areaWidth = Math.max(0, densityWidth ?? 36); // px reserved for density inside axis
    const xRight = Math.max(0, width - 1); // anchor to the inner right edge (left of border)

    // build density path if available (filled between variable left edge and fixed right edge)
    let densityPath: string | null = null;
    if (density && density.points.length >= 2 && density.alpha > 0.01) {
        const pts = density.points;
        const leftXs = pts.map(p => xRight - areaWidth * Math.max(0, Math.min(1, p.t)));
        const ys = pts.map(p => p.y);
        const clampY = (y: number) => Math.max(0, Math.min(timeline.contentHeight, y));
        const N = pts.length;
        const pathParts: string[] = [];
        // start from top-right, then to first left point to avoid a hard seam
        pathParts.push(`M ${xRight} 0`);
        pathParts.push(`L ${leftXs[0]} ${clampY(ys[0])}`);
        // Smooth left edge using Catmull-Rom -> Bezier
        const leftPts = ys.map((y, i) => ({ x: leftXs[i], y: clampY(y) }));
        const toBezier = (p0: any, p1: any, p2: any, p3: any) => {
            const c1x = p1.x + (p2.x - p0.x) / 6;
            const c1y = p1.y + (p2.y - p0.y) / 6;
            const c2x = p2.x - (p3.x - p1.x) / 6;
            const c2y = p2.y - (p3.y - p1.y) / 6;
            return { c1x, c1y, c2x, c2y };
        };
        for (let i = 0; i < leftPts.length - 1; i++) {
            const p0 = i === 0 ? leftPts[0] : leftPts[i - 1];
            const p1 = leftPts[i];
            const p2 = leftPts[i + 1];
            const p3 = i + 2 < leftPts.length ? leftPts[i + 2] : leftPts[leftPts.length - 1];
            const { c1x, c1y, c2x, c2y } = toBezier(p0, p1, p2, p3);
            pathParts.push(`C ${c1x} ${c1y} ${c2x} ${c2y} ${p2.x} ${p2.y}`);
        }
        // close on the right edge back to bottom to make a full-height ribbon
        pathParts.push(`L ${xRight} ${timeline.contentHeight}`);
        pathParts.push('Z');
        densityPath = pathParts.join(' ');
    }

    return (
        <div className="absolute left-0 top-0 bottom-0 z-10 overflow-hidden" style={{ width, backgroundColor: 'color-mix(in srgb, var(--color-background-primary) 70%, transparent)' }}>
            {/* optional density fill under labels */}
            {densityPath && (
                <svg className="absolute inset-0" style={{ pointerEvents: 'none' }}>
                    <path d={densityPath} fill="var(--color-foreground-tertiary)" stroke="none" opacity={density?.alpha ?? 0.5} />
                </svg>
            )}

            {/* years and horizontal ticks */}
            {timeline.years.map((y) => {
                const yPos = timeline.yFromDate(new Date(y, 0, 1));
                return (
                    <div key={y} className="absolute left-0 right-0" style={{ top: yPos }}>
                        <div className="flex items-center gap-2">
                            <div className="text-[11px] pl-1 w-[34px] text-right" style={{ color: 'var(--color-foreground-secondary)' }}>{y}</div>
                            <div className="h-px flex-1" style={{ backgroundColor: 'var(--color-border-primary)' }} />
                        </div>
                    </div>
                );
            })}

            {/* quarters/months column inside axis, aligned to right, cross-fade (clip inside) */}
            <div className="absolute inset-0 pointer-events-none">
                {timeline.quarters.filter(q => q.y >= 2 && q.y <= timeline.contentHeight - 14).map((q, i) => {
                    const top = q.y + 0;
                    const opacity = timeline.quarterAlpha;
                    return (
                        <div key={`q-${i}`} className="absolute" style={{ top, right: 8, opacity }}>
                            <div className="text-[10px] w-[44px] text-right" style={{ color: 'var(--color-foreground-tertiary)' }}>{q.label}</div>
                        </div>
                    );
                })}
                {timeline.months.filter(m => m.y >= 2 && m.y <= timeline.contentHeight - 12).map((m, i) => {
                    const top = m.y + 0;
                    const opacity = timeline.monthAlpha;
                    return (
                        <div key={`m-${i}`} className="absolute" style={{ top, right: 8, opacity }}>
                            <div className="text-[9px] w-[44px] text-right" style={{ color: 'var(--color-foreground-tertiary)' }}>{m.label}</div>
                        </div>
                    );
                })}
            </div>

            {/* axis top/bottom fades to avoid abrupt ends when out of range (height由GraphCanvas控制全局) */}
            <div className="pointer-events-none absolute left-0 right-0 top-0 h-10 z-[11]" style={{ background: 'linear-gradient(to bottom, var(--color-background-primary) 0%, transparent 100%)' }} />
            <div className="pointer-events-none absolute left-0 right-0 bottom-0 h-10 z-[11]" style={{ background: 'linear-gradient(to top, var(--color-background-primary) 0%, transparent 100%)' }} />
        </div>
    );
};

export default TimelineAxis;


