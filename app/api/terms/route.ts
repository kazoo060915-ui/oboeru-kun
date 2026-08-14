import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured, Term } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { todayStr } from '@/lib/date';

// 関数にしているのは、モジュール読み込み時ではなく呼び出し時の日付を使うため。
// 定数のままだとサーバーが起動しっぱなしの間ずっと起動日が入り続ける。
const buildDefaultSeed = (): Omit<Term, 'id'>[] => [
  { user_id: 'default_user', term: 'useState', note: 'kazu-dashboardのタスクリストで使った', level: 0, next_review_at: todayStr(), last_score: null },
  { user_id: 'default_user', term: 'useEffect', note: '週間カレンダーの初期読み込みで使った', level: 0, next_review_at: todayStr(), last_score: null },
  { user_id: 'default_user', term: 'props', note: 'Reactコンポーネント間のデータ受け渡し', level: 0, next_review_at: todayStr(), last_score: null },
  { user_id: 'default_user', term: 'SSR / SSG / ISR', note: 'Next.jsのレンダリング戦略。第9回講義', level: 0, next_review_at: todayStr(), last_score: null },
  { user_id: 'default_user', term: 'JSX', note: 'HTMLっぽく書けるやつ', level: 0, next_review_at: todayStr(), last_score: null },
  { user_id: 'default_user', term: 'commit / push', note: 'Git。ローカルとGitHubの関係がややこしい', level: 0, next_review_at: todayStr(), last_score: null },
  { user_id: 'default_user', term: 'function calling', note: 'AIエージェント回。LLMが道具を呼ぶ仕組み', level: 0, next_review_at: todayStr(), last_score: null },
  { user_id: 'default_user', term: 'コンテキストウィンドウ', note: 'AIが一度に読める量', level: 0, next_review_at: todayStr(), last_score: null },
];

export async function GET(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('terms')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase fetch terms error:', error);
      return NextResponse.json({ error: '用語の読み込みに失敗しました。' }, { status: 500 });
    }

    // 初回テーブル作成直後でデータが0件の場合、初期シードを自動登録
    if (!data || data.length === 0) {
      const { data: seeded, error: seedError } = await supabase
        .from('terms')
        .insert(buildDefaultSeed())
        .select();

      if (!seedError && seeded) {
        return NextResponse.json({ terms: seeded, isSupabase: true });
      }
    }

    return NextResponse.json({ terms: data || [], isSupabase: true });
  }

  return NextResponse.json({
    terms: buildDefaultSeed().map((t, i) => ({ ...t, id: `t${i}` })),
    isSupabase: false,
  });
}

export async function POST(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  try {
    const { term, note, tag } = await req.json();
    if (!term || !term.trim()) {
      return NextResponse.json({ error: 'Term is required' }, { status: 400 });
    }

    const newTermData = {
      user_id: 'default_user',
      term: term.trim(),
      note: (note || '').trim(),
      tag: (tag || '').trim(),
      level: 0,
      next_review_at: todayStr(),
      last_score: null,
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('terms')
        .insert(newTermData)
        .select()
        .single();

      if (error) {
        // 以前はここで「tagカラムが無いのだろう」と決めつけて tag を外して
        // 再試行し、成功扱いにしていた。実際には制約違反もネットワークエラーも
        // 同じ経路に落ちるため、真の原因が握り潰されていた（そして tag は
        // DB に列が無かった間、100% 黙って捨てられていた）。
        console.error('Supabase insert term error:', error);
        return NextResponse.json({ error: '用語の追加に失敗しました。' }, { status: 500 });
      }

      return NextResponse.json({ term: data });
    }

    const createdTerm: Term = {
      id: `t${Date.now()}`,
      ...newTermData,
    };

    return NextResponse.json({ term: createdTerm });
  } catch (error) {
    // 内部エラーの詳細はサーバーログにだけ残す（クライアントへ返すと
    // DB のテーブル名やドライバの内部事情が漏れる）
    console.error('POST /api/terms failed:', error);
    return NextResponse.json({ error: '用語の追加に失敗しました。' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  try {
    const { id, term, note, tag, level, next_review_at } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Term ID is required' }, { status: 400 });
    }

    const updates: Partial<Term> = {};
    if (term !== undefined) updates.term = term.trim();
    if (note !== undefined) updates.note = (note || '').trim();
    if (tag !== undefined) updates.tag = tag.trim();
    if (level !== undefined) updates.level = level;
    if (next_review_at !== undefined) updates.next_review_at = next_review_at;

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('terms')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Supabase update term error:', error);
        return NextResponse.json({ error: '用語の更新に失敗しました。' }, { status: 500 });
      }

      return NextResponse.json({ term: data });
    }

    return NextResponse.json({ term: { id, ...updates } });
  } catch (error) {
    console.error('PATCH /api/terms failed:', error);
    return NextResponse.json({ error: '用語の更新に失敗しました。' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');

    if (!id) {
      try {
        const body = await req.json();
        id = body.id;
      } catch {
        // bodyが空の場合は無視
      }
    }

    if (!id) {
      return NextResponse.json({ error: 'Term ID is required' }, { status: 400 });
    }

    if (isSupabaseConfigured && supabase) {
      // 関連するレビュー履歴も削除（Cascade設定がない場合の安全策）
      await supabase.from('reviews').delete().eq('term_id', id);

      const { error } = await supabase
        .from('terms')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Supabase delete term error:', error);
        return NextResponse.json({ error: '用語の削除に失敗しました。' }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('DELETE /api/terms failed:', error);
    return NextResponse.json({ error: '用語の削除に失敗しました。' }, { status: 500 });
  }
}

