import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured, Term } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { todayStr } from '@/lib/date';
import { INTERVALS } from '@/lib/constants';

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

const DEFAULT_USER = 'default_user';

/**
 * 初期シードを「まだ一度も入れていない」かどうか。
 *
 * 以前は「terms が0件なら初回」と判定していたため、自分で登録した用語を
 * 全部整理して0件にした瞬間、次のリロードで useState / useEffect / props …
 * が8件また生えてきて、永久に空にできなかった。
 * user_settings.seeded_at を実際の目印として使う。
 *
 * 判定できないとき（マイグレーション未適用など）は「シード済み」に倒す。
 * 勝手に用語が復活する方が、シードが出ないことより害が大きい。
 */
async function hasSeededBefore(): Promise<boolean> {
  if (!supabase) return true;

  const { data, error } = await supabase
    .from('user_settings')
    .select('seeded_at')
    .eq('user_id', DEFAULT_USER)
    .maybeSingle();

  if (error) {
    console.error('Failed to read seed marker (treating as already seeded):', error);
    return true;
  }

  return Boolean(data?.seeded_at);
}

async function markSeeded(): Promise<void> {
  if (!supabase) return;

  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: DEFAULT_USER, seeded_at: new Date().toISOString() }, { onConflict: 'user_id' });

  if (error) {
    console.error('Failed to write seed marker:', error);
  }
}

export async function GET(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  if (isSupabaseConfigured && supabase) {
    const { data, error } = await supabase
      .from('terms')
      .select('*')
      .eq('user_id', DEFAULT_USER)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase fetch terms error:', error);
      return NextResponse.json({ error: '用語の読み込みに失敗しました。' }, { status: 500 });
    }

    // 本当の初回（まだ一度もシードしていない）のときだけ初期シードを登録する
    if ((!data || data.length === 0) && !(await hasSeededBefore())) {
      const { data: seeded, error: seedError } = await supabase
        .from('terms')
        .insert(buildDefaultSeed())
        .select();

      if (!seedError && seeded) {
        await markSeeded();
        return NextResponse.json({ terms: seeded, isSupabase: true });
      }

      if (seedError) {
        console.error('Supabase seed terms error:', seedError);
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
      user_id: DEFAULT_USER,
      term: term.trim(),
      note: (note || '').trim(),
      tag: (tag || '').trim(),
      level: 0,
      next_review_at: todayStr(),
      last_score: null,
    };

    if (isSupabaseConfigured && supabase) {
      // 重複チェック。以前は無く、解説画面の「＋追加」を2回押すと
      // 同じ用語が2件登録され、復習キューに同じお題が並んでいた。
      // ilike をワイルドカード無しで使う＝大文字小文字を無視した完全一致。
      // ただし用語名自体に含まれる _ と % は LIKE のワイルドカードとして
      // 解釈されてしまうため（user_id が userXid に一致するなど）、
      // 別物を「登録済み」と誤判定しないようエスケープする。
      const likePattern = newTermData.term.replace(/[\\%_]/g, (c: string) => `\\${c}`);
      const { data: existing, error: dupCheckError } = await supabase
        .from('terms')
        .select('id, term')
        .eq('user_id', DEFAULT_USER)
        .ilike('term', likePattern)
        .limit(1);

      if (dupCheckError) {
        console.error('Supabase duplicate check error:', dupCheckError);
        return NextResponse.json({ error: '用語の追加に失敗しました。' }, { status: 500 });
      }

      if (existing && existing.length > 0) {
        return NextResponse.json(
          { error: `「${existing[0].term}」はもう単語帳に入ってるで！` },
          { status: 409 }
        );
      }

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

    // level・next_review_at は編集モーダルの日付入力等、クライアントからの
    // 自由入力を無検証で DB に渡していた。空文字の日付や範囲外の level は
    // Postgres の型・check 制約でエラーになるが、原因不明の 500 として
    // 現れるだけだったので、ここで弾いてはっきりした理由を返す。
    if (level !== undefined && (!Number.isInteger(level) || level < 0 || level > INTERVALS.length - 1)) {
      return NextResponse.json(
        { error: `level は 0〜${INTERVALS.length - 1} の整数で指定してください。` },
        { status: 400 }
      );
    }
    if (next_review_at !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(next_review_at)) {
      return NextResponse.json(
        { error: '次回復習日は YYYY-MM-DD 形式で指定してください。' },
        { status: 400 }
      );
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
        .eq('user_id', DEFAULT_USER)
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
        .eq('id', id)
        .eq('user_id', DEFAULT_USER);

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

