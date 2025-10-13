/**
 * Browser-backed user database using localStorage.
 * Used on platforms without writable server filesystem (e.g., Vercel preview).
 */

export interface BrowserUserRecord {
    id: string;
    email: string;
    name: string;
    passwordHash: string;
    avatar?: string;
    createdAt: string;
    lastLoginAt: string;
}

const STORAGE_KEY = 'browser-users-db';

function readDb(): { users: BrowserUserRecord[] } {
    if (typeof window === 'undefined') return { users: [] };
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return { users: [] };
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.users)) return { users: parsed.users };
        return { users: [] };
    } catch {
        return { users: [] };
    }
}

function writeDb(users: BrowserUserRecord[]): void {
    if (typeof window === 'undefined') return;
    const data = { users };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function browserReadAllUsers(): BrowserUserRecord[] {
    return readDb().users;
}

export function browserFindUserByEmail(email: string): BrowserUserRecord | undefined {
    const users = browserReadAllUsers();
    return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function browserCreateUser(params: { email: string; name: string; password: string }): BrowserUserRecord {
    const now = new Date().toISOString();
    const record: BrowserUserRecord = {
        id: `user_${Math.random().toString(36).slice(2, 10)}`,
        email: params.email,
        name: params.name,
        passwordHash: params.password,
        avatar: undefined,
        createdAt: now,
        lastLoginAt: now,
    };
    const users = browserReadAllUsers();
    users.push(record);
    writeDb(users);
    return record;
}

export function browserUpdateUser(record: BrowserUserRecord): void {
    const users = browserReadAllUsers();
    const idx = users.findIndex((u) => u.id === record.id);
    if (idx >= 0) {
        users[idx] = record;
        writeDb(users);
    }
}


