import 'server-only';

/**
 * ごく簡単なメモリ上のレート制限。
 *
 * パスコード認証は1本の短い文字列だけが防御なので、制限が無いと
 * 公開URLに対して総当たりが素通りする（1秒に何百回でも試せる）。
 *
 * 制約は正直に書いておく:
 * Vercel のサーバーレスはインスタンスごとに別メモリなので、これは
 * 「1インスタンスあたり」の制限にしかならず、完全な防御ではない。
 * それでも素朴な総当たりの速度は桁で落ちる。厳密にやるなら
 * Supabase のテーブルか Upstash 等の共有ストアに置き換えること。
 */

interface Attempt {
  count: number;
  firstAt: number;
}

const attempts = new Map<string, Attempt>();

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 10 * 60 * 1000; // 10分

/** Map が際限なく育たないよう、期限切れのエントリを掃除する */
function sweep(now: number) {
  for (const [key, attempt] of attempts) {
    if (now - attempt.firstAt > WINDOW_MS) attempts.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  /** 制限中の場合、あと何秒待てば解除されるか */
  retryAfterSec: number;
}

/** 試行を1回記録し、上限を超えていないか返す */
export function hitRateLimit(key: string): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const current = attempts.get(key);

  if (!current || now - current.firstAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: now });
    return { allowed: true, retryAfterSec: 0 };
  }

  current.count += 1;

  if (current.count > MAX_ATTEMPTS) {
    const retryAfterSec = Math.ceil((WINDOW_MS - (now - current.firstAt)) / 1000);
    return { allowed: false, retryAfterSec };
  }

  return { allowed: true, retryAfterSec: 0 };
}

/** 認証に成功したら、そのキーの失敗回数を捨てる */
export function clearRateLimit(key: string) {
  attempts.delete(key);
}

/** リクエスト元の識別子。プロキシ配下なので x-forwarded-for を優先する */
export function clientKey(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return headers.get('x-real-ip') || 'unknown';
}
