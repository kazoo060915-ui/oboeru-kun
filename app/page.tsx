'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Stamp from '@/components/Stamp';
import MicButton from '@/components/MicButton';
import AuthModal from '@/components/AuthModal';
import NotificationModal from '@/components/NotificationModal';
import FileImporter from '@/components/FileImporter';
import EditTermModal from '@/components/EditTermModal';
import { Term } from '@/lib/supabase';
import { CoachType, COACH_LIST } from '@/lib/anthropic';

const INTERVALS = [1, 3, 7, 14, 30];

const todayStr = () => new Date().toISOString().slice(0, 10);
const addDaysStr = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export default function Home() {
  const [terms, setTerms] = useState<Term[] | null>(null);
  const [view, setView] = useState<'home' | 'quiz' | 'result' | 'add'>('home');
  const [current, setCurrent] = useState<Term | null>(null);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<{
    score: number;
    tsukkomi: string;
    correct: string;
    missed: string[];
    mission: string;
  } | null>(null);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newTerm, setNewTerm] = useState('');
  const [newNote, setNewNote] = useState('');

  // 聞き返しチャット用
  const [chat, setChat] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  // ヒント表示状態
  const [showHint, setShowHint] = useState(false);

  // コーチキャラクター選択（localStorageで永続）
  const [coach, setCoach] = useState<CoachType>('osaka');
  const [showCoachMenu, setShowCoachMenu] = useState(false);

  // モーダル管理
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [editingTerm, setEditingTerm] = useState<Term | null>(null);

  // 認証チェック & 用語一覧の読み込み
  useEffect(() => {
    async function init() {
      // 1. 認証ステータスチェック
      try {
        const authRes = await fetch('/api/auth');
        const authData = await authRes.json();
        setIsAuthenticated(authData.authenticated);
      } catch {
        setIsAuthenticated(true); // エラー時はスキップ
      }

      // 2. 用語一覧取得
      try {
        const res = await fetch('/api/terms');
        const data = await res.json();
        if (data.terms) {
          setTerms(data.terms);
        }
      } catch (err) {
        console.error('Failed to load terms:', err);
        setError('用語の読み込みに失敗しました。');
      }
    }
    init();
  }, []);

  // coach を localStorage から復元
  useEffect(() => {
    const saved = localStorage.getItem('oboeru-coach') as CoachType | null;
    if (saved && COACH_LIST.find((c) => c.id === saved)) {
      setCoach(saved);
    }
  }, []);

  const selectCoach = (c: CoachType) => {
    setCoach(c);
    localStorage.setItem('oboeru-coach', c);
    setShowCoachMenu(false);
  };

  const today = todayStr();
  const due = (terms || []).filter((t) => t.next_review_at <= today);

  const startQuiz = (forceAll?: boolean) => {
    const targetPool = forceAll ? (terms || []) : due;
    if (targetPool.length === 0) return;
    const randomTerm = targetPool[Math.floor(Math.random() * targetPool.length)];
    setCurrent(randomTerm);
    setAnswer('');
    setResult(null);
    setChat([]);
    setChatInput('');
    setError('');
    setShowHint(false);
    setView('quiz');
  };

  const grade = async (overrideAnswer?: string) => {
    if (!current) return;
    setLoading(true);
    setError('');

    const textToSubmit = overrideAnswer !== undefined ? overrideAnswer : answer;

    try {
      const res = await fetch('/api/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term: current.term,
          note: current.note,
          answer: textToSubmit,
          termId: current.id,
          currentLevel: current.level,
          coach,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '採点エラー');
      }

      setResult(data.result);

      // 用語状態を更新
      if (terms) {
        const updatedTerms = terms.map((t) =>
          t.id === current.id
            ? {
                ...t,
                level: data.updatedLevel,
                next_review_at: data.nextReviewAt,
                last_score: data.lastScore,
              }
            : t
        );
        setTerms(updatedTerms);
      }

      setView('result');
    } catch (err: any) {
      setError(err?.message || '採点でコケた。もう一回「答える」を押してみて。');
    } finally {
      setLoading(false);
    }
  };

  const askChat = async (questionText?: string) => {
    if (!current || !result) return;
    const question = (questionText || chatInput).trim();
    if (!question || chatLoading) return;

    const nextChat = [...chat, { role: 'user' as const, content: question }];
    setChat(nextChat);
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term: current.term,
          note: current.note,
          answer,
          correct: result.correct,
          mission: result.mission,
          chatHistory: nextChat,
          coach,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setChat([...nextChat, { role: 'assistant', content: data.reply }]);
    } catch {
      setChat([
        ...nextChat,
        { role: 'assistant', content: 'ごめん、いま答えられへんかった。もっかい聞いて。' },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleAddTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTerm.trim()) return;

    try {
      const res = await fetch('/api/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ term: newTerm, note: newNote }),
      });
      const data = await res.json();

      if (data.term && terms) {
        setTerms([data.term, ...terms]);
      }
      setNewTerm('');
      setNewNote('');
      setView('home');
    } catch {
      setError('用語の追加に失敗しました。');
    }
  };

  // レベル別集計
  const levelCounts = [0, 1, 2, 3, 4].map(
    (lvl) => (terms || []).filter((t) => t.level === lvl).length
  );

  // コーチからの復習完了メッセージ
  const getCompletionMessage = (c: CoachType) => {
    switch (c) {
      case 'osaka':
        return '本日の復習全クリやん！完璧や！今日の積み重ねが未来の武器になるで！';
      case 'praise':
        return '今日のノルマ達成おめでとう！✨ 毎日コツコツ続けるあなた、本当に素晴らしいよ🌸';
      case 'mentor':
        return '本日の復習完了です。エビングハウスの忘却曲線に基づき、確実に記憶が定着しています。';
      case 'hotblood':
        return '今日の課題完全制覇だあああ！！お前のやる気、最高に燃え盛ってるぜッッ！！🔥';
      case 'sage':
        return 'フォッフォッフォ、見事じゃ。日々の精進こそが真の知恵へと至る道じゃよ。';
    }
  };

  if (terms === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#D9A441] font-sans text-[#1A1714]">
        <p className="font-serif text-lg font-bold">読み込み中…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#D9A441] px-4 py-8 font-sans text-[#1A1714]">
      {/* 簡易認証モーダル */}
      {isAuthenticated === false && (
        <AuthModal onSuccess={() => setIsAuthenticated(true)} />
      )}

      {/* 通知パイプライン設定モーダル */}
      {showSettings && (
        <NotificationModal onClose={() => setShowSettings(false)} />
      )}

      {/* ファイルインポートモーダル */}
      {showImporter && (
        <FileImporter
          onClose={() => setShowImporter(false)}
          onImported={(newTerms) => {
            if (terms) {
              setTerms([...newTerms, ...terms]);
            }
            setShowImporter(false);
          }}
        />
      )}

      {/* 用語編集モーダル */}
      {editingTerm && (
        <EditTermModal
          term={editingTerm}
          isOpen={Boolean(editingTerm)}
          onClose={() => setEditingTerm(null)}
          onSaved={(updated) => {
            if (terms) {
              setTerms(terms.map((t) => (t.id === updated.id ? updated : t)));
            }
          }}
          onDeleted={(deletedId) => {
            if (terms) {
              setTerms(terms.filter((t) => t.id !== deletedId));
            }
          }}
        />
      )}

      <div className="mx-auto max-w-xl">
        <Header todayStr={today} onOpenSettings={() => setShowSettings(true)} />

        {/* コーチセレクター */}
        <div className="relative mb-4">
          <button
            onClick={() => setShowCoachMenu((v) => !v)}
            className="flex w-full items-center justify-between border-2 border-[#1A1714] bg-[#F7F1E3] px-4 py-2.5 shadow-[3px_3px_0_0_#1A1714] hover:bg-[#ede8d0] transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-xl">{COACH_LIST.find((c) => c.id === coach)?.icon}</span>
              <div className="text-left">
                <p className="font-mono text-[10px] font-bold tracking-widest text-[#1A1714]/60">TODAY&apos;S COACH</p>
                <p className="text-sm font-bold text-[#1A1714]">{COACH_LIST.find((c) => c.id === coach)?.name}</p>
              </div>
            </div>
            <span className="font-mono text-xs text-[#1A1714]/50">{showCoachMenu ? '▲' : '▼'} 変更</span>
          </button>

          {showCoachMenu && (
            <div className="absolute left-0 right-0 top-full z-10 border-2 border-t-0 border-[#1A1714] bg-[#F7F1E3] shadow-[4px_4px_0_0_#1A1714]">
              {COACH_LIST.map((c) => (
                <button
                  key={c.id}
                  onClick={() => selectCoach(c.id)}
                  className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-[#D9A441]/30 ${
                    coach === c.id ? 'bg-[#D9A441]/20 font-bold' : ''
                  }`}
                >
                  <span className="text-xl">{c.icon}</span>
                  <div>
                    <p className="text-sm font-bold text-[#1A1714]">{c.name}</p>
                    <p className="text-xs text-[#1A1714]/60">{c.description}</p>
                  </div>
                  {coach === c.id && <span className="ml-auto font-mono text-xs text-[#B83227]">✓ 選択中</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="mb-4 border-2 border-[#B83227] bg-[#F7F1E3] px-4 py-3 text-sm font-bold text-[#B83227] shadow-[4px_4px_0_0_#1A1714]">
            {error}
          </div>
        )}

        {/* 1. ホーム画面 (View === 'home') */}
        {view === 'home' && (
          <div className="space-y-5">
            {/* 復習キュー状況カード */}
            {due.length > 0 ? (
              <div className="border-2 border-[#1A1714] bg-[#F7F1E3] p-6 shadow-[6px_6px_0_0_#1A1714]">
                <p className="text-sm font-bold text-[#1A1714]/70">今日ぶり返す用語</p>
                <p className="font-serif text-6xl font-bold leading-none text-[#1A1714]">
                  {due.length}
                  <span className="ml-2 font-sans text-base font-normal">件</span>
                </p>
                <button
                  onClick={() => startQuiz()}
                  className="mt-5 w-full border-2 border-[#1A1714] bg-[#B83227] px-4 py-3 font-bold text-[#F7F1E3] transition hover:bg-[#9c2a20]"
                >
                  今日の復習をはじめる
                </button>
              </div>
            ) : (
              <div className="border-2 border-[#1A1714] bg-[#F7F1E3] p-6 shadow-[6px_6px_0_0_#1A1714]">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🎉</span>
                  <div>
                    <h3 className="font-serif text-xl font-bold text-[#1A1714]">本日の復習はすべて完了！</h3>
                    <p className="text-xs font-bold text-[#8a6300]">ALL CLEAR TODAY</p>
                  </div>
                </div>
                <p className="mt-3 text-sm font-bold leading-relaxed text-[#1A1714]/80">
                  「{getCompletionMessage(coach)}」
                </p>

                {/* レベル分布ミニバー */}
                <div className="mt-4 border-t border-[#1A1714]/15 pt-3">
                  <p className="text-[11px] font-bold text-[#1A1714]/60 mb-2">定着レベル分布（全 {terms.length} 件）</p>
                  <div className="grid grid-cols-5 gap-1 text-center font-mono text-xs">
                    {levelCounts.map((count, lvl) => (
                      <div key={lvl} className="border border-[#1A1714]/30 bg-white/70 p-1.5">
                        <p className="text-[10px] text-[#1A1714]/60">Lv.{lvl}</p>
                        <p className="font-bold text-[#1A1714]">{count}<span className="text-[10px] font-normal">件</span></p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-5 flex gap-2">
                  <button
                    onClick={() => startQuiz(true)}
                    className="flex-1 border-2 border-[#1A1714] bg-white px-3 py-2.5 text-xs font-bold hover:bg-[#1A1714] hover:text-[#F7F1E3] transition-colors"
                  >
                    ⚡ 先取り復習する
                  </button>
                  <button
                    onClick={() => setView('add')}
                    className="flex-1 border-2 border-[#1A1714] bg-[#B83227] px-3 py-2.5 text-xs font-bold text-[#F7F1E3] hover:bg-[#9c2a20] transition-colors"
                  >
                    + 新しい用語を追加
                  </button>
                </div>
              </div>
            )}

            {/* 用語一覧 */}
            <div className="border-2 border-[#1A1714] bg-[#F7F1E3] shadow-[6px_6px_0_0_#1A1714]">
              <div className="flex items-center justify-between border-b-2 border-[#1A1714] px-4 py-3">
                <h2 className="font-serif text-lg font-bold">覚え中の用語 ({terms.length})</h2>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowImporter(true)}
                    className="border border-[#B83227] bg-[#B83227]/10 px-2 py-1 font-mono text-xs font-bold text-[#B83227] hover:bg-[#B83227] hover:text-[#F7F1E3]"
                  >
                    📄 取込
                  </button>
                  <button
                    onClick={() => setView('add')}
                    className="font-mono text-xs font-bold underline underline-offset-4 hover:text-[#B83227]"
                  >
                    + 手動追加
                  </button>
                </div>
              </div>
              <ul className="divide-y divide-[#1A1714]/15">
                {terms.map((t) => (
                  <li key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-black/5 transition-colors">
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-bold text-[#1A1714]">{t.term}</p>
                        <button
                          onClick={() => setEditingTerm(t)}
                          title="用語を編集"
                          className="text-xs text-[#1A1714]/40 hover:text-[#B83227] transition-colors"
                        >
                          ✏️
                        </button>
                      </div>
                      {t.note && (
                        <p className="truncate text-xs text-[#1A1714]/65">{t.note}</p>
                      )}
                    </div>
                    <div className="ml-3 shrink-0 text-right">
                      <div className="flex gap-1">
                        {INTERVALS.map((_, i) => (
                          <span
                            key={i}
                            className={`block h-1.5 w-3 ${
                              i < t.level ? 'bg-[#B83227]' : 'bg-[#1A1714]/15'
                            }`}
                          />
                        ))}
                      </div>
                      <p className="mt-1 font-mono text-[10px] text-[#1A1714]/60">
                        {t.next_review_at <= today ? '今日' : t.next_review_at}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* 2. 出題・回答画面 (View === 'quiz') */}
        {view === 'quiz' && current && (
          <div className="border-2 border-[#1A1714] bg-[#F7F1E3] p-6 shadow-[6px_6px_0_0_#1A1714]">
            <p className="font-mono text-xs tracking-widest text-[#1A1714]/60">お題</p>
            <h2 className="mt-1 font-serif text-3xl font-bold">{current.term}</h2>
            <div className="mt-2 h-1 w-24 bg-[#B83227]" />
            {current.note && (
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
                    <p className="mt-0.5 text-sm text-[#1A1714]/80">{current.note}</p>
                  </div>
                )}
              </div>
            )}

            <label className="mt-6 block text-sm font-bold text-[#1A1714]">
              自分の言葉で説明してみて
            </label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={5}
              placeholder="人に教えるつもりで書くと定着する"
              className="mt-2 w-full resize-none border-2 border-[#1A1714] bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#B83227]"
            />

            <div className="mt-3 flex items-center gap-3">
              <MicButton
                onText={(t) => setAnswer((a) => (a ? a.trim() + ' ' : '') + t)}
                onError={setError}
                label="声で説明する"
              />
              <p className="text-xs text-[#1A1714]/60">
                口に出す方が、ごまかしが効かへん
              </p>
            </div>

            <div className="mt-5 flex gap-2">
              <button
                onClick={() => grade()}
                disabled={loading || !answer.trim()}
                className="flex-1 border-2 border-[#1A1714] bg-[#B83227] px-4 py-3 font-bold text-[#F7F1E3] hover:bg-[#9c2a20] disabled:bg-[#1A1714]/20 disabled:text-[#1A1714]/50"
              >
                {loading ? '採点中…' : '答える'}
              </button>
              <button
                onClick={() => grade('(わからん)')}
                disabled={loading}
                className="border-2 border-[#1A1714] px-4 py-3 font-bold hover:bg-[#1A1714]/5"
              >
                わからん
              </button>
            </div>
          </div>
        )}

        {/* 3. 採点結果 & 聞き返しチャット画面 (View === 'result') */}
        {view === 'result' && result && current && (
          <div className="space-y-4">
            {/* ツッコミ & 印鑑判子 */}
            <div className="relative border-2 border-[#1A1714] bg-[#F7F1E3] p-6 shadow-[6px_6px_0_0_#1A1714]">
              <div className="absolute right-4 top-4">
                <Stamp score={result.score} />
              </div>
              <p className="font-mono text-xs tracking-widest text-[#1A1714]/60">
                {current.term}
              </p>
              <p className="mt-4 pr-24 font-serif text-xl font-bold leading-relaxed text-[#1A1714]">
                「{result.tsukkomi}」
              </p>
            </div>

            {/* 正しい説明 & 足りなかったキーワード */}
            <div className="border-2 border-[#1A1714] bg-[#F7F1E3] p-5 shadow-[4px_4px_0_0_#1A1714]">
              <h3 className="font-serif text-lg font-bold text-[#1A1714]">ほんまのところ</h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#1A1714]/90">
                {result.correct}
              </p>

              {result.missed && result.missed.length > 0 && (
                <div className="mt-4 border-t border-[#1A1714]/15 pt-3">
                  <p className="text-xs font-bold text-[#1A1714]/60">
                    言えてなかった言葉（タップで質問）
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {result.missed.map((m, i) => (
                      <button
                        key={i}
                        onClick={() => askChat(`「${m}」ってどういう意味？`)}
                        className="border border-[#B83227] bg-white px-2 py-1 font-mono text-xs font-bold text-[#B83227] hover:bg-[#B83227] hover:text-[#F7F1E3]"
                      >
                        {m} <span aria-hidden="true">?</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ミニ課題ミッション */}
            <div className="border-2 border-[#1A1714] bg-[#1A1714] p-5 text-[#F7F1E3] shadow-[4px_4px_0_0_#1A1714]">
              <h3 className="font-serif font-bold text-[#D9A441]">
                今すぐ手を動かすミッション
              </h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{result.mission}</p>
            </div>

            {/* 答えた後限定：聞き返しチャット */}
            <div className="border-2 border-[#1A1714] bg-[#F7F1E3] shadow-[6px_6px_0_0_#1A1714]">
              <div className="border-b-2 border-[#1A1714] px-4 py-3">
                <h3 className="font-serif text-base font-bold">覚える君に聞き返す</h3>
                <p className="text-xs text-[#1A1714]/60">
                  出てきた言葉で分からんものは、その場で潰しとく
                </p>
              </div>

              {chat.length > 0 && (
                <div className="space-y-3 px-4 py-4">
                  {chat.map((m, i) => (
                    <div
                      key={i}
                      className={m.role === 'user' ? 'text-right' : 'text-left'}
                    >
                      <span
                        className={`inline-block max-w-[85%] whitespace-pre-line px-3 py-2 text-left text-sm leading-relaxed ${
                          m.role === 'user'
                            ? 'bg-[#1A1714] text-[#F7F1E3]'
                            : 'border-2 border-[#1A1714] bg-white text-[#1A1714]'
                        }`}
                      >
                        {m.content}
                      </span>
                    </div>
                  ))}
                  {chatLoading && (
                    <p className="text-sm font-bold text-[#1A1714]/50">考え中…</p>
                  )}
                </div>
              )}

              {chat.length === 0 && (
                <div className="flex flex-wrap gap-2 px-4 pt-4">
                  <button
                    onClick={() => askChat('もっと簡単に言い直して')}
                    className="border-2 border-[#1A1714] bg-white px-3 py-1.5 text-xs font-bold hover:bg-[#1A1714] hover:text-[#F7F1E3]"
                  >
                    もっと簡単に
                  </button>
                  <button
                    onClick={() => askChat('別の身近な日常シーンに例えて説明して')}
                    className="border-2 border-[#1A1714] bg-white px-3 py-1.5 text-xs font-bold hover:bg-[#1A1714] hover:text-[#F7F1E3]"
                  >
                    別の例えで
                  </button>
                  <button
                    onClick={() => askChat('実務や現場では具体的にどう使われる？')}
                    className="border-2 border-[#1A1714] bg-white px-3 py-1.5 text-xs font-bold hover:bg-[#1A1714] hover:text-[#F7F1E3]"
                  >
                    実務での使い道
                  </button>
                  <button
                    onClick={() => askChat('別のクスッと笑える語呂合わせをもう1個教えて！')}
                    className="border-2 border-[#1A1714] bg-white px-3 py-1.5 text-xs font-bold hover:bg-[#1A1714] hover:text-[#F7F1E3]"
                  >
                    別の語呂合わせ
                  </button>
                  <button
                    onClick={() => askChat('流れや仕組みを分かりやすくテキスト図解して！')}
                    className="border-2 border-[#1A1714] bg-white px-3 py-1.5 text-xs font-bold hover:bg-[#1A1714] hover:text-[#F7F1E3]"
                  >
                    図解して
                  </button>
                </div>
              )}

              <div className="flex gap-2 p-4">
                <MicButton
                  onText={(t) => setChatInput((c) => (c ? c.trim() + ' ' : '') + t)}
                  onError={setError}
                  label=""
                />
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && askChat()}
                  placeholder="例：これってコードのどこに書くの？"
                  className="min-w-0 flex-1 border-2 border-[#1A1714] bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B83227]"
                />
                <button
                  onClick={() => askChat()}
                  disabled={chatLoading || !chatInput.trim()}
                  className="shrink-0 border-2 border-[#1A1714] bg-[#B83227] px-4 py-2 text-sm font-bold text-[#F7F1E3] hover:bg-[#9c2a20] disabled:bg-[#1A1714]/20 disabled:text-[#1A1714]/50"
                >
                  聞く
                </button>
              </div>
            </div>

            {/* ナビゲーションボタン */}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => startQuiz()}
                disabled={due.length === 0}
                className="flex-1 border-2 border-[#1A1714] bg-[#B83227] px-4 py-3 font-bold text-[#F7F1E3] hover:bg-[#9c2a20] disabled:bg-[#1A1714]/20 disabled:text-[#1A1714]/50"
              >
                {due.length === 0 ? '今日の復習完了！' : '次のお題へ'}
              </button>
              <button
                onClick={() => setView('home')}
                className="border-2 border-[#1A1714] bg-[#F7F1E3] px-4 py-3 font-bold hover:bg-[#1A1714]/5"
              >
                ホームへ戻る
              </button>
            </div>
          </div>
        )}

        {/* 4. 用語追加画面 (View === 'add') */}
        {view === 'add' && (
          <div className="border-2 border-[#1A1714] bg-[#F7F1E3] p-6 shadow-[6px_6px_0_0_#1A1714]">
            <h2 className="font-serif text-2xl font-bold">用語を追加する</h2>
            <form onSubmit={handleAddTerm} className="mt-4 space-y-4">
              <div>
                <label className="block text-sm font-bold text-[#1A1714]">用語</label>
                <input
                  value={newTerm}
                  onChange={(e) => setNewTerm(e.target.value)}
                  placeholder="例：useRef"
                  className="mt-1 w-full border-2 border-[#1A1714] bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#B83227]"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-[#1A1714]">
                  どこで出てきた？（メモ）
                </label>
                <input
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="例：YouTube診断ツールの入力欄で使った"
                  className="mt-1 w-full border-2 border-[#1A1714] bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#B83227]"
                />
                <p className="mt-1 text-xs text-[#1A1714]/60">
                  自分の作ったものと結びつくほど忘れにくい。
                </p>
              </div>

              <div className="mt-6 flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={!newTerm.trim()}
                  className="flex-1 border-2 border-[#1A1714] bg-[#B83227] px-4 py-3 font-bold text-[#F7F1E3] hover:bg-[#9c2a20] disabled:bg-[#1A1714]/20 disabled:text-[#1A1714]/50"
                >
                  追加する
                </button>
                <button
                  type="button"
                  onClick={() => setView('home')}
                  className="border-2 border-[#1A1714] px-4 py-3 font-bold hover:bg-[#1A1714]/5"
                >
                  戻る
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
