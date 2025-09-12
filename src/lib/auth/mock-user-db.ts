/**
 * Mock JSON-backed user database for local development
 */

import fs from 'fs';
import path from 'path';

export interface MockUserRecord {
    id: string;
    email: string;
    name: string;
    passwordHash: string; // plaintext for demo only; in real apps use bcrypt
    avatar?: string;
    createdAt: string;
    lastLoginAt: string;
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'users.json');

function ensureDbFile(): void {
    console.log('ensureDbFile', DATA_DIR, DB_FILE);
    if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify({ users: [] }, null, 2), 'utf8');
    }
}

export function readAllUsers(): MockUserRecord[] {
    ensureDbFile();
    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const data = JSON.parse(raw || '{"users": []}');
    return Array.isArray(data.users) ? data.users : [];
}

export function writeAllUsers(users: MockUserRecord[]): void {
    ensureDbFile();
    const data = { users };
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

export function findUserByEmail(email: string): MockUserRecord | undefined {
    const users = readAllUsers();
    return users.find(u => u.email.toLowerCase() === email.toLowerCase());
}

export function createUser(params: { email: string; name: string; password: string; }): MockUserRecord {
    const now = new Date().toISOString();
    const record: MockUserRecord = {
        id: `user_${Math.random().toString(36).slice(2, 10)}`,
        email: params.email,
        name: params.name,
        passwordHash: params.password, // DO NOT DO THIS IN PROD
        avatar: undefined,
        createdAt: now,
        lastLoginAt: now,
    };
    const users = readAllUsers();
    users.push(record);
    writeAllUsers(users);
    return record;
}

export function updateUser(record: MockUserRecord): void {
    const users = readAllUsers();
    const idx = users.findIndex(u => u.id === record.id);
    if (idx >= 0) {
        users[idx] = record;
        writeAllUsers(users);
    }
}


