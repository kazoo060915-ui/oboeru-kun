import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { isAuthenticated, getExpectedToken } from '@/lib/auth';

/**
 * /api/* への未認証アクセスを入口で止める。
 *
 * これが無かった頃は、クライアント側で AuthModal を被せているだけで
 * API ルートは素通しだった（Cookie 無しの curl で用語の
 * 取得・作成・更新・削除がすべて通り、/api/chat は本人の
 * Anthropic キーで動く汎用 Claude プロキシとして公開されていた）。
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ログイン処理自体は通す（これを塞ぐとログインできない）
  if (pathname === '/api/auth') return NextResponse.next();

  // Vercel Cron から叩かれる。CRON_SECRET で別途保護している
  if (pathname === '/api/notify') return NextResponse.next();

  if (!getExpectedToken()) {
    console.error('AUTH_PASSCODE is not configured');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  if (!isAuthenticated(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/:path*'],
};
