import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { passcode } = await req.json();
    const expectedPasscode = process.env.AUTH_PASSCODE || 'oboeru2026';

    if (passcode === expectedPasscode) {
      const response = NextResponse.json({ success: true });
      // 30日間有効な認証Cookieを発行
      response.cookies.set('oboeru_auth', 'authenticated', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 * 30, // 30日
        path: '/',
      });
      return response;
    }

    return NextResponse.json(
      { success: false, error: 'アクセスコードが正しくありません。' },
      { status: 401 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || '認証に失敗しました。' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const authCookie = req.cookies.get('oboeru_auth');
  const isAuthenticated = authCookie?.value === 'authenticated';
  return NextResponse.json({ authenticated: isAuthenticated });
}
