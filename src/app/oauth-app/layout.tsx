'use client';

import React from 'react';
import { OAuthClientProvider } from '@/components/providers/OAuthClientProvider';

export default function OAuthAppLayout({ children }: { children: React.ReactNode }) {
    const authServiceUrl = process.env.NEXT_PUBLIC_AUTH_API_BASE_URL as string | undefined;
    const oauthClientId = process.env.NEXT_PUBLIC_OAUTH_CLIENT_ID as string | undefined;

    if (!authServiceUrl || !oauthClientId) {
        return <>{children}</>;
    }

    return (
        <OAuthClientProvider authServiceUrl={authServiceUrl} clientId={oauthClientId}>
            {children}
        </OAuthClientProvider>
    );
}


