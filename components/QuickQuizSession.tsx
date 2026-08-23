'use client';

import React, { useState, useEffect } from 'react';
import { Term, getTermTag } from '@/lib/types';
import { CoachType } from '@/lib/coach';
import { MultipleChoiceQuiz, MultipleChoiceOption } from '@/lib/anthropic';
import { triggerScoreEffects } from '@/lib/effects';

interface QuickQuizSessionProps {
  term: Term;
  coach: CoachType;
  userName: string;
  sessionIndex: number;
  sessionLimit: number;
  today: string;
  onAnswerSaved: (data: {
    isCorrect: boolean;
    score: number;
    updatedLevel: number;
    nextReviewAt: string;
    lastScore: number;
  }) => void;
  onNext: () => void;
  onExit: () => void;
  onDeleteTerm: () => void;
}

export default function QuickQuizSession({
  term,
  coach,
  userName,
  sessionIndex,
  sessionLimit,
  today,
  onAnswerSaved,
  onNext,
  onExit,
  onDeleteTerm,
}: QuickQuizSessionProps) {
  const [loading, setLoading] = useState(true);
  const [quiz, setQuiz] = useState<MultipleChoiceQuiz | null>(null);
  const [error, setError] = useState('');
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [showHint, setShowHint] = useState(false);

  // 用語が変わるたびに4択問題を生成
  useEffect(() => {
    let isCancelled = false;

    async function loadQuiz() {
      setLoading(true);
      setError('');
      setSelectedIndex(null);
      setIsAnswered(false);
      setShowHint(false);

      try {
        const res = await fetch('/api/quiz/mcq/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            term: term.term,
            note: term.note,
            coach,
            userName,
          }),
        });

        if (!res.ok) {
          throw new Error('4択問題の生成に失敗しました。');
        }

        const data = await res.json();
        if (!isCancelled) {
          if (data.quiz) {
            setQuiz(data.quiz);
          } else {
            throw new Error('問題データの読み取りに失敗しました。');
          }
        }
      } catch (err: unknown) {
        if (!isCancelled) {
          console.error('Failed to load MCQ quiz:', err);
          setError('問題の読み込みに失敗しました。もう一度お試しください。');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    loadQuiz();

    return () => {
      isCancelled = true;
    };
  }, [term, coach, userName]);

  // 選択肢を選択した時の処理
  const handleSelectChoice = async (index: number) => {
    if (isAnswered || !quiz) return;

    const chosen = quiz.choices[index];
    setSelectedIndex(index);
    setIsAnswered(true);

    const isCorrect = chosen.isCorrect;
    const score = isCorrect ? 85 : 30;

    // 演出発火（桜吹雪やシェイク）
    triggerScoreEffects(score, false);

    // 回答をサーバーに記録してレベル/忘却曲線を更新
    try {
      const res = await fetch('/api/quiz/mcq/answer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          termId: term.id,
          term: term.term,
          isCorrect,
          choiceText: chosen.text,
          currentLevel: term.level,
          currentNextReviewAt: term.next_review_at,
          isAheadOfSchedule: term.next_review_at > today,
          coach,
          userName,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        onAnswerSaved({
          isCorrect,
          score: data.score,
          updatedLevel: data.updatedLevel,
          nextReviewAt: data.nextReviewAt,
          lastScore: data.lastScore,
        });
      }
    } catch (err) {
      console.error('Failed to save MCQ answer:', err);
    }
  };

  const selectedChoice = selectedIndex !== null && quiz ? quiz.choices[selectedIndex] : null;

  return (
    <div className="space-y-4">
      {/* 進行度バー */}
      {sessionLimit > 0 && (
        <div className="border-2 border-[#1A1714] bg-[#F7F1E3] px-4 py-2.5 shadow-[3px_3px_0_0_#1A1714]">
          <div className="flex items-center justify-between text-xs font-mono font-bold">
            <span className="text-[#B83227] flex items-center gap-1">
              <span>⚡ 特急復習</span>
              <span>第 {sessionIndex} / {sessionLimit} 問</span>
            </span>
            <span className="text-[#1A1714]/60">
              残り {Math.max(0, sessionLimit - sessionIndex + 1)} 問
            </span>
          </div>
          <div className="mt-1.5 h-2 w-full border border-[#1A1714]/30 bg-white/70">
            <div
              className="h-full bg-[#B83227] transition-all duration-300"
              style={{ width: `${Math.min(100, (sessionIndex / sessionLimit) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* メイン出題カード */}
      <div className="border-2 border-[#1A1714] bg-[#F7F1E3] p-6 shadow-[6px_6px_0_0_#1A1714]">
        <div className="flex items-center justify-between">
          <button
            onClick={onExit}
            title="この用語には答えず、記録を汚さずにホームへ戻る"
            className="font-mono text-xs tracking-widest text-[#1A1714]/60 hover:text-[#1A1714] hover:underline"
          >
            ← 中断する
          </button>
          <div className="flex items-center gap-2">
            <span className="border border-[#1A1714] bg-[#D9A441]/20 px-2 py-0.5 font-mono text-[11px] font-bold text-[#8a6300]">
              ⚡ 4択モード
            </span>
            <span className="border border-[#1A1714] bg-white px-2 py-0.5 font-mono text-[11px] font-bold text-[#1A1714]">
              🏷️ {getTermTag(term)}
            </span>
            <button
              onClick={onDeleteTerm}
              title="この用語を復習から除外（削除）する"
              className="flex items-center gap-1 border border-[#B83227]/40 bg-white px-2 py-0.5 font-mono text-[11px] font-bold text-[#B83227] hover:bg-[#B83227] hover:text-white transition-colors"
            >
              🗑️ 除外
            </button>
          </div>
        </div>

        {/* 用語名 */}
        <h2 className="mt-2 font-serif text-3xl font-bold text-[#1A1714]">{term.term}</h2>
        <div className="mt-2 h-1 w-24 bg-[#B83227]" />

        {/* ヒント */}
        {term.note && (
          <div className="mt-3">
            {!showHint ? (
              <button
                onClick={() => setShowHint(true)}
                className="flex items-center gap-1.5 border border-[#D9A441] bg-[#D9A441]/10 px-3 py-1.5 font-mono text-xs font-bold text-[#8a6300] hover:bg-[#D9A441]/30 transition-colors"
              >
                💡 ヒントを見る
              </button>
            ) : (
              <div className="border-l-4 border-[#D9A441] bg-[#D9A441]/10 px-3 py-2">
                <p className="font-mono text-[10px] font-bold tracking-widest text-[#8a6300]">HINT</p>
                <p className="mt-0.5 text-sm text-[#1A1714]/80">{term.note}</p>
              </div>
            )}
          </div>
        )}

        {/* 問題文エリア */}
        {loading ? (
          <div className="my-8 flex flex-col items-center justify-center space-y-3 py-6">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1A1714] border-t-[#B83227]" />
            <p className="font-mono text-xs font-bold text-[#1A1714]/70">
              AIが4択問題を生成中…（約1秒）
            </p>
          </div>
        ) : error ? (
          <div className="my-6 border-2 border-[#B83227] bg-[#B83227]/10 p-4 text-center">
            <p className="text-sm font-bold text-[#B83227]">{error}</p>
            <button
              onClick={onNext}
              className="mt-3 border-2 border-[#1A1714] bg-white px-4 py-2 text-xs font-bold hover:bg-[#1A1714] hover:text-white"
            >
              次のお題へスキップ
            </button>
          </div>
        ) : quiz ? (
          <div className="mt-5 space-y-4">
            {/* 問題文 */}
            <div className="rounded border-2 border-[#1A1714] bg-white p-3.5 shadow-[2px_2px_0_0_#1A1714]">
              <p className="text-xs font-bold text-[#8a6300] mb-1">
                💬 {quiz.coachPrompt || '適切な説明を選んでや！'}
              </p>
              <p className="font-bold text-sm sm:text-base text-[#1A1714] leading-relaxed">
                {quiz.question}
              </p>
            </div>

            {/* 4択ボタン一覧 */}
            <div className="grid grid-cols-1 gap-2.5 sm:gap-3">
              {quiz.choices.map((choice: MultipleChoiceOption, index: number) => {
                const isThisSelected = selectedIndex === index;
                const isCorrect = choice.isCorrect;

                let buttonStyle = 'border-[#1A1714] bg-white hover:bg-[#F7F1E3] hover:border-[#1A1714]';
                let badge = null;

                if (isAnswered) {
                  if (isCorrect) {
                    // 正解の選択肢
                    buttonStyle = 'border-[#2e7d32] bg-[#e8f5e9] text-[#1b5e20] shadow-[3px_3px_0_0_#2e7d32] ring-2 ring-[#2e7d32]';
                    badge = (
                      <span className="shrink-0 rounded bg-[#2e7d32] px-2 py-0.5 text-[11px] font-bold text-white">
                        ⭕ 正解
                      </span>
                    );
                  } else if (isThisSelected) {
                    // 不正解を選んでしまった選択肢
                    buttonStyle = 'border-[#B83227] bg-[#ffebee] text-[#b71c1c] shadow-[3px_3px_0_0_#B83227]';
                    badge = (
                      <span className="shrink-0 rounded bg-[#B83227] px-2 py-0.5 text-[11px] font-bold text-white">
                        ❌ あなたの選択
                      </span>
                    );
                  } else {
                    // 選ばなかった不正解
                    buttonStyle = 'border-[#1A1714]/20 bg-white/60 text-[#1A1714]/40 opacity-70';
                  }
                }

                return (
                  <div key={index} className="space-y-1.5">
                    <button
                      onClick={() => handleSelectChoice(index)}
                      disabled={isAnswered}
                      className={`w-full border-2 p-3.5 text-left transition-all flex items-start justify-between gap-3 shadow-[2px_2px_0_0_#1A1714] ${buttonStyle} ${
                        !isAnswered ? 'cursor-pointer active:translate-y-0.5 active:shadow-none' : 'cursor-default'
                      }`}
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current font-mono text-xs font-bold ${
                            isAnswered && isCorrect ? 'bg-[#2e7d32] text-white' : ''
                          }`}
                        >
                          {index + 1}
                        </span>
                        <span className="font-bold text-sm leading-relaxed">{choice.text}</span>
                      </div>
                      {badge}
                    </button>

                    {/* 回答後の解説テキスト表示 */}
                    {isAnswered && (isCorrect || isThisSelected) && (
                      <div
                        className={`ml-3 rounded-b border-l-4 p-2.5 text-xs leading-relaxed ${
                          isCorrect
                            ? 'border-[#2e7d32] bg-[#e8f5e9]/70 text-[#1b5e20]'
                            : 'border-[#B83227] bg-[#ffebee]/70 text-[#b71c1c]'
                        }`}
                      >
                        <p className="font-bold">
                          {isCorrect ? '💡 解説' : '⚠️ 惜しい！'}: {choice.explanation}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      {/* 回答後の次へ進むアクションバー */}
      {isAnswered && (
        <div
          className="sticky bottom-0 z-10 flex gap-3 border-t-2 border-[#1A1714] bg-[#D9A441] p-4 shadow-[0_-4px_6px_rgba(0,0,0,0.05)]"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="flex-1 flex items-center">
            <span className="font-bold text-sm text-[#1A1714]">
              {selectedChoice?.isCorrect ? '🎉 正解！ナイス！' : '💪 間違えても大丈夫！次は取れる！'}
            </span>
          </div>
          <button
            onClick={onNext}
            className="border-2 border-[#1A1714] bg-[#B83227] px-6 py-3 font-bold text-[#F7F1E3] shadow-[3px_3px_0_0_#1A1714] hover:bg-[#9c2a20] active:translate-y-0.5 active:shadow-none transition-all flex items-center gap-1.5"
          >
            <span>次のお題へ</span>
            <span>➔</span>
          </button>
        </div>
      )}
    </div>
  );
}
