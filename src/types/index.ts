/**
 * Global Types - 全局类型定义
 */

import { ReactNode } from 'react';

// Layout Types
export interface LayoutProps {
    children: ReactNode;
    className?: string;
}

export interface HeaderProps {
    title?: string;
    logo?: ReactNode;
    actions?: ReactNode;
    /** Custom content for the right side (replaces actions + user menu) */
    rightContent?: ReactNode;
    user?: {
        name: string;
        avatar?: string;
        menu?: MenuActionItem[];
    };
    theme?: 'light' | 'dark';
    hideUserInfo?: boolean;
    className?: string;
    /** Called when hamburger button is clicked on small screens */
    onOpenSidebar?: () => void;
}

// Sidebar types are now exported from @/components/ui/sidebar

export interface MenuActionItem {
    key: string;
    label: string;
    icon?: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    href?: string;
}
