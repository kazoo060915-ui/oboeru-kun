import { NextRequest, NextResponse } from 'next/server';
import { gradeAnswer, GradeUnavailableError, GradeResult } from '@/lib/anthropic';
import { normalizeCoach } from '@/lib/coach';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { addDaysStr } from '@/lib/date';
import { INTERVALS, SCORE_PROMOTE, SCORE_KEEP } from '@/lib/constants';

// 採点解説は長文（15秒前後）になるため、HTTPレスポンス自体をNDJSON
// （改行区切りJSON）でストリーミングする。1行が1イベント:
//   {"type":"partial","partial":{...}}  … 点数・ツッコミ・解説等が確定した順に流れる
//   {"type":"final",...}                … 採点確定＋DB更新後の最終結果
//   {"type":"error","error":"..."}      … 採点不成立（この場合DBは一切触っていない）
// エラーもボディに乗せて返すため、レスポンス自体のHTTPステータスは常に200。

export async function POST(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const {
    term,
    note,
    answer,
    termId,
    currentLevel = 0,
    currentNextReviewAt,
    isAheadOfSchedule = false,
    coach = 'osaka',
    userName = 'あなた',
  } = await req.json();

  if (!term) {
    return NextResponse.json({ error: 'Term is required' }, { status: 400 });
  }

  const useDb = Boolean(isSupabaseConfigured && supabase && termId);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: unknown) => controller.enqueue(encoder.encode(JSON.stringify(obj) + '\n'));

      try {
        // 1. Anthropic API で採点。DBを使う場合は、レベル計算の基準にする「今のレベル・
        //    今の次回復習日」も並行して取得する。クライアントが送ってくる currentLevel は
        //    自己申告値で、複数端末での同時操作や改ざんに対して信頼できない
        //    （2.5 のような不正値だと INTERVALS[lvl] が undefined になり日付計算が NaN で壊れる、
        //    4 を送り続ければ1回の高得点で最長間隔まで飛べる、等）。
        const [result, dbLevelRes] = await Promise.all([
          gradeAnswer(
            term,
            note || '',
            answer || '',
            normalizeCoach(coach),
            userName?.trim() || 'あなた',
            (partial: Partial<GradeResult>) => send({ type: 'partial', partial })
          ),
          useDb
            ? supabase!.from('terms').select('level, next_review_at').eq('id', termId).eq('user_id', 'default_user').single()
            : Promise.resolve(null),
        ]);

        let baseLevel: number;
        let existingNextReviewAt: string | null = null;
        if (useDb) {
          if (!dbLevelRes || dbLevelRes.error || !dbLevelRes.data) {
            console.error('Supabase fetch term level before grading failed:', dbLevelRes?.error);
            send({ type: 'error', error: '採点はできたけど、対象の用語が見つからんかった。ページを再読み込みしてみて。' });
            return;
          }
          baseLevel = dbLevelRes.data.level;
          existingNextReviewAt = dbLevelRes.data.next_review_at;
        } else {
          // Supabase 未設定（デモモード）等、DB を持たない経路のみクライアント申告値を使う。
          // その場合も範囲外・非整数は捨てて 0 に倒す。
          baseLevel = Number.isInteger(currentLevel) && currentLevel >= 0 && currentLevel < INTERVALS.length ? currentLevel : 0;
          existingNextReviewAt = typeof currentNextReviewAt === 'string' ? currentNextReviewAt : null;
        }

        // 2. レベルおよび次回復習日の計算
        const score = result.score;
        const lvl =
          score >= SCORE_PROMOTE
            ? Math.min(baseLevel + 1, INTERVALS.length - 1)
            : score >= SCORE_KEEP
            ? baseLevel
            : 0;

        let nextReviewAt = addDaysStr(INTERVALS[lvl]);

        // 「先取り復習」「集中特訓」は、まだ復習日が来ていない用語を forceAll で
        // 前倒しして出題する。以前はこの経路も通常の復習と全く同じ計算式を通していたため、
        // 復習日を無視して答えるほど間隔が伸び、忘却曲線に沿ってシステム側がタイミングを
        // 管理するという設計思想が崩れていた（集中特訓を数回まわすと全用語がLv.4/30日後に
        // 到達してしまう）。前倒しで解いた場合は、計算結果が元の予定日より前（＝間隔を
        // 縮める方向）のときだけ採用し、元の予定日より後ろに延ばすことはしない。
        if (isAheadOfSchedule && existingNextReviewAt && existingNextReviewAt < nextReviewAt) {
          nextReviewAt = existingNextReviewAt;
        }

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
            send({ type: 'error', error: '採点はできたけど、結果の保存に失敗した。もう一回試してみて。' });
            return;
          }

          if (!updatedRows || updatedRows.length === 0) {
            console.error('Supabase update term after grading affected 0 rows. termId:', termId);
            send({ type: 'error', error: '採点はできたけど、対象の用語が見つからんかった。ページを再読み込みしてみて。' });
            return;
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

        send({
          type: 'final',
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
          send({ type: 'error', error: error.message });
        } else {
          console.error('Grade API Error:', error);
          send({ type: 'error', error: '採点でコケた。もう一回「答える」を押してみて。' });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
