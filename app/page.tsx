'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Stamp from '@/components/Stamp';
import MicButton from '@/components/MicButton';
import AuthModal from '@/components/AuthModal';
import NotificationModal from '@/components/NotificationModal';
import FileImporter from '@/components/FileImporter';
import EditTermModal from '@/components/EditTermModal';
import { Term, getTermTag } from '@/lib/types';
import { CoachType, COACH_LIST } from '@/lib/coach';
import { todayStr } from '@/lib/date';
import { INTERVALS } from '@/lib/constants';
import { triggerScoreEffects, triggerSessionCompleteEffects } from '@/lib/effects';

export default function Home() {
  const [terms, setTerms] = useState<Term[] | null>(null);
  const [view, setView] = useState<'home' | 'quiz' | 'result' | 'add' | 'session_summary'>('home');
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
  const [newTag, setNewTag] = useState('');

  // セッション問題数設定 (3 | 5 | 10 | 0 = 無制限)
  const [sessionLimit, setSessionLimit] = useState<number>(3);
  const [sessionIndex, setSessionIndex] = useState<number>(1);
  const [sessionScores, setSessionScores] = useState<number[]>([]);

  // 分野・講義回フィルター ('all' | 'due' | タグ名)
  const [selectedTag, setSelectedTag] = useState<string>('all');

  // 用語一覧の検索フィルター
  const [searchTerm, setSearchTerm] = useState<string>('');

  // 聞き返しチャット用
  const [chat, setChat] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatSectionRef = React.useRef<HTMLDivElement>(null);

  // ヒント表示状態
  const [showHint, setShowHint] = useState(false);

  // ユーザー名・ニックネーム設定（localStorageで永続）
  const [userName, setUserName] = useState<string>('カズ');
  const [showNameModal, setShowNameModal] = useState(false);
  const [nameInput, setNameInput] = useState('カズ');

  // コーチキャラクター選択（localStorageで永続）
  const [coach, setCoach] = useState<CoachType>('osaka');
  const [showCoachMenu, setShowCoachMenu] = useState(false);

  // モーダル管理
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showImporter, setShowImporter] = useState(false);
  const [editingTerm, setEditingTerm] = useState<Term | null>(null);

  // ユーザー名の初期読み込み
  useEffect(() => {
    const savedName = localStorage.getItem('oboeru_user_name');
    if (savedName) {
      setUserName(savedName);
      setNameInput(savedName);
    }
  }, []);

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nameInput.trim() || 'カズ';
    setUserName(trimmed);
    setNameInput(trimmed);
    localStorage.setItem('oboeru_user_name', trimmed);
    setShowNameModal(false);
  };

  // 認証ステータスチェック
  useEffect(() => {
    async function checkAuth() {
      try {
        const authRes = await fetch('/api/auth');
        const authData = await authRes.json();
        setIsAuthenticated(authData.authenticated);
      } catch {
        setIsAuthenticated(true); // エラー時はスキップ
      }
    }
    checkAuth();
  }, []);

  // 用語一覧の読み込み。/api/terms は未認証だと401を返すため、
  // 認証確認後（isAuthenticated === true）にしか呼ばない。
  // 以前はここを認証と無関係に無条件で呼んでいたため、未認証時は
  // terms が永遠に null のままとなり、ログインモーダルにすら
  // 到達できずに「読み込み中…」で固まっていた。
  useEffect(() => {
    if (isAuthenticated !== true) return;

    async function loadTerms() {
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
    loadTerms();
  }, [isAuthenticated]);

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

  // セッション完了時の紙吹雪演出
  useEffect(() => {
    if (view === 'session_summary' && sessionScores.length > 0) {
      const avg = Math.round(sessionScores.reduce((a, b) => a + b, 0) / sessionScores.length);
      triggerSessionCompleteEffects(avg);
    }
  }, [view, sessionScores]);

  const today = todayStr();
  const due = (terms || []).filter((t) => t.next_review_at <= today);

  // ユニークなタグ一覧と件数を集計
  const tagStats = React.useMemo(() => {
    if (!terms) return [];
    const map = new Map<string, { total: number; due: number }>();

    terms.forEach((t) => {
      const tag = getTermTag(t);
      const currentStat = map.get(tag) || { total: 0, due: 0 };
      currentStat.total += 1;
      if (t.next_review_at <= today) currentStat.due += 1;
      map.set(tag, currentStat);
    });

    return Array.from(map.entries())
      .map(([name, stat]) => ({ name, ...stat }))
      .sort((a, b) => a.name.localeCompare(b.name, 'ja', { numeric: true }));
  }, [terms, today]);

  // 選択中タグ & 検索語でフィルタされた用語一覧
  const filteredTerms = React.useMemo(() => {
    if (!terms) return [];
    let list = terms;
    if (selectedTag === 'due') {
      list = due;
    } else if (selectedTag !== 'all') {
      list = terms.filter((t) => getTermTag(t) === selectedTag);
    }

    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.term.toLowerCase().includes(q) ||
          (t.note && t.note.toLowerCase().includes(q)) ||
          getTermTag(t).toLowerCase().includes(q)
      );
    }
    return list;
  }, [terms, selectedTag, due, searchTerm]);

  // 選択中タグでフィルタされた本日復習対象
  const filteredDue = React.useMemo(() => {
    if (selectedTag === 'all') return due;
    if (selectedTag === 'due') return due;
    return filteredTerms.filter((t) => t.next_review_at <= today);
  }, [filteredTerms, selectedTag, due, today]);

  const startQuiz = (forceAll?: boolean, targetTag?: string, resetSession: boolean = true) => {
    const tagToUse = targetTag !== undefined ? targetTag : selectedTag;
    let targetPool: Term[] = [];

    if (tagToUse === 'all') {
      targetPool = forceAll ? (terms || []) : due;
    } else if (tagToUse === 'due') {
      targetPool = due;
    } else {
      const tagTerms = (terms || []).filter((t) => getTermTag(t) === tagToUse);
      targetPool = forceAll || tagTerms.every((t) => t.next_review_at > today)
        ? tagTerms
        : tagTerms.filter((t) => t.next_review_at <= today);
      if (targetPool.length === 0) targetPool = tagTerms;
    }

    if (targetPool.length === 0) return;
    const randomTerm = targetPool[Math.floor(Math.random() * targetPool.length)];
    setCurrent(randomTerm);
    setAnswer('');
    setResult(null);
    setChat([]);
    setChatInput('');
    setError('');
    setShowHint(false);

    if (resetSession) {
      setSessionIndex(1);
      setSessionScores([]);
    } else {
      setSessionIndex((prev) => prev + 1);
    }

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
          userName,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || '採点エラー');
      }

      setResult(data.result);
      setSessionScores((prev) => [...prev, data.result.score]);

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

      // スコアに応じた演出を発火（80点以上は桜吹雪、40点未満はシェイク等）
      triggerScoreEffects(data.result.score);

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

    // チャット欄へスムーズスクロール
    setTimeout(() => {
      chatSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);

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
          userName,
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

  const handleAddQuickTerm = async (termText: string) => {
    if (!termText.trim()) return;
    try {
      const res = await fetch('/api/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term: termText.trim(),
          note: current ? `「${current.term}」の解説中に出てきた関連用語` : '解説中から追加',
          tag: current?.tag || '関連用語',
        }),
      });
      const data = await res.json();
      if (res.ok && data.term) {
        if (terms) setTerms([data.term, ...terms]);
        alert(`「${termText}」を覚える君の単語帳に登録したで！次回から復習に出るよ。`);
      } else {
        alert('すでに登録されているか、登録に失敗しました。');
      }
    } catch {
      alert('登録中にエラーが発生しました。');
    }
  };

  const handleAddTerm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTerm.trim()) return;

    try {
      const res = await fetch('/api/terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          term: newTerm.trim(),
          note: newNote.trim(),
          tag: newTag.trim(),
        }),
      });
      const data = await res.json();

      // res.ok を見ずに入力をクリアしていたため、保存に失敗しても
      // 入力が消えてホームに戻り、エラーも出ないままだった（＝書いた内容が消滅）。
      // 失敗時は入力を残して、その場に留まる。
      if (!res.ok || !data.term) {
        setError(data.error || '用語の追加に失敗しました。もう一度試してください。');
        return;
      }

      setTerms((prev) => (prev ? [data.term, ...prev] : [data.term]));
      setNewTerm('');
      setNewNote('');
      setNewTag('');
      setError('');
      setView('home');
    } catch {
      setError('通信エラーで用語を追加できませんでした。もう一度試してください。');
    }
  };

  // 出題中・結果画面から不要な用語を即座に削除・除外する関数
  const handleDeleteCurrentTerm = async () => {
    if (!current) return;
    if (!window.confirm(`用語「${current.term}」を復習から削除（除外）してもよろしいですか？`)) {
      return;
    }

    try {
      const res = await fetch(`/api/terms?id=${encodeURIComponent(current.id)}`, {
        method: 'DELETE',
      });

      // 失敗時に何もせず黙って進んでいたため、ユーザーには
      // 「削除ボタンが効かない」としか見えなかった。
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || '用語の削除に失敗しました。');
        return;
      }

      setTerms((prev) => (prev ? prev.filter((t) => t.id !== current.id) : prev));

      // セッション中なら次の問題へ、またはセッション完了ならホームへ
      if (sessionLimit > 0 && sessionIndex >= sessionLimit) {
        setView('session_summary');
      } else {
        startQuiz(false, selectedTag, false);
      }
    } catch {
      setError('用語の削除に失敗しました。');
    }
  };

  // 一覧から特定の用語を手動で即座に削除する関数
  const handleDeleteTermById = async (termToDelete: Term) => {
    if (!window.confirm(`用語「${termToDelete.term}」を削除してもよろしいですか？\n※復習履歴も削除されます。`)) {
      return;
    }

    try {
      const res = await fetch(`/api/terms?id=${encodeURIComponent(termToDelete.id)}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || '用語の削除に失敗しました。');
        return;
      }

      setTerms((prev) => (prev ? prev.filter((t) => t.id !== termToDelete.id) : prev));
    } catch {
      setError('通信エラーで用語を削除できませんでした。');
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

  // 未認証ならログイン画面のみ表示する。terms は認証後にしか
  // 取得できない（=いつまでも null）ため、この判定を terms === null の
  // 早期returnより先に置かないとログインモーダルへ到達できない。
  if (isAuthenticated === false) {
    return (
      <div className="min-h-screen bg-[#D9A441] font-sans text-[#1A1714]">
        <AuthModal onSuccess={() => setIsAuthenticated(true)} />
      </div>
    );
  }

  if (isAuthenticated !== true || terms === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#D9A441] font-sans text-[#1A1714]">
        <p className="font-serif text-lg font-bold">読み込み中…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#D9A441] px-4 py-8 font-sans text-[#1A1714]">
      {/* 通知パイプライン設定モーダル */}
      {showSettings && (
        <NotificationModal onClose={() => setShowSettings(false)} />
      )}

      {/* ファイルインポートモーダル */}
      {showImporter && (
        <FileImporter
          existingTerms={terms}
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

      {/* お名前・ニックネーム設定モーダル */}
      {showNameModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1714]/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm border-2 border-[#1A1714] bg-[#F7F1E3] p-5 shadow-[6px_6px_0_0_#1A1714]">
            <div className="flex items-center justify-between border-b border-[#1A1714]/20 pb-3">
              <h3 className="font-serif text-lg font-bold text-[#1A1714]">👤 お名前の設定</h3>
              <button
                onClick={() => setShowNameModal(false)}
                className="font-bold text-[#1A1714]/60 hover:text-[#1A1714]"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleSaveName} className="mt-4 space-y-3">
              <p className="text-xs text-[#1A1714]/70 leading-relaxed">
                覚える君に呼んでほしいニックネームを入力してください。（例: カズ、田中、たっちゃん）
              </p>
              <input
                type="text"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                placeholder="例: カズ"
                maxLength={15}
                autoFocus
                className="w-full border-2 border-[#1A1714] bg-white p-2.5 text-base font-bold text-[#1A1714] focus:outline-none focus:ring-2 focus:ring-[#B83227]"
              />
              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 border-2 border-[#1A1714] bg-[#B83227] py-2.5 font-bold text-[#F7F1E3] hover:bg-[#9c2a20]"
                >
                  保存する
                </button>
                <button
                  type="button"
                  onClick={() => setShowNameModal(false)}
                  className="border-2 border-[#1A1714] px-4 py-2.5 font-bold hover:bg-[#1A1714]/10"
                >
                  キャンセル
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-xl">
        <Header todayStr={today} onOpenSettings={() => setShowSettings(true)} />

        {/* コーチ＆ニックネーム設定バー */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          {/* コーチセレクター */}
          <div className="relative">
            <button
              onClick={() => setShowCoachMenu((v) => !v)}
              className="flex w-full items-center justify-between border-2 border-[#1A1714] bg-[#F7F1E3] px-3.5 py-2.5 shadow-[3px_3px_0_0_#1A1714] hover:bg-[#ede8d0] transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xl shrink-0">{COACH_LIST.find((c) => c.id === coach)?.icon}</span>
                <div className="text-left min-w-0">
                  <p className="font-mono text-[9px] font-bold tracking-wider text-[#1A1714]/60">COACH</p>
                  <p className="text-xs sm:text-sm font-bold text-[#1A1714] truncate">{COACH_LIST.find((c) => c.id === coach)?.name}</p>
                </div>
              </div>
              <span className="font-mono text-[10px] text-[#1A1714]/50 shrink-0">{showCoachMenu ? '▲' : '▼'}</span>
            </button>

            {showCoachMenu && (
              <div className="absolute left-0 right-0 top-full z-10 border-2 border-t-0 border-[#1A1714] bg-[#F7F1E3] shadow-[4px_4px_0_0_#1A1714]">
                {COACH_LIST.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => selectCoach(c.id)}
                    className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-[#D9A441]/30 ${
                      coach === c.id ? 'bg-[#D9A441]/20 font-bold' : ''
                    }`}
                  >
                    <span className="text-lg">{c.icon}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#1A1714] truncate">{c.name}</p>
                      <p className="text-[10px] text-[#1A1714]/60 truncate">{c.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ニックネーム設定ボタン */}
          <button
            onClick={() => {
              setNameInput(userName);
              setShowNameModal(true);
            }}
            className="flex items-center justify-between border-2 border-[#1A1714] bg-[#F7F1E3] px-3.5 py-2.5 shadow-[3px_3px_0_0_#1A1714] hover:bg-[#ede8d0] transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xl shrink-0">👤</span>
              <div className="text-left min-w-0">
                <p className="font-mono text-[9px] font-bold tracking-wider text-[#1A1714]/60">LEARNER</p>
                <p className="text-xs sm:text-sm font-bold text-[#B83227] truncate">{userName} さん</p>
              </div>
            </div>
            <span className="font-mono text-[10px] text-[#1A1714]/50 shrink-0">✏️ 変更</span>
          </button>
        </div>

        {error && (
          <div className="mb-4 border-2 border-[#B83227] bg-[#F7F1E3] px-4 py-3 text-sm font-bold text-[#B83227] shadow-[4px_4px_0_0_#1A1714]">
            {error}
          </div>
        )}

        {/* 1. ホーム画面 (View === 'home') */}
        {view === 'home' && (
          <div className="space-y-5">
            {/* 分野・講義フィルタータブバー */}
            <div className="border-2 border-[#1A1714] bg-[#F7F1E3] p-3 shadow-[4px_4px_0_0_#1A1714]">
              <div className="flex items-center justify-between pb-2">
                <p className="font-mono text-[10px] font-bold tracking-wider text-[#1A1714]/60">
                  🏷️ 分野・講義で集中特訓フィルター
                </p>
                {selectedTag !== 'all' && (
                  <button
                    onClick={() => setSelectedTag('all')}
                    className="font-mono text-[10px] font-bold text-[#B83227] underline"
                  >
                    リセット
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5 overflow-x-auto pb-1">
                <button
                  onClick={() => setSelectedTag('all')}
                  className={`border px-2.5 py-1 font-mono text-xs font-bold transition-all ${
                    selectedTag === 'all'
                      ? 'border-[#1A1714] bg-[#1A1714] text-[#F7F1E3] shadow-[2px_2px_0_0_#B83227]'
                      : 'border-[#1A1714]/40 bg-white text-[#1A1714] hover:border-[#1A1714]'
                  }`}
                >
                  すべて ({terms.length})
                </button>
                <button
                  onClick={() => setSelectedTag('due')}
                  className={`border px-2.5 py-1 font-mono text-xs font-bold transition-all ${
                    selectedTag === 'due'
                      ? 'border-[#1A1714] bg-[#B83227] text-[#F7F1E3] shadow-[2px_2px_0_0_#1A1714]'
                      : 'border-[#B83227]/50 bg-white text-[#B83227] hover:border-[#B83227]'
                  }`}
                >
                  ⏰ 今日の復習 ({due.length})
                </button>
                {tagStats.map((stat) => (
                  <button
                    key={stat.name}
                    onClick={() => setSelectedTag(stat.name)}
                    className={`flex items-center gap-1 border px-2.5 py-1 text-xs font-bold transition-all ${
                      selectedTag === stat.name
                        ? 'border-[#1A1714] bg-[#1A1714] text-[#F7F1E3] shadow-[2px_2px_0_0_#D9A441]'
                        : 'border-[#1A1714]/30 bg-white text-[#1A1714] hover:border-[#1A1714]'
                    }`}
                  >
                    <span>{stat.name}</span>
                    <span className="font-mono text-[10px] opacity-70">({stat.total})</span>
                    {stat.due > 0 && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#B83227]" title={`今日復習 ${stat.due}件`} />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* 復習・特訓状況カード */}
            {selectedTag !== 'all' && selectedTag !== 'due' ? (
              // 選択された特定分野の集中特訓カード
              <div className="border-2 border-[#1A1714] bg-[#F7F1E3] p-6 shadow-[6px_6px_0_0_#1A1714]">
                <div className="flex items-center justify-between">
                  <span className="inline-block border border-[#1A1714] bg-[#D9A441]/20 px-2 py-0.5 font-mono text-xs font-bold text-[#1A1714]">
                    🏷️ 集中特訓モード
                  </span>
                  <span className="text-xs text-[#1A1714]/60">
                    今日復習: {filteredDue.length}件 / 全{filteredTerms.length}件
                  </span>
                </div>
                <h3 className="mt-2 font-serif text-2xl font-bold text-[#1A1714]">
                  {selectedTag}
                </h3>
                <p className="mt-1 text-xs text-[#1A1714]/70">
                  この分野の用語だけを集中して叩き込みます。
                </p>

                {/* 問題数コース選択 */}
                <div className="mt-4 border-t border-[#1A1714]/15 pt-3">
                  <p className="text-[11px] font-bold text-[#1A1714]/70 mb-1.5">何問チャレンジする？</p>
                  <div className="grid grid-cols-4 gap-1.5 font-mono text-xs">
                    {[
                      { count: 3, label: '3問', time: '1分' },
                      { count: 5, label: '5問', time: '3分' },
                      { count: 10, label: '10問', time: '5分' },
                      { count: 0, label: '全問', time: '無制限' },
                    ].map((c) => (
                      <button
                        key={c.count}
                        onClick={() => setSessionLimit(c.count)}
                        className={`border-2 p-1.5 text-center transition-all ${
                          sessionLimit === c.count
                            ? 'border-[#1A1714] bg-[#1A1714] text-[#F7F1E3] font-bold shadow-[2px_2px_0_0_#D9A441]'
                            : 'border-[#1A1714]/30 bg-white hover:border-[#1A1714]'
                        }`}
                      >
                        <p className="font-bold">{c.label}</p>
                        <p className="text-[9px] opacity-70">{c.time}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => startQuiz(true, selectedTag, true)}
                  disabled={filteredTerms.length === 0}
                  className="mt-5 w-full border-2 border-[#1A1714] bg-[#1A1714] px-4 py-3 font-bold text-[#F7F1E3] transition hover:bg-[#332f2b]"
                >
                  ⚡ 【{selectedTag}】を{sessionLimit > 0 ? `${sessionLimit}問` : '全問'}特訓する
                </button>
              </div>
            ) : due.length > 0 ? (
              // 今日の復習カード
              <div className="border-2 border-[#1A1714] bg-[#F7F1E3] p-6 shadow-[6px_6px_0_0_#1A1714]">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-bold text-[#1A1714]/70">今日復習する用語</p>
                  <span className="font-mono text-xs text-[#B83227] font-bold">全 {due.length} 件が待機中</span>
                </div>
                <p className="font-serif text-6xl font-bold leading-none text-[#1A1714]">
                  {due.length}
                  <span className="ml-2 font-sans text-base font-normal">件</span>
                </p>

                {/* 問題数コース選択 */}
                <div className="mt-4 border-t border-[#1A1714]/15 pt-3">
                  <p className="text-[11px] font-bold text-[#1A1714]/70 mb-1.5">今日のペースを選ぶ</p>
                  <div className="grid grid-cols-4 gap-1.5 font-mono text-xs">
                    {[
                      { count: 3, label: '3問', time: '1分' },
                      { count: 5, label: '5問', time: '3分' },
                      { count: 10, label: '10問', time: '5分' },
                      { count: 0, label: '全問', time: '無制限' },
                    ].map((c) => (
                      <button
                        key={c.count}
                        onClick={() => setSessionLimit(c.count)}
                        className={`border-2 p-1.5 text-center transition-all ${
                          sessionLimit === c.count
                            ? 'border-[#1A1714] bg-[#B83227] text-[#F7F1E3] font-bold shadow-[2px_2px_0_0_#1A1714]'
                            : 'border-[#1A1714]/30 bg-white hover:border-[#1A1714]'
                        }`}
                      >
                        <p className="font-bold">{c.label}</p>
                        <p className="text-[9px] opacity-70">{c.time}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => startQuiz(false, undefined, true)}
                  className="mt-5 w-full border-2 border-[#1A1714] bg-[#B83227] px-4 py-3 font-bold text-[#F7F1E3] transition hover:bg-[#9c2a20]"
                >
                  ⚡ {sessionLimit > 0 ? `サクッと ${sessionLimit} 問復習する` : '全問チャレンジする'}
                </button>
              </div>
            ) : (
              // 本日のノルマ完了カード
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
                    onClick={() => startQuiz(true, undefined, true)}
                    className="flex-1 border-2 border-[#1A1714] bg-white px-3 py-2.5 text-xs font-bold hover:bg-[#1A1714] hover:text-[#F7F1E3] transition-colors"
                  >
                    ⚡ 先取り復習する ({sessionLimit > 0 ? `${sessionLimit}問` : '全問'})
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
                <div className="flex items-center gap-2">
                  <h2 className="font-serif text-lg font-bold">
                    覚え中の用語 ({filteredTerms.length})
                  </h2>
                  {selectedTag !== 'all' && (
                    <span className="border border-[#1A1714]/40 bg-white px-2 py-0.5 font-mono text-[10px] font-bold">
                      {selectedTag === 'due' ? '今日の復習' : selectedTag}
                    </span>
                  )}
                </div>
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

              {/* 用語のインクリメンタル検索バー */}
              <div className="border-b border-[#1A1714]/15 bg-white/60 px-4 py-2">
                <div className="relative flex items-center">
                  <span className="absolute left-2.5 text-xs text-[#1A1714]/40">🔍</span>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="登録用語やメモを検索して絞り込み..."
                    className="w-full border border-[#1A1714]/30 bg-white py-1.5 pl-8 pr-7 text-xs focus:border-[#B83227] focus:outline-none"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2 text-xs text-[#1A1714]/40 hover:text-[#1A1714]"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              <ul className="divide-y divide-[#1A1714]/15">
                {filteredTerms.length === 0 ? (
                  <li className="px-4 py-8 text-center text-xs text-[#1A1714]/50">
                    {searchTerm ? `「${searchTerm}」に一致する用語はありません。` : '該当する用語はありません。'}
                  </li>
                ) : (
                  filteredTerms.map((t) => {
                    const tag = getTermTag(t);
                    return (
                      <li key={t.id} className="flex items-center justify-between px-4 py-3 hover:bg-black/5 transition-colors">
                        <div className="min-w-0 flex-1 pr-2">
                          <div className="flex items-center gap-2">
                            <p className="truncate font-bold text-[#1A1714]">{t.term}</p>
                            <span className="shrink-0 border border-[#1A1714]/30 bg-white px-1.5 py-0.2 font-mono text-[10px] text-[#1A1714]/70">
                              {tag}
                            </span>
                            <button
                              onClick={() => setEditingTerm(t)}
                              title="用語を編集"
                              className="text-xs text-[#1A1714]/40 hover:text-[#B83227] transition-colors"
                            >
                              ✏️
                            </button>
                            <button
                              onClick={() => handleDeleteTermById(t)}
                              title="この用語を手動で削除"
                              className="text-xs text-[#1A1714]/40 hover:text-[#B83227] transition-colors"
                            >
                              🗑️
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
                    );
                  })
                )}
              </ul>
            </div>
          </div>
        )}

        {/* 2. 出題・回答画面 (View === 'quiz') */}
        {view === 'quiz' && current && (
          <div className="border-2 border-[#1A1714] bg-[#F7F1E3] p-6 shadow-[6px_6px_0_0_#1A1714]">
            {/* セッション進行度バー */}
            {sessionLimit > 0 && (
              <div className="mb-4 border-b border-[#1A1714]/15 pb-3">
                <div className="flex items-center justify-between text-xs font-mono font-bold">
                  <span className="text-[#B83227]">
                    第 {sessionIndex} / {sessionLimit} 問
                  </span>
                  <span className="text-[#1A1714]/60">
                    残り {Math.max(0, sessionLimit - sessionIndex + 1)} 問
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full border border-[#1A1714]/30 bg-white/70">
                  <div
                    className="h-full bg-[#B83227] transition-all"
                    style={{ width: `${Math.min(100, (sessionIndex / sessionLimit) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex items-center justify-between">
              <p className="font-mono text-xs tracking-widest text-[#1A1714]/60">お題</p>
              <div className="flex items-center gap-2">
                <span className="border border-[#1A1714] bg-white px-2 py-0.5 font-mono text-[11px] font-bold text-[#1A1714]">
                  🏷️ {getTermTag(current)}
                </span>
                <button
                  onClick={handleDeleteCurrentTerm}
                  title="この用語を復習から除外（削除）する"
                  className="flex items-center gap-1 border border-[#B83227]/40 bg-white px-2 py-0.5 font-mono text-[11px] font-bold text-[#B83227] hover:bg-[#B83227] hover:text-white transition-colors"
                >
                  🗑️ 除外
                </button>
              </div>
            </div>
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

          </div>
        )}

        {/* 送信ボタンをカード外・画面下部に固定。
            スマホでtextareaにフォーカスするとソフトキーボードが出るが、
            quiz画面はページ全体の丈がviewportとほぼ同じでスクロール余地が
            数十pxしかなく、キーボード分の高さ（実測300px超）を差し引くと
            通常配置のボタンは可視領域の外に出て押せなくなっていた。 */}
        {view === 'quiz' && current && (
          <div
            className="sticky bottom-0 z-10 mt-3 flex gap-2 border-t-2 border-[#1A1714] bg-[#D9A441] px-4 py-3"
            style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <button
              onClick={() => grade()}
              disabled={loading || !answer.trim()}
              className="flex-1 border-2 border-[#1A1714] bg-[#B83227] px-4 py-3 font-bold text-[#F7F1E3] shadow-[3px_3px_0_0_#1A1714] hover:bg-[#9c2a20] disabled:bg-[#1A1714]/20 disabled:text-[#1A1714]/50 disabled:shadow-none"
            >
              {loading ? '採点中…' : '答える'}
            </button>
            <button
              onClick={() => grade('(わからん)')}
              disabled={loading}
              className="border-2 border-[#1A1714] bg-[#F7F1E3] px-4 py-3 font-bold shadow-[3px_3px_0_0_#1A1714] hover:bg-[#1A1714]/5 disabled:opacity-50 disabled:shadow-none"
            >
              わからん
            </button>
          </div>
        )}

        {/* 3. 採点結果 & 聞き返しチャット画面 (View === 'result') */}
        {view === 'result' && result && current && (
          <div className="space-y-4">
            {/* セッション進行度バー */}
            {sessionLimit > 0 && (
              <div className="border-2 border-[#1A1714] bg-[#F7F1E3] px-4 py-2.5 shadow-[3px_3px_0_0_#1A1714]">
                <div className="flex items-center justify-between text-xs font-mono font-bold">
                  <span className="text-[#B83227]">
                    第 {sessionIndex} / {sessionLimit} 問 完了
                  </span>
                  <span className="text-[#1A1714]/60">
                    今回のスコア: {result.score}点
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full border border-[#1A1714]/30 bg-white/70">
                  <div
                    className="h-full bg-[#B83227] transition-all"
                    style={{ width: `${Math.min(100, (sessionIndex / sessionLimit) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* ツッコミ & 印鑑判子 */}
            <div
              className={`relative border-2 border-[#1A1714] bg-[#F7F1E3] p-6 shadow-[6px_6px_0_0_#1A1714] overflow-hidden ${
                result.score < 40 ? 'shake-effect' : ''
              }`}
            >
              {/* 低得点（40点未満）時のしとしと雨粒/涙エフェクト */}
              {result.score < 40 && (
                <div className="pointer-events-none absolute inset-0 flex justify-around opacity-60 z-0">
                  <span className="rain-drop text-sm" style={{ animationDelay: '0s' }}>💧</span>
                  <span className="rain-drop text-xs" style={{ animationDelay: '0.4s' }}>💧</span>
                  <span className="rain-drop text-sm" style={{ animationDelay: '0.8s' }}>💧</span>
                  <span className="rain-drop text-xs" style={{ animationDelay: '0.2s' }}>💧</span>
                  <span className="rain-drop text-sm" style={{ animationDelay: '0.6s' }}>💧</span>
                </div>
              )}

              <div className="relative z-10">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <p className="font-mono text-xs tracking-widest text-[#1A1714]/60">
                      {current.term}
                    </p>
                    <span className="border border-[#1A1714]/30 bg-white px-1.5 py-0.2 font-mono text-[10px] text-[#1A1714]/70">
                      🏷️ {getTermTag(current)}
                    </span>
                  </div>
                  <button
                    onClick={handleDeleteCurrentTerm}
                    title="この用語を復習から除外（削除）する"
                    className="font-mono text-[10px] text-[#B83227] underline hover:text-[#9c2a20]"
                  >
                    🗑️ 復習から外す
                  </button>
                </div>
                {/* absolute配置だと、スマホ幅ではpadding-rightで本文の実効幅が
                    極端に狭くなり、1行あたり数文字しか入らず縦長になっていた。
                    floatで文章側に回り込ませることで、判子を避けつつ全幅を使う。 */}
                <div className="float-right ml-3 mb-1">
                  <Stamp score={result.score} />
                </div>
                <p className="mt-4 font-serif text-xl font-bold leading-relaxed text-[#1A1714]">
                  「{result.tsukkomi}」
                </p>
              </div>
            </div>

            {/* 正しい説明 & 足りなかったキーワード */}
            <div className="border-2 border-[#1A1714] bg-[#F7F1E3] p-5 shadow-[4px_4px_0_0_#1A1714]">
              <h3 className="font-serif text-lg font-bold text-[#1A1714]">ほんまのところ</h3>

              <InteractiveExplanation
                text={result.correct}
                missedWords={result.missed}
                onWordClick={(word) => askChat(`「${word}」ってどういう意味？`)}
                onAddTerm={handleAddQuickTerm}
              />
            </div>

            {/* ミニ課題ミッション */}
            <div className="border-2 border-[#1A1714] bg-[#1A1714] p-5 text-[#F7F1E3] shadow-[4px_4px_0_0_#1A1714]">
              <h3 className="font-serif font-bold text-[#D9A441]">
                今すぐ手を動かすミッション
              </h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">{result.mission}</p>
            </div>

            {/* 答えた後限定：聞き返しチャット */}
            <div
              ref={chatSectionRef}
              className="border-2 border-[#1A1714] bg-[#F7F1E3] shadow-[6px_6px_0_0_#1A1714]"
            >
              <div className="border-b-2 border-[#1A1714] px-4 py-3">
                <h3 className="font-serif text-base font-bold">覚える君に聞き返す</h3>
                <p className="text-xs text-[#1A1714]/60">
                  出てきた言葉で分からんものは、その場で潰しとく
                </p>
              </div>

              {/* 質問クイックボタン（いつでも追加質問可能） */}
              <div className="flex flex-wrap gap-2 border-b border-[#1A1714]/15 bg-white/50 px-4 py-2.5">
                <button
                  onClick={() => askChat('もっと簡単に小学生でもわかるように言い直して')}
                  disabled={chatLoading}
                  className="border border-[#1A1714] bg-white px-2.5 py-1 text-xs font-bold hover:bg-[#1A1714] hover:text-[#F7F1E3] disabled:opacity-50"
                >
                  もっと簡単に
                </button>
                <button
                  onClick={() => askChat('似ている他の用語と何が違うのか教えて')}
                  disabled={chatLoading}
                  className="border border-[#1A1714] bg-white px-2.5 py-1 text-xs font-bold hover:bg-[#1A1714] hover:text-[#F7F1E3]"
                >
                  他と何が違う？
                </button>
                <button
                  onClick={() => askChat('実際のコードのどこにどう書くのか具体例を見せて')}
                  disabled={chatLoading}
                  className="border border-[#1A1714] bg-white px-2.5 py-1 text-xs font-bold hover:bg-[#1A1714] hover:text-[#F7F1E3]"
                >
                  コードのどこに書く？
                </button>
                <button
                  onClick={() => askChat('実務や現場では具体的にどう使われる？使わないとどう困る？')}
                  disabled={chatLoading}
                  className="border border-[#1A1714] bg-white px-2.5 py-1 text-xs font-bold hover:bg-[#1A1714] hover:text-[#F7F1E3]"
                >
                  実務での使い道
                </button>
                <button
                  onClick={() => askChat('別の身近な日常シーン（料理・買い物など）に例えて説明して')}
                  disabled={chatLoading}
                  className="border border-[#1A1714] bg-white px-2.5 py-1 text-xs font-bold hover:bg-[#1A1714] hover:text-[#F7F1E3]"
                >
                  別の例えで
                </button>
                <button
                  onClick={() => askChat('流れや仕組みを分かりやすくテキスト図解して！')}
                  disabled={chatLoading}
                  className="border border-[#1A1714] bg-white px-2.5 py-1 text-xs font-bold hover:bg-[#1A1714] hover:text-[#F7F1E3]"
                >
                  テキスト図解
                </button>
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

              <div className="flex gap-2 p-4">
                <MicButton
                  onText={(t) => setChatInput((c) => (c ? c.trim() + ' ' : '') + t)}
                  onError={setError}
                  label=""
                />
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
                      e.preventDefault();
                      askChat();
                    }
                  }}
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
              {sessionLimit > 0 && sessionIndex >= sessionLimit ? (
                <button
                  onClick={() => setView('session_summary')}
                  className="flex-1 border-2 border-[#1A1714] bg-[#B83227] px-4 py-3 font-bold text-[#F7F1E3] hover:bg-[#9c2a20] shadow-[3px_3px_0_0_#1A1714]"
                >
                  🎉 {sessionLimit}問セッション完了！結果を見る
                </button>
              ) : (
                <button
                  onClick={() => startQuiz(false, selectedTag, false)}
                  className="flex-1 border-2 border-[#1A1714] bg-[#B83227] px-4 py-3 font-bold text-[#F7F1E3] hover:bg-[#9c2a20]"
                >
                  次のお題へ（{sessionIndex + 1}/{sessionLimit > 0 ? sessionLimit : '∞'}問）
                </button>
              )}
              <button
                onClick={() => setView('home')}
                className="border-2 border-[#1A1714] bg-[#F7F1E3] px-4 py-3 font-bold hover:bg-[#1A1714]/5"
              >
                ホームへ戻る
              </button>
            </div>
          </div>
        )}

        {/* 4. セッション完了サマリー画面 (View === 'session_summary') */}
        {view === 'session_summary' && (
          <div className="border-2 border-[#1A1714] bg-[#F7F1E3] p-6 shadow-[6px_6px_0_0_#1A1714] space-y-5">
            <div className="text-center">
              <span className="text-5xl">🏆</span>
              <h2 className="mt-2 font-serif text-2xl font-bold text-[#1A1714]">
                {sessionLimit}問セッション達成！
              </h2>
              <p className="font-mono text-xs font-bold text-[#8a6300]">
                SESSION COMPLETE
              </p>
            </div>

            {/* スコアまとめカード */}
            <div className="border-2 border-[#1A1714] bg-white p-5 text-center">
              <p className="text-xs font-bold text-[#1A1714]/60">今回の平均スコア</p>
              <p className="font-serif text-5xl font-bold text-[#B83227] mt-1">
                {sessionScores.length > 0
                  ? Math.round(sessionScores.reduce((a, b) => a + b, 0) / sessionScores.length)
                  : 0}
                <span className="text-base font-normal text-[#1A1714] ml-1">点</span>
              </p>
              <div className="mt-3 flex justify-center gap-2 font-mono text-xs">
                {sessionScores.map((score, i) => (
                  <span
                    key={i}
                    className={`border px-2 py-1 font-bold ${
                      score >= 80
                        ? 'border-[#B83227] bg-[#B83227]/10 text-[#B83227]'
                        : 'border-[#1A1714]/30 bg-[#1A1714]/5 text-[#1A1714]'
                    }`}
                  >
                    問{i + 1}: {score}点
                  </span>
                ))}
              </div>
            </div>

            {/* コーチの激励 */}
            <div className="border-l-4 border-[#D9A441] bg-[#D9A441]/15 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{COACH_LIST.find((c) => c.id === coach)?.icon}</span>
                <p className="font-serif text-sm font-bold text-[#1A1714]">
                  {COACH_LIST.find((c) => c.id === coach)?.name}
                </p>
              </div>
              <p className="mt-1 text-sm font-bold text-[#1A1714]/90">
                「ええペースや！こうやって{sessionLimit}問ずつ隙間時間に回すのが一番記憶に残るんやで！この調子でいこ！」
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => startQuiz(false, selectedTag, true)}
                className="flex-1 border-2 border-[#1A1714] bg-[#B83227] px-4 py-3 font-bold text-[#F7F1E3] hover:bg-[#9c2a20] transition-colors"
              >
                ⚡ もう1セットやる（+{sessionLimit}問）
              </button>
              <button
                onClick={() => setView('home')}
                className="flex-1 border-2 border-[#1A1714] bg-[#F7F1E3] px-4 py-3 font-bold hover:bg-[#1A1714]/5 transition-colors"
              >
                ホームへ戻る
              </button>
            </div>
          </div>
        )}

        {/* 5. 用語追加画面 (View === 'add') */}
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
                  講義回・分野タグ（例: 第1回講義 / React / Git）
                </label>
                <input
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  placeholder="例: 第1回講義"
                  className="mt-1 w-full border-2 border-[#1A1714] bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#B83227]"
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

interface InteractiveExplanationProps {
  text: string;
  missedWords?: string[];
  onWordClick: (word: string) => void;
  onAddTerm?: (word: string) => void;
}

function InteractiveExplanation({
  text,
  missedWords = [],
  onWordClick,
  onAddTerm,
}: InteractiveExplanationProps) {
  // 解説文から「真のIT専門用語・プロトコル名」だけを厳選抽出（日常語や例え話は除外）
  const detectedKeywords = React.useMemo(() => {
    const list: string[] = [];

    // 1. missedWords（言えなかった重要キーワード）
    missedWords.forEach((m) => {
      const clean = m.replace(/[()（）=＝].*$/, '').trim();
      if (
        clean &&
        clean.length >= 2 &&
        clean.length <= 15 &&
        !clean.includes(' ') &&
        !['からあげ', 'お弁当', '寿司', '仕組み', '本質', 'メリット'].some((ng) => clean.includes(ng)) &&
        !list.includes(clean)
      ) {
        list.push(clean);
      }
    });

    // 2. 代表的なIT・Web専門用語・プロトコル名のみマッチ（大文字小文字対応）
    const technicalTerms = [
      'TCP/IP', 'TCP', 'UDP', 'QUIC', 'HTTP/2', 'HTTP/3', 'HTTP', 'HTTPS',
      'Content-Type', 'Cookie', 'Header', 'Body', 'Status Code', 'REST', 'API',
      'JSON', 'HTML', 'CSS', 'JavaScript', 'TypeScript', 'SSR', 'CSR', 'SQL',
      'DNS', 'SSL', 'TLS', 'MIME', 'POST', 'GET', 'PUT', 'DELETE',
      'useState', 'useEffect', 'props', 'Next.js', 'React', 'Supabase'
    ];

    technicalTerms.forEach((term) => {
      const regex = new RegExp(`\\b${term.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
      if (regex.test(text) && !list.some((existing) => existing.toLowerCase() === term.toLowerCase())) {
        list.push(term);
      }
    });

    // 最大5個までに厳選
    return list.slice(0, 5);
  }, [text, missedWords]);

  return (
    <div>
      {/* 本文は一切の枠線・ボタン装飾を排除し、自然で美しい文章として表示 */}
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-[#1A1714]">
        {text}
      </p>

      {/* 厳選された専門用語チップ（最大5個） */}
      {detectedKeywords.length > 0 && (
        <div className="mt-4 border-t border-[#1A1714]/15 pt-3">
          <p className="text-xs font-bold text-[#1A1714]/70">
            💬 関連用語を質問する（タップで質問 / ＋で単語帳に追加）:
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {detectedKeywords.map((k, i) => (
              <div
                key={i}
                className="inline-flex items-center border border-[#B83227] bg-white text-xs font-bold text-[#B83227] shadow-[2px_2px_0_0_#1A1714]"
              >
                <button
                  type="button"
                  onClick={() => onWordClick(k)}
                  className="px-2.5 py-1 hover:bg-[#B83227] hover:text-[#F7F1E3] transition-colors"
                >
                  {k} <span className="font-mono text-[10px]">?</span>
                </button>
                {onAddTerm && (
                  <button
                    type="button"
                    onClick={() => onAddTerm(k)}
                    title={`「${k}」を復習リストに新規追加`}
                    className="border-l border-[#B83227]/30 px-2 py-1 text-[11px] hover:bg-[#D9A441] hover:text-[#1A1714] transition-colors"
                  >
                    ＋追加
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
