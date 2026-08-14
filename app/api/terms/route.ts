import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured, Term } from '@/lib/supabase';

const DEFAULT_SEED: Omit<Term, 'id'>[] = [
  { user_id: 'default_user', term: 'useState', note: 'kazu-dashboardのタスクリストで使った', level: 0, next_review_at: new Date().toISOString().slice(0, 10), last_score: null },
  { user_id: 'default_user', term: 'useEffect', note: '週間カレンダーの初期読み込みで使った', level: 0, next_review_at: new Date().toISOString().slice(0, 10), last_score: null },
  { user_id: 'default_user', term: 'props', note: 'Reactコンポーネント間のデータ受け渡し', level: 0, next_review_at: new Date().toISOString().slice(0, 10), last_score: null },
  { user_id: 'default_user', term: 'SSR / SSG / ISR', note: 'Next.jsのレンダリング戦略。第9回講義', level: 0, next_review_at: new Date().toISOString().slice(0, 10), last_score: null },
  { user_id: 'default_user', term: 'JSX', note: 'HTMLっぽく書けるやつ', level: 0, next_review_at: new Date().toISOString().slice(0, 10), last_score: null },
  { user_id: 'default_user', term: 'commit / push', note: 'Git。ローカルとGitHubの関係がややこしい', level: 0, next_review_at: new Date().toISOString().slice(0, 10), last_score: null },
  { user_id: 'default_user', term: 'function calling', note: 'AIエージェント回。LLMが道具を呼ぶ仕組み', level: 0, next_review_at: new Date().toISOString().slice(0, 10), last_score: null },
  { user_id: 'default_user', term: 'コンテキストウィンドウ', note: 'AIが一度に読める量', level: 0, next_review_at: new Date().toISOString().slice(0, 10), last_score: null },
];

export async function GET() {
  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('terms')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase fetch terms error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // 初回テーブル作成直後でデータが0件の場合、初期シードを自動登録
    if (!data || data.length === 0) {
      const { data: seeded, error: seedError } = await supabase
        .from('terms')
        .insert(DEFAULT_SEED)
        .select();

      if (!seedError && seeded) {
        return NextResponse.json({ terms: seeded, isSupabase: true });
      }
    }

    return NextResponse.json({ terms: data || [], isSupabase: true });
  }

  return NextResponse.json({
    terms: DEFAULT_SEED.map((t, i) => ({ ...t, id: `t${i}` })),
    isSupabase: false,
  });
}

export async function POST(req: NextRequest) {
  try {
    const { term, note } = await req.json();
    if (!term || !term.trim()) {
      return NextResponse.json({ error: 'Term is required' }, { status: 400 });
    }

    const newTermData = {
      user_id: 'default_user',
      term: term.trim(),
      note: (note || '').trim(),
      level: 0,
      next_review_at: new Date().toISOString().slice(0, 10),
      last_score: null,
    };

    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('terms')
        .insert(newTermData)
        .select()
        .single();

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ term: data });
    }

    const createdTerm: Term = {
      id: `t${Date.now()}`,
      ...newTermData,
    };

    return NextResponse.json({ term: createdTerm });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to add term' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, term, note, level, next_review_at } = await req.json();
    if (!id) {
      return NextResponse.json({ error: 'Term ID is required' }, { status: 400 });
    }

    const updates: Partial<Term> = {};
    if (term !== undefined) updates.term = term.trim();
    if (note !== undefined) updates.note = (note || '').trim();
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
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ term: data });
    }

    return NextResponse.json({ term: { id, ...updates } });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to update term' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
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
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, id });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to delete term' }, { status: 500 });
  }
}

