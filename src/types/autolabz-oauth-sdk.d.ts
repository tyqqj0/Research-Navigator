declare module '@autolabz/oauth-sdk' {
    import type { ReactNode } from 'react';
    import type React from 'react';
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

    /**
     * SDK-provided avatar/menu component that handles login, profile navigation, and logout.
     */
    export interface AuthAvatarProps {
        redirectUri: string;
        scope?: string;
        profileUrl?: string;
        additionalParams?: Record<string, string>;
        /** Optional function or string to supply OAuth state for return navigation. */
        state?: string | (() => string);
        className?: string;
        align?: 'start' | 'center' | 'end';
    }
    export const AuthAvatar: React.FC<AuthAvatarProps>;
}


