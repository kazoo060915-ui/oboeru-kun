import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, verifyPasscode, isAuthenticated, getExpectedToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    if (!getExpectedToken()) {
      console.error('AUTH_PASSCODE is not configured');
      return NextResponse.json(
        { success: false, error: 'サーバー設定が不完全です。' },
        { status: 500 }
      );
    }

    const { passcode } = await req.json();

    // 正しければセッション値（パスコードのハッシュ）が返る。
    // 固定文字列ではないので、パスコードを知らない限り Cookie を偽造できない。
    const token = verifyPasscode(typeof passcode === 'string' ? passcode : '');

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'アクセスコードが正しくありません。' },
        { status: 401 }
      );
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set(AUTH_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30日
      path: '/',
    });
    return response;
  } catch (error) {
    console.error('Auth API Error:', error);
    return NextResponse.json(
      { success: false, error: '認証に失敗しました。' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  return NextResponse.json({ authenticated: isAuthenticated(req) });
}
