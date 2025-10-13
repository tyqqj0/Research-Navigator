import { NextResponse } from 'next/server';
import { dbFindUserByEmail as findUserByEmail, dbCreateUser as createUser } from '@/lib/auth/runtime-user-db';

export async function POST(req: Request) {
    try {
        const { email, name, password } = await req.json();
        if (!email || !name || !password) {
            return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
        }
        const exists = findUserByEmail(email);
        if (exists) {
            return NextResponse.json({ error: '邮箱已被注册' }, { status: 409 });
        }
        const record = createUser({ email, name, password });
        const res = NextResponse.json({
            user: {
                id: record.id,
                email: record.email,
                name: record.name,
                avatar: record.avatar,
                createdAt: record.createdAt,
                lastLoginAt: record.lastLoginAt,
            },
            token: 'dev-session',
        }, { status: 201 });
        res.cookies.set('dev_session', record.id, { httpOnly: false, sameSite: 'lax', path: '/' });
        return res;
    } catch (err) {
        return NextResponse.json({ error: '注册失败' }, { status: 500 });
    }
}


