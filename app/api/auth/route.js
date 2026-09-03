import { NextResponse } from 'next/server';

export async function POST(request) {
  const { code } = await request.json();
  const expected = process.env.ACCESS_CODE;

  if (!expected) {
    return NextResponse.json(
      { error: 'На сервере не задан ACCESS_CODE' },
      { status: 500 }
    );
  }
  if (typeof code !== 'string' || code !== expected) {
    return NextResponse.json({ error: 'Неверный код' }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set('goals_access', expected, {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 180,
  });
  return res;
}
