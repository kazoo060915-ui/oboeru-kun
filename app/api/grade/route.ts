import { NextRequest, NextResponse } from 'next/server';
import { gradeAnswer, GradeUnavailableError } from '@/lib/anthropic';
import { normalizeCoach } from '@/lib/coach';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { addDaysStr } from '@/lib/date';
import { INTERVALS, SCORE_PROMOTE, SCORE_KEEP } from '@/lib/constants';

export async function POST(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  try {
    const { term, note, answer, termId, currentLevel = 0, coach = 'osaka', userName = 'あなた' } = await req.json();

    if (!term) {
      return NextResponse.json({ error: 'Term is required' }, { status: 400 });
    }

    const useDb = Boolean(isSupabaseConfigured && supabase && termId);

    // 1. Anthropic API で採点。DBを使う場合は、レベル計算の基準にする「今のレベル」も
    //    並行して取得する。クライアントが送ってくる currentLevel は自己申告値で、
    //    複数端末での同時操作や改ざんに対して信頼できない
    //    （2.5 のような不正値だと INTERVALS[lvl] が undefined になり日付計算が NaN で壊れる、
    //    4 を送り続ければ1回の高得点で最長間隔まで飛べる、等）。
    const [result, dbLevelRes] = await Promise.all([
      gradeAnswer(term, note || '', answer || '', normalizeCoach(coach), userName?.trim() || 'あなた'),
      useDb ? supabase!.from('terms').select('level').eq('id', termId).eq('user_id', 'default_user').single() : Promise.resolve(null),
    ]);

    let baseLevel: number;
    if (useDb) {
      if (!dbLevelRes || dbLevelRes.error || !dbLevelRes.data) {
        console.error('Supabase fetch term level before grading failed:', dbLevelRes?.error);
        return NextResponse.json(
          { error: '採点はできたけど、対象の用語が見つからんかった。ページを再読み込みしてみて。' },
          { status: 404 }
        );
      }
      baseLevel = dbLevelRes.data.level;
    } else {
      // Supabase 未設定（デモモード）等、DB を持たない経路のみクライアント申告値を使う。
      // その場合も範囲外・非整数は捨てて 0 に倒す。
      baseLevel = Number.isInteger(currentLevel) && currentLevel >= 0 && currentLevel < INTERVALS.length ? currentLevel : 0;
    }

    // 2. レベルおよび次回復習日の計算
    const score = result.score;
    const lvl =
      score >= SCORE_PROMOTE
        ? Math.min(baseLevel + 1, INTERVALS.length - 1)
        : score >= SCORE_KEEP
        ? baseLevel
        : 0;

    const nextReviewAt = addDaysStr(INTERVALS[lvl]);

    // 3. Supabaseが使える場合はDBの更新・履歴追加
    if (useDb) {
      // 用語更新。
      // 以前は error を見ずに握り潰していたため、保存に失敗しても画面上は
      // レベルが上がったように見え、翌日また同じ用語が出てくるだけで
      // 原因が分からなかった。保存できなかったなら、はっきりそう返す。
      // 加えて .update() は対象行が0件でもエラーにならないため、
      // 削除済み・存在しない termId を渡された場合に「保存できたのに何も
      // 変わっていない」という事故が起きる。.select('id') で実際に
      // 更新された行を確認する。
      const { data: updatedRows, error: updateError } = await supabase!
        .from('terms')
        .update({
          level: lvl,
          next_review_at: nextReviewAt,
          last_score: score,
        })
        .eq('id', termId)
        .eq('user_id', 'default_user')
        .select('id');

      if (updateError) {
        console.error('Supabase update term after grading failed:', updateError);
        return NextResponse.json(
          { error: '採点はできたけど、結果の保存に失敗した。もう一回試してみて。' },
          { status: 500 }
        );
      }

      if (!updatedRows || updatedRows.length === 0) {
        console.error('Supabase update term after grading affected 0 rows. termId:', termId);
        return NextResponse.json(
          { error: '採点はできたけど、対象の用語が見つからんかった。ページを再読み込みしてみて。' },
          { status: 404 }
        );
      }

      // レビュー履歴追加。
      // こちらは失敗しても復習サイクル自体は成立するので、ログだけ残して続行する。
      const { error: reviewError } = await supabase!.from('reviews').insert({
        term_id: termId,
        score,
        answer_text: answer || '(わからん)',
        tsukkomi: result.tsukkomi,
        correct: result.correct,
        missed_keywords: result.missed || [],
        mission: result.mission,
      });

      if (reviewError) {
        console.error('Supabase insert review failed:', reviewError);
      }
    }

    return NextResponse.json({
      result,
      updatedLevel: lvl,
      nextReviewAt,
      lastScore: score,
    });
  } catch (error: unknown) {
    // 採点が成立しなかった場合。ここまで来ていれば DB は一切触っていないので、
    // 用語のレベルも次回復習日も元のまま（＝また出題される）。
    if (error instanceof GradeUnavailableError) {
      console.error('Grade unavailable:', error.cause ?? error);
      return NextResponse.json({ error: error.message }, { status: 503 });
    }

    console.error('Grade API Error:', error);
    return NextResponse.json(
      { error: '採点でコケた。もう一回「答える」を押してみて。' },
      { status: 500 }
    );
  }
}
