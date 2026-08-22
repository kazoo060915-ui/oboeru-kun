import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { auditTerms } from '@/lib/anthropic';

const DEFAULT_USER = 'default_user';

// 1回のリクエストで判定する上限。多すぎるとAIの出力が max_tokens で
// 切れるため、クライアント側で分割して複数回呼ぶ想定。
const MAX_BATCH = 60;

/**
 * 登録済み用語の棚卸し判定。
 *
 * 判定するだけで削除は一切しない。何を消すかはユーザーが画面で選び、
 * 既存の DELETE /api/terms を通して1件ずつ削除する。
 */
export async function POST(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json(
      { error: 'DBが未設定のため棚卸しできません。' },
      { status: 501 }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const offset = Number.isInteger(body.offset) && body.offset >= 0 ? body.offset : 0;

    const { data, error } = await supabase
      .from('terms')
      .select('id, term, note, tag')
      .eq('user_id', DEFAULT_USER)
      .order('created_at', { ascending: false })
      .range(offset, offset + MAX_BATCH - 1);

    if (error) {
      console.error('Supabase fetch terms for audit failed:', error);
      return NextResponse.json({ error: '用語の読み込みに失敗しました。' }, { status: 500 });
    }

    const terms = data || [];
    if (terms.length === 0) {
      return NextResponse.json({ audits: [], terms: [], nextOffset: null, done: true });
    }

    const audits = await auditTerms(
      terms.map((t) => ({ id: t.id, term: t.term, note: t.note || '', tag: t.tag || '' }))
    );

    return NextResponse.json({
      audits,
      terms,
      nextOffset: terms.length === MAX_BATCH ? offset + MAX_BATCH : null,
      done: terms.length < MAX_BATCH,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : '棚卸しに失敗しました。';
    console.error('POST /api/terms/audit failed:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
