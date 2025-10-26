/**
 * Lightweight auth bridge for future SDKs.
 * Reads token from auth store and prepares Authorization headers.
 */

import useAuthStore from '@/stores/auth.store';

export function getAuthHeaders(): Record<string, string> {
    try {
        const token = useAuthStore.getState().token;
        if (!token) return {};
        return { Authorization: `Bearer ${token}` };
    } catch {
        return {};
    }
}

export function getUserId(): string | null {
    try {
        return useAuthStore.getState().getUserId();
    } catch {
        return null;
    }
}


