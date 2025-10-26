'use client';

import React from 'react';
export default function OAuthAppLayout({ children }: { children: React.ReactNode }) {
    // OAuth provider is mounted globally in RootLayout
    return <>{children}</>;
}


