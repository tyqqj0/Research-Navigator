declare module '@autolabz/oauth-sdk' {
    import type { ReactNode } from 'react';
    export interface StartLoginParams {
        redirectUri: string;
        scope?: string;
        usePkce?: boolean;
        additionalParams?: Record<string, string>;
    }
    export interface HandleRedirectParams {
        redirectUri?: string;
        fetchUserinfo?: boolean;
    }
    export const OAuthProvider: (props: { authServiceUrl: string; clientId: string; children?: ReactNode }) => ReactNode;
    export function useOAuth(): {
        isAuthenticated: boolean;
        user?: any;
        accessToken?: string;
        startLogin: (params: StartLoginParams) => Promise<void>;
        handleRedirect: (params?: HandleRedirectParams) => Promise<void>;
        logout: () => Promise<void>;
    };
}


