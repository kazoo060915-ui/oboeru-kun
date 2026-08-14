import { NextRequest, NextResponse } from 'next/server';
import { gradeAnswer } from '@/lib/anthropic';
import { normalizeCoach } from '@/lib/coach';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { addDaysStr } from '@/lib/date';
import { INTERVALS } from '@/lib/constants';

export async function POST(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  try {
    const { term, note, answer, termId, currentLevel = 0, coach = 'osaka' } = await req.json();

    if (!term) {
      return NextResponse.json({ error: 'Term is required' }, { status: 400 });
    }

    // 1. Anthropic API で採点
    const result = await gradeAnswer(term, note || '', answer || '', normalizeCoach(coach));

    // 2. レベルおよび次回復習日の計算
    const score = result.score;
    const lvl =
      score >= 80
        ? Math.min(currentLevel + 1, INTERVALS.length - 1)
        : score >= 50
        ? currentLevel
        : 0;

    const nextReviewAt = addDaysStr(INTERVALS[lvl]);

    // 3. Supabaseが使える場合はDBの更新・履歴追加
    if (isSupabaseConfigured && supabase && termId) {
      // 用語更新
      await supabase
        .from('terms')
        .update({
          level: lvl,
          next_review_at: nextReviewAt,
          last_score: score,
        })
        .eq('id', termId);

      // レビュー履歴追加
      await supabase.from('reviews').insert({
        term_id: termId,
        score,
        answer_text: answer || '(わからん)',
        tsukkomi: result.tsukkomi,
        correct: result.correct,
        missed_keywords: result.missed || [],
        mission: result.mission,
      });
    }

    return NextResponse.json({
      result,
      updatedLevel: lvl,
      nextReviewAt,
      lastScore: score,
    });
  } catch (error: any) {
    console.error('Grade API Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to grade answer' },
      { status: 500 }
    );
  }
}
