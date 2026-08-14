import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export const AUTH_COOKIE = 'oboeru_auth';

/**
 * セッションCookieに入れる値。
 *
 * 以前は 'authenticated' という固定文字列だったため、誰でも
 * document.cookie に書けば認証を突破できた（httpOnly は JS からの
 * 「読み取り」を防ぐだけで、攻撃者が自分のブラウザで「書く」のは防げない）。
 *
 * パスコードのハッシュを使うことで、パスコードを知らない限り
 * 正しい値を作れなくなる。パスコードを変えれば既存セッションも自動失効する。
 */
function sessionToken(passcode: string): string {
  return createHash('sha256').update(`oboeru:${passcode}`).digest('hex');
}

/** パスコード未設定なら null。呼び出し側は「設定ミス」として扱うこと。 */
export function getExpectedToken(): string | null {
  const passcode = process.env.AUTH_PASSCODE;
  if (!passcode) return null;
  return sessionToken(passcode);
}

/** パスコードが正しければセッション値を返す。違えば null。 */
export function verifyPasscode(input: string): string | null {
  const passcode = process.env.AUTH_PASSCODE;
  if (!passcode) return null;

  // 長さが違うと timingSafeEqual が投げるので、先にハッシュを揃えてから比較する
  const a = createHash('sha256').update(input).digest();
  const b = createHash('sha256').update(passcode).digest();
  if (!timingSafeEqual(a, b)) return null;

  return sessionToken(passcode);
}

export function isAuthenticated(req: NextRequest): boolean {
  const expected = getExpectedToken();
  if (!expected) return false; // 設定ミス時は拒否側に倒す
  return req.cookies.get(AUTH_COOKIE)?.value === expected;
}

/**
 * Route Handler の先頭で呼ぶ。未認証なら返り値をそのまま return する。
 *
 * proxy.ts でも同じチェックをしているが、Next.js のドキュメント
 * (02-guides/authentication.md) が「Proxy を唯一の防御線にするな。
 * チェックはデータソースの近くで行え」と明記しているため二重化している。
 */
export function requireAuth(req: NextRequest): NextResponse | null {
  if (!getExpectedToken()) {
    console.error('AUTH_PASSCODE is not configured');
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }
  if (!isAuthenticated(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}
