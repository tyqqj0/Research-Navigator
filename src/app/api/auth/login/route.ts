import { NextResponse } from 'next/server';
import { findUserByEmail, updateUser } from '@/lib/auth/mock-user-db';

export async function POST(req: Request) {
    try {
        const { email, password } = await req.json();
        if (!email || !password) {
            return NextResponse.json({ error: '缺少邮箱或密码' }, { status: 400 });
        }
        const user = findUserByEmail(email);
        if (!user) {
            return NextResponse.json({ error: '用户不存在' }, { status: 404 });
        }
        if (user.passwordHash !== password) {
            return NextResponse.json({ error: '邮箱或密码错误' }, { status: 401 });
        }
        user.lastLoginAt = new Date().toISOString();
        updateUser(user);
        const res = NextResponse.json({
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
        res.cookies.set('dev_session', user.id, { httpOnly: false, sameSite: 'lax', path: '/' });
        return res;
    } catch (err) {
        return NextResponse.json({ error: '登录失败' }, { status: 500 });
    }
}


