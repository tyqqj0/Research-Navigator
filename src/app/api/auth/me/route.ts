import { NextResponse } from 'next/server';
import { dbReadAllUsers as readAllUsers } from '@/lib/auth/runtime-user-db';

export async function GET(req: Request) {
    try {
        const cookie = (req as any).headers.get('cookie') || '';
        const match = cookie.match(/(?:^|;\s*)dev_session=([^;]+)/);
        const userId = match ? decodeURIComponent(match[1]) : null;
        if (!userId) {
            return NextResponse.json({ user: null }, { status: 200 });
        }
        const users = readAllUsers();
        const user = users.find(u => u.id === userId);
        if (!user) {
            return NextResponse.json({ user: null }, { status: 200 });
        }
        return NextResponse.json({
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                avatar: user.avatar,
                createdAt: user.createdAt,
                lastLoginAt: user.lastLoginAt,
            },
            token: 'dev-session',
        });
    } catch (err) {
        return NextResponse.json({ error: '获取用户失败' }, { status: 500 });
    }
}


