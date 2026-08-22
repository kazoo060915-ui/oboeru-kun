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

/**
 * リクエスト元の識別子。
 *
 * x-forwarded-for は「クライアント, プロキシ1, プロキシ2, ...」の順に
 * 積まれるヘッダで、左端（クライアントが自称する値）は誰でも自由に
 * 詐称できる。毎回ランダムな値を送られると、総当たりのたびに
 * 別キー扱いになって回数制限が一度も効かない。
 *
 * Vercel は x-vercel-forwarded-for にプラットフォーム側で検出した
 * 接続元を設定するため、あればそちらを優先する。無い場合は
 * x-forwarded-for の右端（＝アプリに一番近い中継地点が付けた値）を使う。
 * クライアントは自分より右には値を追記できないため、左端よりは詐称に強い
 * （ただし Vercel 以外にリバースプロキシを重ねる構成では、その挙動を
 * 別途確認すること）。
 */
export function clientKey(headers: Headers): string {
  const vercelForwarded = headers.get('x-vercel-forwarded-for');
  if (vercelForwarded) return vercelForwarded.split(',')[0].trim();

  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.length > 0) return parts[parts.length - 1];
  }

  return headers.get('x-real-ip') || 'unknown';
}
