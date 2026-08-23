import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { addDaysStr } from '@/lib/date';
import { INTERVALS } from '@/lib/constants';

export async function POST(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  try {
    const {
      termId,
      term,
      isCorrect,
      choiceText = '',
      currentLevel = 0,
      currentNextReviewAt,
      isAheadOfSchedule = false,
      coach = 'osaka',
      userName = 'あなた',
    } = await req.json();

    if (!term || typeof term !== 'string') {
      return NextResponse.json({ error: 'Term is required' }, { status: 400 });
    }

    const useDb = Boolean(isSupabaseConfigured && supabase && termId);

    let baseLevel = Number.isInteger(currentLevel) && currentLevel >= 0 && currentLevel < INTERVALS.length ? currentLevel : 0;
    let existingNextReviewAt: string | null = typeof currentNextReviewAt === 'string' ? currentNextReviewAt : null;

    if (useDb) {
      const { data: dbTerm, error: fetchErr } = await supabase!
        .from('terms')
        .select('level, next_review_at')
        .eq('id', termId)
        .eq('user_id', 'default_user')
        .single();

      if (!fetchErr && dbTerm) {
        baseLevel = dbTerm.level;
        existingNextReviewAt = dbTerm.next_review_at;
      }
    }

    // 4択問題のスコア＆レベル計算
    // 正解: 85点（合格）、不正解: 30点
    const score = isCorrect ? 85 : 30;
    const lvl = isCorrect ? Math.min(baseLevel + 1, INTERVALS.length - 1) : 0;
    let nextReviewAt = addDaysStr(INTERVALS[lvl]);

    // 先取り復習の場合は間隔を延ばさない（前倒し方向にしか動かさない）
    if (isAheadOfSchedule && existingNextReviewAt && existingNextReviewAt < nextReviewAt) {
      nextReviewAt = existingNextReviewAt;
    }

    // DB更新
    if (useDb) {
      const { error: updateErr } = await supabase!
        .from('terms')
        .update({
          level: lvl,
          next_review_at: nextReviewAt,
          last_score: score,
        })
        .eq('id', termId)
        .eq('user_id', 'default_user');

      if (updateErr) {
        console.error('Supabase update term error in MCQ answer:', updateErr);
      }

      // レビュー履歴
      const isOsaka = coach === 'osaka';
      const tsukkomi = isCorrect
        ? (isOsaka ? `${userName}、4択バッチリ正解や！この調子！` : `${userName}さん、正解です！素晴らしい！`)
        : (isOsaka ? `${userName}、惜しかったな！次はしっかり見極めよ！` : `${userName}さん、惜しかったです。復習して定着させましょう。`);

      await supabase!.from('reviews').insert({
        term_id: termId,
        score,
        answer_text: `(4択クイズ: ${choiceText || (isCorrect ? '正解' : '不正解')})`,
        tsukkomi,
        correct: `4択クイズ回答（${isCorrect ? '正解' : '不正解'}）`,
        missed_keywords: isCorrect ? [] : [term],
        mission: 'スキマ時間復習完了！',
      });
    }

    return NextResponse.json({
      score,
      updatedLevel: lvl,
      nextReviewAt,
      lastScore: score,
    });
  } catch (error: unknown) {
    console.error('API /api/quiz/mcq/answer error:', error);
    return NextResponse.json(
      { error: '回答の記録に失敗しました。' },
      { status: 500 }
    );
  }
}
