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

    // 1. Anthropic API で採点
    const result = await gradeAnswer(
      term,
      note || '',
      answer || '',
      normalizeCoach(coach),
      userName?.trim() || 'あなた'
    );

    // 2. レベルおよび次回復習日の計算
    const score = result.score;
    const lvl =
      score >= SCORE_PROMOTE
        ? Math.min(currentLevel + 1, INTERVALS.length - 1)
        : score >= SCORE_KEEP
        ? currentLevel
        : 0;

    const nextReviewAt = addDaysStr(INTERVALS[lvl]);

    // 3. Supabaseが使える場合はDBの更新・履歴追加
    if (isSupabaseConfigured && supabase && termId) {
      // 用語更新。
      // 以前は error を見ずに握り潰していたため、保存に失敗しても画面上は
      // レベルが上がったように見え、翌日また同じ用語が出てくるだけで
      // 原因が分からなかった。保存できなかったなら、はっきりそう返す。
      const { error: updateError } = await supabase
        .from('terms')
        .update({
          level: lvl,
          next_review_at: nextReviewAt,
          last_score: score,
        })
        .eq('id', termId);

      if (updateError) {
        console.error('Supabase update term after grading failed:', updateError);
        return NextResponse.json(
          { error: '採点はできたけど、結果の保存に失敗した。もう一回試してみて。' },
          { status: 500 }
        );
      }

      // レビュー履歴追加。
      // こちらは失敗しても復習サイクル自体は成立するので、ログだけ残して続行する。
      const { error: reviewError } = await supabase.from('reviews').insert({
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
