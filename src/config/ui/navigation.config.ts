export interface NavigationUIConfig {
    railWidth: number;
    panelWidth: number;
    /** 垂直方向的浮动边距（px），用于浮动侧边栏的上下留白 */
    floatingMarginY: number;
    hoverOpenDelayMs: number;
    hoverCloseDelayMs: number;
    overlayAlpha: number; // 0..1
    blurRadius: number; // px
    allowPin: boolean;
    headerShowUser: boolean; // 是否在 Header 中显示用户头像
    defaultPinned: boolean; // 首次加载是否默认固定侧边栏
}

export const navigationUIConfig: NavigationUIConfig = {
    railWidth: 64,
    panelWidth: 340,
    floatingMarginY: 40,
    hoverOpenDelayMs: 500,
    hoverCloseDelayMs: 200,
    overlayAlpha: 0.15,
    blurRadius: 4,
    allowPin: true,
    headerShowUser: false,
    defaultPinned: true,
};


