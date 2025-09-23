export type NodeUiMode = 'nano' | 'micro' | 'compact' | 'full';

export interface TimelinePhysicsSettings {
    centerXStrength: number;
    charge: number;
    link: { distance: number; strength: number };
    collisionRadius: number;
    dragYRepel: { xRadius: number; yRadius: number };
    ySpringDragging: number;
    ySpringRelease: number;
    dragYRepelPush: number;
}

export function getTimelinePhysicsSettings(mode: NodeUiMode): TimelinePhysicsSettings {
    const centerXStrength = mode === 'nano' ? 0.08 : mode === 'micro' ? 0.05 : 0.02;
    const charge = -160;
    const link = { distance: mode === 'nano' ? 140 : 180, strength: 0.25 };
    const collisionRadius = mode === 'nano' ? 42 : mode === 'micro' ? 68 : mode === 'compact' ? 84 : 90;
    const dragYRepel = { xRadius: 220, yRadius: 120 };
    const ySpringDragging = 0.22;
    const ySpringRelease = 0.18;
    const dragYRepelPush = 1.1;
    return { centerXStrength, charge, link, collisionRadius, dragYRepel, ySpringDragging, ySpringRelease, dragYRepelPush };
}


