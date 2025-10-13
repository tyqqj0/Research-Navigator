/**
 * Runtime adapter selecting storage backend for user DB.
 * - server FS (fs) when writable
 * - browser localStorage when configured (NEXT_PUBLIC_AUTH_MODE=browser)
 */

import type { MockUserRecord } from '@/lib/auth/mock-user-db';
import { readAllUsers as fsReadAllUsers, writeAllUsers as fsWriteAllUsers, findUserByEmail as fsFindUserByEmail, createUser as fsCreateUser, updateUser as fsUpdateUser } from '@/lib/auth/mock-user-db';
import { browserReadAllUsers, browserFindUserByEmail, browserCreateUser, browserUpdateUser } from '@/lib/auth/browser-user-db';

const MODE = process.env.NEXT_PUBLIC_AUTH_MODE || 'browser';

const isBrowser = typeof window !== 'undefined';

export function dbReadAllUsers(): MockUserRecord[] {
    if (MODE === 'browser' && isBrowser) return browserReadAllUsers() as unknown as MockUserRecord[];
    return fsReadAllUsers();
}

export function dbFindUserByEmail(email: string): MockUserRecord | undefined {
    if (MODE === 'browser' && isBrowser) return browserFindUserByEmail(email) as unknown as MockUserRecord | undefined;
    return fsFindUserByEmail(email);
}

export function dbCreateUser(params: { email: string; name: string; password: string }): MockUserRecord {
    if (MODE === 'browser' && isBrowser) return browserCreateUser(params) as unknown as MockUserRecord;
    return fsCreateUser(params);
}

export function dbUpdateUser(record: MockUserRecord): void {
    if (MODE === 'browser' && isBrowser) return browserUpdateUser(record as any);
    return fsUpdateUser(record);
}


