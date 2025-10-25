import React from 'react';
import { type SidebarItem } from '@/components/ui';
import { Home } from 'lucide-react';

export const defaultSidebarItems: SidebarItem[] = [
    {
        key: 'research',
        label: '研究',
        icon: (
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
        ),
        path: '/research'
    },
    {
        key: 'library',
        label: '我的文库',
        icon: (
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
        ),
        path: '/literature/library'
    },
    {
        key: 'graphs',
        label: '文献图谱',
        icon: (
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h3m10-12v10a2 2 0 01-2 2h-3M7 7V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10M7 17h10" />
            </svg>
        ),
        path: '/data/graphs'
    },
    {
        key: 'dashboard',
        label: '仪表板',
        icon: (
            <Home className="w-5 h-5" />
        ),
        path: '/dashboard'
    },
    {
        key: 'discovery',
        label: '文献发现',
        icon: (
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
        ),
        path: '/literature/discovery'
    }
];


