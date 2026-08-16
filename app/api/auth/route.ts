import { NextRequest, NextResponse } from 'next/server';
import { AUTH_COOKIE, verifyPasscode, isAuthenticated, getExpectedToken } from '@/lib/auth';
import { hitRateLimit, clearRateLimit, clientKey } from '@/lib/rate-limit';

export async function POST(req: NextRequest) {
  try {
    if (!getExpectedToken()) {
      console.error('AUTH_PASSCODE is not configured');
      return NextResponse.json(
        { success: false, error: 'サーバー設定が不完全です。' },
        { status: 500 }
      );
    }

    // パスコードは短い1本の文字列なので、制限が無いと総当たりが素通りする。
    // 10分あたり5回まで（lib/rate-limit.ts に制約を明記）。
    const key = clientKey(req.headers);
    const limit = hitRateLimit(key);
    if (!limit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `アクセスコードの入力が多すぎます。${Math.ceil(limit.retryAfterSec / 60)}分ほど待ってから試してください。`,
        },
        { status: 429, headers: { 'Retry-After': String(limit.retryAfterSec) } }
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

    // 正しく入れた人を巻き込まないよう、成功したら失敗回数を捨てる
    clearRateLimit(key);

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
