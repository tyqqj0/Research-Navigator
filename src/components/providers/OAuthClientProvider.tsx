"use client";

import React from 'react';
import { OAuthProvider } from '@autolabz/oauth-sdk';
import { Toaster } from '@/components/ui';
import { OAuthStoreBridge } from '@/lib/auth';

interface OAuthClientProviderProps {
    authServiceUrl: string;
    clientId: string;
    children: React.ReactNode;
}

export function OAuthClientProvider({ authServiceUrl, clientId, children }: OAuthClientProviderProps) {
    try { console.log('[auth][provider][init]', { authServiceUrl, clientId }); } catch { /* noop */ }
    return (
        <OAuthProvider authServiceUrl={authServiceUrl} clientId={clientId}>
            <OAuthStoreBridge />
            {children}
            {/* Global toast portal */}
            <Toaster richColors expand />
        </OAuthProvider>
    );
}


