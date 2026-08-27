'use client';

import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import Stamp from '@/components/Stamp';
import AuthModal from '@/components/AuthModal';
import NotificationModal from '@/components/NotificationModal';
import FileImporter from '@/components/FileImporter';
import TermAuditModal from '@/components/TermAuditModal';
import DeleteAllTermsModal from '@/components/DeleteAllTermsModal';
import EditTermModal from '@/components/EditTermModal';
import QuickQuizSession from '@/components/QuickQuizSession';
import RenameTagModal from '@/components/RenameTagModal';
import { Term, getTermTag } from '@/lib/types';
import { CoachType, COACH_LIST } from '@/lib/coach';
import { todayStr } from '@/lib/date';
import { INTERVALS, SCORE_KEEP } from '@/lib/constants';
import { triggerScoreEffects, triggerSessionCompleteEffects, triggerRankUpEffects } from '@/lib/effects';
import {
  fetchLearnerStats,
  getRankByReviews,
  recordReviewStats,
  isBossTerm,
  LearnerRank,
  LearnerStats,
} from '@/lib/learnerRank';
import RetentionMeter from '@/components/RetentionMeter';
import BossAlertBanner from '@/components/BossAlertBanner';

export default function Home() {
  const [terms, setTerms] = useState<Term[] | null>(null);
  const [view, setView] = useState<'home' | 'quiz' | 'quick_quiz' | 'result' | 'add' | 'session_summary'>('home');
  const [sessionMode, setSessionMode] = useState<'standard' | 'quick'>('standard');
  const [current, setCurrent] = useState<Term | null>(null);
  const [answer, setAnswer] = useState('');
  // 採点結果はストリーミングで届く（点数→ツッコミ→解説→…の順に段階的に確定する）ため、
  // score以外のフィールドは届くまでundefined。mission が入っていれば全項目が
  // 揃った合図として扱う（プロンプト側でJSONの最後のキーに固定しているため）。
  const [result, setResult] = useState<{
    score: number;
    tsukkomi?: string;
    correct?: string;
    missed?: string[];
    mission?: string;
    related?: string[];
  } | null>(null);
  // 表示中の result が「わからん」経由の申告かどうか。
  // 正直に申告した人をシェイク・雨粒などの罰的演出で叩かないための判定に使う。
  const [isWakaranResult, setIsWakaranResult] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newTerm, setNewTerm] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newTag, setNewTag] = useState('');

  // セッション問題数設定 (3 | 5 | 10 | 0 = 無制限)
  const [sessionLimit, setSessionLimit] = useState<number>(3);
  const [sessionIndex, setSessionIndex] = useState<number>(1);
  const [sessionScores, setSessionScores] = useState<number[]>([]);
  // 今回のセッションでのレベル変動履歴（リザルト画面表示用）
  const [sessionLevelChanges, setSessionLevelChanges] = useState<
    { term: string; fromLevel: number; toLevel: number; score: number; isBoss?: boolean }[]
  >([]);
  // 今回のセッションで昇格した称号ランク（昇格時にファンファーレ表示）
  const [promotedRank, setPromotedRank] = useState<LearnerRank | null>(null);

  // ユーザーの学習実績・称号ランク情報
  const [learnerStats, setLearnerStats] = useState<LearnerStats>({
    totalReviews: 0,
    totalCorrect: 0,
    currentRank: 1,
  });

  // セッション開始時の出題条件。2問目以降も同じ条件で出題するために保持する。
  // これが無かった頃は「次のお題へ」が常に due（今日の復習）から引き直していたため、
  // 先取り復習（due が0件の状態で始めるモード）に入ると2問目が引けず、
  // ボタンを押しても何も起きなかった。
  const [sessionForceAll, setSessionForceAll] = useState(false);
  const [sessionTag, setSessionTag] = useState<string>('all');
  // このセッションで既に出した用語。同じお題が繰り返し出るのを防ぐ。
  const [askedIds, setAskedIds] = useState<string[]>([]);

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
  const [showAudit, setShowAudit] = useState(false);
  const [showDeleteAll, setShowDeleteAll] = useState(false);
  const [editingTerm, setEditingTerm] = useState<Term | null>(null);
  const [renamingTag, setRenamingTag] = useState<string | null>(null);

  const handleTagRenamed = (oldTag: string, newTag: string) => {
    if (terms) {
      const updated = terms.map((t) =>
        getTermTag(t) === oldTag || t.tag === oldTag ? { ...t, tag: newTag } : t
      );
      setTerms(updated);
    }
    if (selectedTag === oldTag) {
      setSelectedTag(newTag);
    }
  };

  // ユーザー名＆学習実績（称号）の初期読み込み
  useEffect(() => {
    const savedName = localStorage.getItem('oboeru_user_name');
    if (savedName) {
      setUserName(savedName);
      setNameInput(savedName);
    }
    fetchLearnerStats().then(setLearnerStats);
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

  // セッション完了時の紙吹雪演出（称号昇格時は特大ファンファーレ）
  useEffect(() => {
    if (view === 'session_summary' && sessionScores.length > 0) {
      if (promotedRank) {
        triggerRankUpEffects();
      } else {
        const avg = Math.round(sessionScores.reduce((a, b) => a + b, 0) / sessionScores.length);
        triggerSessionCompleteEffects(avg);
      }
    }
  }, [view, sessionScores, promotedRank]);

  // 復習セッション中のスワイプバック／戻るボタン対策。
  // 以前は view が useState だけで履歴に乗らず、通勤中に1問だけ答えようとして
  // ブラウザの戻るジェスチャを使うと、そのままアプリごと閉じていた
  // （記録もスケジュールも汚さず離脱する手段が実質存在しなかった）。
  // セッション開始時に履歴を1つ積んでおき、popstate（戻る操作）が来たら
  // ページ遷移そのものはブラウザに任せつつ、アプリの状態だけホームへ戻す。
  useEffect(() => {
    const onPopState = () => setView('home');
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

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

  interface StartQuizOptions {
    /** 復習日を無視して全件から出題する（先取り復習・集中特訓） */
    forceAll?: boolean;
    /** 出題対象のタグ。省略時は現在選択中のタグ */
    tag?: string;
    /** true でセッションを最初から開始、false で現在のセッションの続き */
    reset?: boolean;
    /** 問題番号を進めるか。回答せずに用語を除外した場合は進めない */
    advanceIndex?: boolean;
    /** 出題モード ('standard': 記述説明, 'quick': 4択) */
    mode?: 'standard' | 'quick';
  }

  const startQuiz = ({
    forceAll,
    tag,
    reset = true,
    advanceIndex = true,
    mode,
  }: StartQuizOptions = {}) => {
    // 継続時はセッション開始時の条件を引き継ぐ。ここを毎回 due から引き直していたのが
    // 「先取り復習に入ると次のお題へが無反応」の原因だった。
    const useForceAll = reset ? Boolean(forceAll) : sessionForceAll;
    const tagToUse = reset ? (tag !== undefined ? tag : selectedTag) : sessionTag;
    const useMode = reset ? (mode || 'standard') : sessionMode;

    let targetPool: Term[] = [];

    if (tagToUse === 'all' || tagToUse === 'due') {
      targetPool = useForceAll ? terms || [] : due;
    } else {
      const tagTerms = (terms || []).filter((t) => getTermTag(t) === tagToUse);
      const dueTagTerms = tagTerms.filter((t) => t.next_review_at <= today);
      targetPool = useForceAll || dueTagTerms.length === 0 ? tagTerms : dueTagTerms;
    }

    if (targetPool.length === 0) {
      setError('出題できる用語がありません。用語を追加するか、フィルターを変えてみてください。');
      return;
    }

    // このセッションで既に出した用語を除く（同じお題が2回出るのを防ぐ）
    const asked = reset ? [] : askedIds;
    const unasked = targetPool.filter((t) => !asked.includes(t.id));

    // 用語数がセッションの問題数より少ないと、途中で出し切ってしまう。
    // 同じお題を繰り返すより、そこでセッションを終える方が納得感がある。
    if (unasked.length === 0) {
      setView(sessionScores.length > 0 ? 'session_summary' : 'home');
      return;
    }

    const randomTerm = unasked[Math.floor(Math.random() * unasked.length)];
    setCurrent(randomTerm);
    setAnswer('');
    setResult(null);
    setIsWakaranResult(false);
    setChat([]);
    setChatInput('');
    setError('');
    setShowHint(false);

    if (reset) {
      setSessionMode(useMode);
      setSessionForceAll(useForceAll);
      setSessionTag(tagToUse);
      setAskedIds([randomTerm.id]);
      setSessionIndex(1);
      setSessionScores([]);
      setSessionLevelChanges([]);
      setPromotedRank(null);
      // セッション開始時に履歴を1つ積む。popstate ハンドラ（上のuseEffect）と
      // 対になっており、これが無いと戻るジェスチャがアプリの外まで抜けてしまう。
      if (typeof window !== 'undefined') {
        window.history.pushState({ oboeruSession: true }, '');
      }
    } else {
      setAskedIds([...asked, randomTerm.id]);
      if (advanceIndex) setSessionIndex((prev) => prev + 1);
    }

    setView(useMode === 'quick' ? 'quick_quiz' : 'quiz');
  };

  const handleQuickAnswerSaved = (data: {
    isCorrect: boolean;
    score: number;
    updatedLevel: number;
    nextReviewAt: string;
    lastScore: number;
  }) => {
    if (!current) return;
    const bossInfo = isBossTerm(current);
    setSessionScores((prev) => [...prev, data.score]);
    setSessionLevelChanges((prev) => [
      ...prev,
      {
        term: current.term,
        fromLevel: current.level,
        toLevel: data.updatedLevel,
        score: data.score,
        isBoss: bossInfo.isBoss,
      },
    ]);

    // 称号Statsの記録とランクアップ判定
    recordReviewStats(learnerStats, 1, data.isCorrect ? 1 : 0).then(({ newStats, promotedRank: rankUp }) => {
      setLearnerStats(newStats);
      if (rankUp) {
        setPromotedRank(rankUp);
      }
    });

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
  };


  const grade = async (overrideAnswer?: string) => {
    if (!current) return;
    setLoading(true);
    setError('');
    setResult(null);

    const textToSubmit = overrideAnswer !== undefined ? overrideAnswer : answer;
    const wakaran = textToSubmit === '(わからん)';
    setIsWakaranResult(wakaran);

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
          currentNextReviewAt: current.next_review_at,
          // 「先取り復習」「集中特訓」で、まだ復習日が来ていない用語を前倒しで
          // 解いた場合はサーバー側に伝える。忘却曲線のスケジュールを
          // 前倒し操作で壊さないための判定に使う。
          isAheadOfSchedule: current.next_review_at > today,
          coach,
          userName,
        }),
      });

      if (!res.ok || !res.body) {
        let msg = '採点でコケた。もう一回「答える」を押してみて。';
        try {
          const data = await res.json();
          msg = data.error || msg;
        } catch {
          // レスポンスボディがJSONでない（ネットワーク断等）場合はデフォルトメッセージのまま
        }
        throw new Error(msg);
      }

      // /api/grade はNDJSON（改行区切りJSON）でストリーミングされる。
      // 点数・ツッコミ・解説・ミッションが出来上がった順に1行ずつ届くので、
      // 15秒前後かかる生成の完了を待たず、届いた分から画面に反映していく。
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = '';
      let finalPayload: { result: typeof result; updatedLevel: number; nextReviewAt: string; lastScore: number } | null = null;
      let streamError: string | null = null;
      let switchedToResultView = false;
      let hasTriggeredEffect = false;

      const handleLine = (line: string) => {
        if (!line.trim()) return;
        const evt = JSON.parse(line);
        if (evt.type === 'partial') {
          setResult((prev) => ({ ...(prev ?? { score: evt.partial.score ?? 0 }), ...evt.partial }));
          if (!switchedToResultView) {
            switchedToResultView = true;
            setView('result');
          }
          // 点数が届いた瞬間に即座にアニメーション（桜吹雪やシェイク）を発火！
          if (!hasTriggeredEffect && typeof evt.partial.score === 'number') {
            hasTriggeredEffect = true;
            triggerScoreEffects(evt.partial.score, wakaran);
          }
        } else if (evt.type === 'final') {
          finalPayload = evt;
        } else if (evt.type === 'error') {
          streamError = evt.error;
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, idx);
          buf = buf.slice(idx + 1);
          handleLine(line);
        }
      }
      if (buf.trim()) handleLine(buf);

      if (streamError) throw new Error(streamError);
      if (!finalPayload) throw new Error('採点でコケた。もう一回「答える」を押してみて。');

      const data = finalPayload as { result: NonNullable<typeof result>; updatedLevel: number; nextReviewAt: string; lastScore: number };

      setResult(data.result);
      setSessionScores((prev) => [...prev, data.result.score]);

      const bossInfo = isBossTerm(current);
      setSessionLevelChanges((prev) => [
        ...prev,
        {
          term: current.term,
          fromLevel: current.level,
          toLevel: data.updatedLevel,
          score: data.result.score,
          isBoss: bossInfo.isBoss,
        },
      ]);

      // 称号Statsの記録とランクアップ判定
      const isCorrect = data.result.score >= 80;
      const { newStats, promotedRank: rankUp } = await recordReviewStats(learnerStats, 1, isCorrect ? 1 : 0);
      setLearnerStats(newStats);
      if (rankUp) {
        setPromotedRank(rankUp);
      }

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

      // 保険: partialで発火していなかった場合のみ最終スコアで発火
      if (!hasTriggeredEffect) {
        triggerScoreEffects(data.result.score, wakaran);
      }

      setView('result');
    } catch (err: any) {
      setError(err?.message || '採点でコケた。もう一回「答える」を押してみて。');
    } finally {
      setLoading(false);
    }
  };

  const askChat = async (questionText?: string) => {
    // result.mission は解説ストリームの最後に届くフィールド。まだ届いていない
    // ということは correct/mission もまだ空で、チャットに渡す文脈が揃っていない。
    if (!current || !result || !result.mission) return;
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
        // 以前は理由を問わず「すでに登録されているか、登録に失敗しました」と
        // 出していたが、実際には重複チェック自体が無く、押すたびに増えていた。
        // いまはサーバーが 409（重複）と 500（失敗）を区別して返す。
        alert(data.error || '登録に失敗しました。');
      }
    } catch {
      alert('登録中にエラーが発生しました。');
    }
  };

  // 初回ユーザー向けの「まずはこれで試す」用サンプル用語。
  // 1タップで3件登録し、その場で1問回してもらうところまでを初回導線にする。
  const SAMPLE_TERMS = [
    { term: 'useState', note: 'Reactでコンポーネントの状態を持つためのフック', tag: 'サンプル' },
    { term: 'API', note: 'アプリ同士がデータをやり取りするための窓口', tag: 'サンプル' },
    { term: 'Git', note: 'コードの変更履歴を管理するツール', tag: 'サンプル' },
  ];

  const handleAddSampleTerms = async () => {
    try {
      const results = await Promise.all(
        SAMPLE_TERMS.map((t) =>
          fetch('/api/terms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(t),
          }).then(async (r) => ({ ok: r.ok, body: await r.json() }))
        )
      );

      const added = results.filter((r) => r.ok && r.body.term).map((r) => r.body.term);
      if (added.length > 0) {
        setTerms((prev) => (prev ? [...added, ...prev] : added));
      }
      // すぐに1問回してもらう（登録できた分だけで開始）
      setTimeout(() => startQuiz({ forceAll: true, tag: 'all', reset: true }), 0);
    } catch {
      setError('サンプル用語の登録に失敗しました。もう一度試してください。');
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

      // 回答せずに除外しただけなので、問題番号は進めずに差し替えのお題を出す
      // （進めると「3問セッション」が実質2問で終わってしまう）。
      // 出せる用語が尽きていれば startQuiz 側でサマリー／ホームへ抜ける。
      startQuiz({ reset: false, advanceIndex: false });
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

  // サマリーで使う「実際に答えた問題数」。
  // sessionLimit をそのまま表示すると、全問モード（0）や、
  // 用語を出し切って途中で終わった時に「0問セッション達成！」になってしまう。
  const answeredCount = sessionScores.length;

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
            // 以前はここで即座にモーダルを閉じていたため、FileImporter側で
            // 「登録◯件 / 重複◯件 / 失敗◯件」の結果を表示しても
            // 表示される前に画面が消えていた。ユーザーが結果を見てから
            // 自分で「✕ 閉じる」を押すまでモーダルは開いたままにする。
          }}
        />
      )}

      {/* 単語帳の棚卸しモーダル */}
      {showAudit && (
        <TermAuditModal
          onClose={() => setShowAudit(false)}
          onDeleted={(deletedIds) => {
            setTerms((prev) => (prev ? prev.filter((t) => !deletedIds.includes(t.id)) : prev));
          }}
        />
      )}

      {/* 全削除モーダル */}
      {showDeleteAll && terms && (
        <DeleteAllTermsModal
          termIds={terms.map((t) => t.id)}
          onClose={() => setShowDeleteAll(false)}
          onDeleted={(deletedIds) => {
            setTerms((prev) => (prev ? prev.filter((t) => !deletedIds.includes(t.id)) : prev));
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

      {/* 分野（タグ）名一括変更モーダル */}
      {renamingTag && (
        <RenameTagModal
          isOpen={Boolean(renamingTag)}
          oldTag={renamingTag}
          termCount={terms ? terms.filter((t) => getTermTag(t) === renamingTag || t.tag === renamingTag).length : 0}
          onClose={() => setRenamingTag(null)}
          onRenamed={handleTagRenamed}
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

          {/* 称号＆ニックネーム設定ボタン */}
          {(() => {
            const currentRank = getRankByReviews(learnerStats.totalReviews);
            return (
              <button
                onClick={() => {
                  setNameInput(userName);
                  setShowNameModal(true);
                }}
                className="flex items-center justify-between border-2 border-[#1A1714] bg-[#F7F1E3] px-3 py-2 sm:px-3.5 sm:py-2.5 shadow-[3px_3px_0_0_#1A1714] hover:bg-[#ede8d0] transition-colors"
                title={`累計復習: ${learnerStats.totalReviews}回（正解: ${learnerStats.totalCorrect}回）`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xl sm:text-2xl shrink-0" title={`称号ランク ${currentRank.rank}`}>
                    {currentRank.icon}
                  </span>
                  <div className="text-left min-w-0">
                    <div className="flex items-center gap-1">
                      <p className="font-mono text-[9px] font-bold tracking-wider text-[#1A1714]/60">
                        LEARNER <span className="text-[#8a6300]">Rank {currentRank.rank}</span>
                      </p>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-[#B83227] truncate">
                      <span className="text-[10px] sm:text-xs text-[#1A1714]/75 font-normal mr-0.5">
                        {currentRank.title}
                      </span>
                      {userName} さん
                    </p>
                  </div>
                </div>
                <span className="font-mono text-[10px] text-[#1A1714]/50 shrink-0">✏️</span>
              </button>
            );
          })()}
        </div>

        {error && (
          <div className="mb-4 border-2 border-[#B83227] bg-[#F7F1E3] px-4 py-3 text-sm font-bold text-[#B83227] shadow-[4px_4px_0_0_#1A1714]">
            {error}
          </div>
        )}

        {/* 1. ホーム画面 (View === 'home') */}
        {view === 'home' && (
          <div className="space-y-3.5 sm:space-y-4">
            {/* 復習・特訓状況カード（最優先アクション：開いた瞬間に解ける） */}
            {terms.length === 0 ? (
              // 初回ユーザー向けの空状態
              <div className="border-2 border-[#1A1714] bg-[#F7F1E3] p-4 sm:p-6 shadow-[4px_4px_0_0_#1A1714]">
                <h3 className="font-serif text-lg sm:text-xl font-bold text-[#1A1714]">
                  まだ用語が1件もないで
                </h3>
                <p className="mt-1.5 text-xs sm:text-sm leading-relaxed text-[#1A1714]/80">
                  覚える君は、説明を「読む」んやなくて「自分の言葉で書く」ことで記憶に残す復習コーチや。
                  まずは覚えたい用語を1件登録してみて。
                </p>

                <div className="mt-4 flex flex-col gap-2">
                  <button
                    onClick={() => setShowImporter(true)}
                    className="w-full border-2 border-[#1A1714] bg-[#1A1714] px-4 py-2.5 text-sm font-bold text-[#F7F1E3] transition hover:bg-[#332f2b]"
                  >
                    📄 講義資料から一気に取り込む
                  </button>
                  <button
                    onClick={() => setView('add')}
                    className="w-full border-2 border-[#1A1714] bg-white px-4 py-2 text-xs sm:text-sm font-bold transition hover:bg-[#1A1714]/5"
                  >
                    ✏️ 手で1つ入れてみる
                  </button>
                  <button
                    onClick={handleAddSampleTerms}
                    className="w-full border border-[#1A1714]/40 bg-transparent px-4 py-1.5 text-xs font-bold text-[#1A1714]/70 underline transition hover:text-[#1A1714]"
                  >
                    まずはサンプル用語で1問試してみる
                  </button>
                </div>
              </div>
            ) : selectedTag !== 'all' && selectedTag !== 'due' ? (
              // 選択された特定分野の集中特訓カード
              <div className="border-2 border-[#1A1714] bg-[#F7F1E3] p-4 sm:p-5 shadow-[4px_4px_0_0_#1A1714]">
                <div className="flex items-center justify-between">
                  <span className="inline-block border border-[#1A1714] bg-[#D9A441]/20 px-2 py-0.5 font-mono text-[10px] sm:text-xs font-bold text-[#1A1714]">
                    🏷️ 集中特訓モード
                  </span>
                  <span className="text-[11px] font-mono font-bold text-[#1A1714]/70">
                    今日復習: {filteredDue.length}件 / 全{filteredTerms.length}件
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#1A1714]">
                    {selectedTag}
                  </h3>
                  <button
                    onClick={() => setRenamingTag(selectedTag)}
                    className="flex items-center gap-1 border border-[#1A1714] bg-white px-2 py-0.5 text-xs font-bold text-[#1A1714] hover:bg-[#1A1714] hover:text-white transition-colors shadow-[2px_2px_0_0_#1A1714]"
                    title="この分野の名前を一括変更する"
                  >
                    ✏️ 名前変更
                  </button>
                </div>

                {/* 問題数コース選択 */}
                <div className="mt-3 border-t border-[#1A1714]/15 pt-2">
                  <p className="text-[10px] sm:text-[11px] font-bold text-[#1A1714]/70 mb-1">何問チャレンジする？</p>
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
                        className={`border-2 p-1 text-center transition-all ${
                          sessionLimit === c.count
                            ? 'border-[#1A1714] bg-[#1A1714] text-[#F7F1E3] font-bold shadow-[2px_2px_0_0_#D9A441]'
                            : 'border-[#1A1714]/30 bg-white hover:border-[#1A1714]'
                        }`}
                      >
                        <p className="font-bold text-xs">{c.label}</p>
                        <p className="text-[9px] opacity-70">{c.time}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3.5 flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={() => startQuiz({ forceAll: true, tag: selectedTag, reset: true, mode: 'standard' })}
                    disabled={filteredTerms.length === 0}
                    className="flex-1 border-2 border-[#1A1714] bg-[#1A1714] px-4 py-2.5 font-bold text-[#F7F1E3] transition hover:bg-[#332f2b] text-xs sm:text-sm"
                  >
                    ✍️ 【{selectedTag}】を記述特訓 ({sessionLimit > 0 ? `${sessionLimit}問` : '全問'})
                  </button>
                  <button
                    onClick={() => startQuiz({ forceAll: true, tag: selectedTag, reset: true, mode: 'quick' })}
                    disabled={filteredTerms.length === 0}
                    className="border-2 border-[#1A1714] bg-[#D9A441] px-4 py-2.5 font-bold text-[#1A1714] transition hover:bg-[#c99534] shadow-[2px_2px_0_0_#1A1714] text-xs sm:text-sm"
                  >
                    ⚡ 4択で特訓
                  </button>
                </div>
              </div>
            ) : due.length > 0 ? (
              // 今日の復習カード（デイリー目標：あと3問主役デザイン）
              (() => {
                const effectiveLimit = sessionLimit > 0 ? sessionLimit : due.length;
                const timeLabel = sessionLimit === 3 ? '1分' : sessionLimit === 5 ? '3分' : sessionLimit === 10 ? '5分' : 'じっくり';
                return (
                  <div className="border-2 border-[#1A1714] bg-[#F7F1E3] p-4 sm:p-5 shadow-[4px_4px_0_0_#1A1714]">
                    {/* ヘッダー＆待機ストック */}
                    <div className="flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 border border-[#B83227] bg-[#B83227]/10 px-2 py-0.5 font-mono text-[10px] sm:text-xs font-bold text-[#B83227]">
                        🎯 今日のデイリー目標
                      </span>
                      <span className="font-mono text-[10px] sm:text-[11px] text-[#1A1714]/60">
                        待機ストック: 全{due.length}件
                      </span>
                    </div>

                    {/* メインの目標問題数 */}
                    <div className="mt-2.5">
                      <p className="font-serif text-3xl sm:text-4xl font-bold leading-none text-[#1A1714]">
                        あと <span className="text-[#B83227] text-4xl sm:text-5xl">{effectiveLimit}</span> 問
                        <span className="ml-2 font-sans text-xs sm:text-sm font-normal text-[#1A1714]/70">
                          （目安: 約{timeLabel}）
                        </span>
                      </p>
                    </div>

                    {/* コーチの安心メッセージ */}
                    <div className="mt-2.5 rounded border border-[#1A1714]/15 bg-white/70 px-3 py-2">
                      <p className="text-xs font-bold leading-relaxed text-[#1A1714]/85">
                        💬 「ストックは全{due.length}件あるけど、一気にやらんでええ！まずは今日の{effectiveLimit}問（{timeLabel}）サクッと解いたら合格や！」
                      </p>
                    </div>

                    {/* 問題数ペース選択 */}
                    <div className="mt-3 border-t border-[#1A1714]/15 pt-2">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-[10px] sm:text-[11px] font-bold text-[#1A1714]/70">今日のペースを選ぶ</p>
                        <span className="font-mono text-[9px] text-[#1A1714]/50">タップで目標変更</span>
                      </div>
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
                            className={`border-2 p-1 text-center transition-all ${
                              sessionLimit === c.count
                                ? 'border-[#1A1714] bg-[#B83227] text-[#F7F1E3] font-bold shadow-[2px_2px_0_0_#1A1714]'
                                : 'border-[#1A1714]/30 bg-white hover:border-[#1A1714]'
                            }`}
                          >
                            <p className="font-bold text-xs">{c.label}</p>
                            <p className="text-[9px] opacity-70">{c.time}</p>
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 出題開始ボタン */}
                    <div className="mt-3.5 space-y-2">
                      <button
                        onClick={() => startQuiz({ reset: true, mode: 'standard' })}
                        className="w-full border-2 border-[#1A1714] bg-[#B83227] px-4 py-3 font-bold text-[#F7F1E3] shadow-[3px_3px_0_0_#1A1714] transition hover:bg-[#9c2a20] flex items-center justify-center gap-2 text-sm sm:text-base"
                      >
                        <span>✍️</span>
                        <span>{sessionLimit > 0 ? `今日の目標（${sessionLimit}問）をサクッと解く` : '全問じっくりチャレンジする'}</span>
                      </button>
                      <button
                        onClick={() => startQuiz({ reset: true, mode: 'quick' })}
                        className="w-full border-2 border-[#1A1714] bg-[#D9A441] px-4 py-2 font-bold text-[#1A1714] shadow-[2px_2px_0_0_#1A1714] transition hover:bg-[#c99534] flex items-center justify-center gap-1.5 text-xs sm:text-sm"
                      >
                        <span>⚡️</span>
                        <span>特急・4択モードで解く（スキマ時間・電車用）</span>
                      </button>
                    </div>
                  </div>
                );
              })()
            ) : (
              // 本日のノルマ完了カード
              <div className="border-2 border-[#1A1714] bg-[#F7F1E3] p-4 sm:p-5 shadow-[4px_4px_0_0_#1A1714]">
                <div className="flex items-center gap-2.5">
                  <span className="text-2xl sm:text-3xl">🎉</span>
                  <div>
                    <h3 className="font-serif text-lg sm:text-xl font-bold text-[#1A1714]">本日の復習はすべて完了！</h3>
                    <p className="text-[10px] font-mono font-bold text-[#8a6300]">ALL CLEAR TODAY</p>
                  </div>
                </div>
                <p className="mt-2 text-xs sm:text-sm font-bold leading-relaxed text-[#1A1714]/80">
                  「{getCompletionMessage(coach)}」
                </p>

                {/* レベル分布ミニバー */}
                <div className="mt-3 border-t border-[#1A1714]/15 pt-2">
                  <p className="text-[10px] font-bold text-[#1A1714]/60 mb-1.5">定着レベル分布（全 {terms.length} 件）</p>
                  <div className="grid grid-cols-5 gap-1 text-center font-mono text-xs">
                    {levelCounts.map((count, lvl) => (
                      <div key={lvl} className="border border-[#1A1714]/30 bg-white/70 p-1">
                        <p className="text-[9px] text-[#1A1714]/60">Lv.{lvl}</p>
                        <p className="font-bold text-xs text-[#1A1714]">{count}<span className="text-[9px] font-normal">件</span></p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <button
                    onClick={() => startQuiz({ forceAll: true, reset: true, mode: 'standard' })}
                    className="border-2 border-[#1A1714] bg-white px-3 py-2 text-xs font-bold hover:bg-[#1A1714] hover:text-[#F7F1E3] transition-colors"
                  >
                    ✍️ 先取り復習 ({sessionLimit > 0 ? `${sessionLimit}問` : '全問'})
                  </button>
                  <button
                    onClick={() => startQuiz({ forceAll: true, reset: true, mode: 'quick' })}
                    className="border-2 border-[#1A1714] bg-[#D9A441]/20 px-3 py-2 text-xs font-bold text-[#8a6300] hover:bg-[#D9A441] hover:text-[#1A1714] transition-colors"
                  >
                    ⚡ 4択で先取り
                  </button>
                  <button
                    onClick={() => setView('add')}
                    className="border-2 border-[#1A1714] bg-[#B83227] px-3 py-2 text-xs font-bold text-[#F7F1E3] hover:bg-[#9c2a20] transition-colors"
                  >
                    + 新しい用語を追加
                  </button>
                </div>
              </div>
            )}

            {/* 知識定着度メーター（スリム常設） */}
            {terms.length > 0 && (
              <RetentionMeter terms={terms} coach={coach} userName={userName} />
            )}

            {/* 分野・講義フィルタータブバー */}
            <div className="border-2 border-[#1A1714] bg-[#F7F1E3] p-2.5 sm:p-3 shadow-[3px_3px_0_0_#1A1714]">
              <div className="flex items-center justify-between pb-1.5">
                <p className="font-mono text-[9px] sm:text-[10px] font-bold tracking-wider text-[#1A1714]/60">
                  🏷️ 分野・講義で集中特訓フィルター
                </p>
                {selectedTag !== 'all' && (
                  <button
                    onClick={() => setSelectedTag('all')}
                    className="font-mono text-[9px] sm:text-[10px] font-bold text-[#B83227] underline"
                  >
                    リセット
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1 overflow-x-auto pb-0.5">
                <button
                  onClick={() => setSelectedTag('all')}
                  className={`border px-2 py-0.5 font-mono text-[11px] sm:text-xs font-bold transition-all ${
                    selectedTag === 'all'
                      ? 'border-[#1A1714] bg-[#1A1714] text-[#F7F1E3] shadow-[1px_1px_0_0_#B83227]'
                      : 'border-[#1A1714]/40 bg-white text-[#1A1714] hover:border-[#1A1714]'
                  }`}
                >
                  すべて ({terms.length})
                </button>
                <button
                  onClick={() => setSelectedTag('due')}
                  className={`border px-2 py-0.5 font-mono text-[11px] sm:text-xs font-bold transition-all ${
                    selectedTag === 'due'
                      ? 'border-[#1A1714] bg-[#B83227] text-[#F7F1E3] shadow-[1px_1px_0_0_#1A1714]'
                      : 'border-[#B83227]/50 bg-white text-[#B83227] hover:border-[#B83227]'
                  }`}
                >
                  ⏰ 今日の復習 ({due.length})
                </button>
                {tagStats.map((stat) => (
                  <button
                    key={stat.name}
                    onClick={() => setSelectedTag(stat.name)}
                    className={`flex items-center gap-1 border px-2 py-0.5 text-[11px] sm:text-xs font-bold transition-all ${
                      selectedTag === stat.name
                        ? 'border-[#1A1714] bg-[#1A1714] text-[#F7F1E3] shadow-[1px_1px_0_0_#D9A441]'
                        : 'border-[#1A1714]/30 bg-white text-[#1A1714] hover:border-[#1A1714]'
                    }`}
                  >
                    <span>{stat.name}</span>
                    <span className="font-mono text-[9px] opacity-70">({stat.total})</span>
                    {stat.due > 0 && (
                      <span className="h-1.5 w-1.5 rounded-full bg-[#B83227]" title={`今日復習 ${stat.due}件`} />
                    )}
                  </button>
                ))}
              </div>
            </div>

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
                    onClick={() => setShowAudit(true)}
                    title="復習する価値のない用語を見つけて整理する"
                    className="border border-[#1A1714]/40 bg-white px-2 py-1 font-mono text-xs font-bold text-[#1A1714]/70 hover:bg-[#1A1714] hover:text-[#F7F1E3]"
                  >
                    🧹 棚卸し
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

              {terms.length > 0 && (
                <div className="border-t border-[#1A1714]/15 px-4 py-2 text-right">
                  <button
                    onClick={() => setShowDeleteAll(true)}
                    className="font-mono text-[10px] text-[#1A1714]/30 hover:text-[#B83227] hover:underline"
                  >
                    全{terms.length}件を削除する…
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 2-A. 特急・4択出題画面 (View === 'quick_quiz') */}
        {view === 'quick_quiz' && current && (
          <QuickQuizSession
            term={current}
            coach={coach}
            userName={userName}
            sessionIndex={sessionIndex}
            sessionLimit={sessionLimit}
            today={today}
            onAnswerSaved={handleQuickAnswerSaved}
            onNext={() => {
              if (sessionLimit > 0 && sessionIndex >= sessionLimit) {
                setView('session_summary');
              } else {
                startQuiz({ reset: false });
              }
            }}
            onExit={() => setView('home')}
            onDeleteTerm={handleDeleteCurrentTerm}
          />
        )}

        {/* 2-B. 記述・出題・回答画面 (View === 'quiz') */}
        {view === 'quiz' && current && (
          <div className="space-y-4">
            {/* 苦手ボス出現バナー */}
            {(() => {
              const boss = isBossTerm(current);
              return boss.isBoss ? <BossAlertBanner reason={boss.reason} /> : null;
            })()}

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
              <button
                onClick={() => setView('home')}
                title="この用語には答えず、記録を汚さずにホームへ戻る"
                className="font-mono text-xs tracking-widest text-[#1A1714]/60 hover:text-[#1A1714] hover:underline"
              >
                ← 中断する
              </button>
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

            <label className="mt-5 block text-sm font-bold text-[#1A1714]">
              自分の言葉で説明してみて
            </label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={5}
              placeholder="人に教えるつもりで書くと定着する（音声入力もおすすめ）"
              className="mt-2 w-full resize-none border-2 border-[#1A1714] bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#B83227]"
            />
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
            {/* 苦手ボス撃破演出バナー */}
            {(() => {
              const boss = isBossTerm(current);
              if (!boss.isBoss) return null;
              const isDefeated = result.score >= 80;
              return <BossAlertBanner reason={boss.reason} isDefeated={isDefeated} />;
            })()}

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
                result.score < SCORE_KEEP && !isWakaranResult ? 'shake-effect' : ''
              }`}
            >
              {/* 低得点（レベルリセットライン未満）時のしとしと雨粒/涙エフェクト。
                  「わからん」の正直申告はここでは罰さない（設計思想：わからんも責めずに拾う）。 */}
              {result.score < SCORE_KEEP && !isWakaranResult && (
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
                  <Stamp score={result.score} isWakaran={isWakaranResult} />
                </div>
                <p className="mt-4 font-serif text-xl font-bold leading-relaxed text-[#1A1714]">
                  {result.tsukkomi ? `「${result.tsukkomi}」` : '（考え中…）'}
                </p>
              </div>
            </div>

            {/* 正しい説明 & 足りなかったキーワード */}
            <div className="border-2 border-[#1A1714] bg-[#F7F1E3] p-5 shadow-[4px_4px_0_0_#1A1714]">
              <h3 className="font-serif text-lg font-bold text-[#1A1714]">ほんまのところ</h3>

              {result.correct ? (
                <InteractiveExplanation
                  text={result.correct}
                  missedWords={result.missed || []}
                  relatedWords={result.related}
                  onWordClick={(word) => askChat(`「${word}」ってどういう意味？`)}
                  onAddTerm={handleAddQuickTerm}
                />
              ) : (
                <p className="mt-2 text-sm text-[#1A1714]/50">解説を書いてるで…</p>
              )}
            </div>

            {/* ミニ課題ミッション */}
            <div className="border-2 border-[#1A1714] bg-[#1A1714] p-5 text-[#F7F1E3] shadow-[4px_4px_0_0_#1A1714]">
              <h3 className="font-serif font-bold text-[#D9A441]">
                今すぐ手を動かすミッション
              </h3>
              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed">
                {result.mission || 'ミッションを考え中…'}
              </p>
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
                  disabled={chatLoading || !result.mission}
                  className="border border-[#1A1714] bg-white px-2.5 py-1 text-xs font-bold hover:bg-[#1A1714] hover:text-[#F7F1E3] disabled:opacity-50"
                >
                  もっと簡単に
                </button>
                <button
                  onClick={() => askChat('似ている他の用語と何が違うのか教えて')}
                  disabled={chatLoading || !result.mission}
                  className="border border-[#1A1714] bg-white px-2.5 py-1 text-xs font-bold hover:bg-[#1A1714] hover:text-[#F7F1E3]"
                >
                  他と何が違う？
                </button>
                <button
                  onClick={() => askChat('実際のコードのどこにどう書くのか具体例を見せて')}
                  disabled={chatLoading || !result.mission}
                  className="border border-[#1A1714] bg-white px-2.5 py-1 text-xs font-bold hover:bg-[#1A1714] hover:text-[#F7F1E3]"
                >
                  コードのどこに書く？
                </button>
                <button
                  onClick={() => askChat('実務や現場では具体的にどう使われる？使わないとどう困る？')}
                  disabled={chatLoading || !result.mission}
                  className="border border-[#1A1714] bg-white px-2.5 py-1 text-xs font-bold hover:bg-[#1A1714] hover:text-[#F7F1E3]"
                >
                  実務での使い道
                </button>
                <button
                  onClick={() => askChat('別の身近な日常シーン（料理・買い物など）に例えて説明して')}
                  disabled={chatLoading || !result.mission}
                  className="border border-[#1A1714] bg-white px-2.5 py-1 text-xs font-bold hover:bg-[#1A1714] hover:text-[#F7F1E3]"
                >
                  別の例えで
                </button>
                <button
                  onClick={() => askChat('流れや仕組みを分かりやすくテキスト図解して！')}
                  disabled={chatLoading || !result.mission}
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
                  disabled={chatLoading || !chatInput.trim() || !result.mission}
                  className="shrink-0 border-2 border-[#1A1714] bg-[#B83227] px-4 py-2 text-sm font-bold text-[#F7F1E3] hover:bg-[#9c2a20] disabled:bg-[#1A1714]/20 disabled:text-[#1A1714]/50"
                >
                  聞く
                </button>
              </div>
            </div>

            {/* ナビゲーションボタン。
                loading中（＝解説ストリームがまだ受信・保存の途中）に次へ進めてしまうと、
                バックグラウンドで走り続けているストリーム処理が、後から出た次の問題の
                result/session state を上書きしてしまう。揃うまでは押させない。 */}
            <div className="flex gap-2 pt-2">
              {sessionLimit > 0 && sessionIndex >= sessionLimit ? (
                <button
                  onClick={() => setView('session_summary')}
                  disabled={loading}
                  className="flex-1 border-2 border-[#1A1714] bg-[#B83227] px-4 py-3 font-bold text-[#F7F1E3] hover:bg-[#9c2a20] shadow-[3px_3px_0_0_#1A1714] disabled:opacity-40"
                >
                  🎉 {sessionLimit}問セッション完了！結果を見る
                </button>
              ) : (
                <button
                  onClick={() => startQuiz({ reset: false })}
                  disabled={loading}
                  className="flex-1 border-2 border-[#1A1714] bg-[#B83227] px-4 py-3 font-bold text-[#F7F1E3] hover:bg-[#9c2a20] disabled:opacity-40"
                >
                  {loading ? '解説を仕上げ中…' : `次のお題へ（${sessionIndex + 1}/${sessionLimit > 0 ? sessionLimit : '∞'}問）`}
                </button>
              )}
              <button
                onClick={() => setView('home')}
                disabled={loading}
                className="border-2 border-[#1A1714] bg-[#F7F1E3] px-4 py-3 font-bold hover:bg-[#1A1714]/5 disabled:opacity-40"
              >
                ホームへ戻る
              </button>
            </div>
          </div>
        )}

        {/* 4. セッション完了サマリー画面 (View === 'session_summary') */}
        {view === 'session_summary' && (
          <div className="border-2 border-[#1A1714] bg-[#F7F1E3] p-6 shadow-[6px_6px_0_0_#1A1714] space-y-5">
            {/* 称号昇格（ランクアップ）特大ファンファーレバナー */}
            {promotedRank && (
              <div className="border-2 border-[#1A1714] bg-[#1A1714] p-5 text-center text-[#F7F1E3] shadow-[5px_5px_0_0_#D9A441] animate-bounce">
                <p className="font-mono text-xs font-bold tracking-widest text-[#FFD700]">
                  🎉 RANK UP! 称号昇格！
                </p>
                <div className="mt-2 flex items-center justify-center gap-2">
                  <span className="text-3xl">{promotedRank.icon}</span>
                  <h3 className="font-serif text-xl sm:text-2xl font-bold text-[#FFD700]">
                    【{promotedRank.title} {userName}】
                  </h3>
                </div>
                <div className="mt-3 border-t border-white/20 pt-2">
                  <p className="text-xs sm:text-sm font-bold text-white/90">
                    💬 「{promotedRank.coachMessage}」
                  </p>
                </div>
              </div>
            )}

            <div className="text-center">
              <span className="text-5xl">🏆</span>
              <h2 className="mt-2 font-serif text-2xl font-bold text-[#1A1714]">
                {answeredCount}問セッション達成！
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

            {/* 今回の記憶定着＆レベル変動リスト */}
            {sessionLevelChanges.length > 0 && (
              <div className="border-2 border-[#1A1714] bg-white p-4">
                <div className="flex items-center justify-between border-b border-[#1A1714]/15 pb-2 mb-3">
                  <p className="font-mono text-xs font-bold text-[#1A1714]/70">
                    📈 今回の記憶定着＆レベル変動
                  </p>
                  <span className="font-mono text-[10px] text-[#1A1714]/50">全{sessionLevelChanges.length}問</span>
                </div>
                <div className="space-y-2">
                  {sessionLevelChanges.map((item, idx) => {
                    const isUp = item.toLevel > item.fromLevel;
                    const isReset = item.score < 50;
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between border-b border-[#1A1714]/10 pb-2 text-xs last:border-b-0 last:pb-0"
                      >
                        <div className="flex items-center gap-1.5 min-w-0 pr-2">
                          <span className="font-bold text-[#1A1714] truncate">{item.term}</span>
                          {item.isBoss && (
                            <span className="shrink-0 border border-[#B83227] bg-[#B83227]/10 px-1 py-0.2 font-mono text-[9px] font-bold text-[#B83227]">
                              {item.score >= 80 ? '⚔️ 撃破' : '👹 ボス'}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 font-mono shrink-0 font-bold">
                          <span className="text-[#1A1714]/60">Lv.{item.fromLevel}</span>
                          <span className="text-[#1A1714]/40">➔</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[11px] ${
                              isUp
                                ? 'bg-[#2e7d32]/10 text-[#2e7d32]'
                                : isReset
                                ? 'bg-[#B83227]/10 text-[#B83227]'
                                : 'bg-[#1A1714]/5 text-[#1A1714]'
                            }`}
                          >
                            Lv.{item.toLevel} {isUp ? '🆙' : isReset ? '⚠️' : ''}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* コーチの激励 */}
            <div className="border-l-4 border-[#D9A441] bg-[#D9A441]/15 px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="text-xl">{COACH_LIST.find((c) => c.id === coach)?.icon}</span>
                <p className="font-serif text-sm font-bold text-[#1A1714]">
                  {COACH_LIST.find((c) => c.id === coach)?.name}
                </p>
              </div>
              <p className="mt-1 text-sm font-bold text-[#1A1714]/90">
                「ええペースや！こうやって{answeredCount}問ずつ隙間時間に回すのが一番記憶に残るんやで！この調子でいこ！」
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => startQuiz({ forceAll: sessionForceAll, tag: sessionTag, reset: true })}
                className="flex-1 border-2 border-[#1A1714] bg-[#B83227] px-4 py-3 font-bold text-[#F7F1E3] hover:bg-[#9c2a20] transition-colors"
              >
                ⚡ もう1セットやる（{sessionLimit > 0 ? `+${sessionLimit}問` : '全問'}）
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
  /** AIが解説中から選んだ関連専門用語。ハードコードの辞書より確実 */
  relatedWords?: string[];
  onWordClick: (word: string) => void;
  onAddTerm?: (word: string) => void;
}

// Markdown テーブルおよび通常段落をパースしてレンダリングするコンポーネント（スマホ横スクロール・自動段落分け対応）
function FormattedExplanationText({ text }: { text: string }) {
  const parts = React.useMemo(() => {
    if (!text) return [];

    // もし【見出し】が改行なしで詰まっている場合、自動で【の前と後に改行を補正
    const normalizedText = text
      // 文中の「【」の前に空行を入れる（文頭以外）
      .replace(/([^\n])\s*【/g, '$1\n\n【')
      // 見出し直後の改行を整える
      .replace(/【([^】]+)】\s*/g, '【$1】\n');

    const lines = normalizedText.split('\n');
    const elements: Array<{ type: 'text'; content: string; isSectionHeader?: boolean } | { type: 'table'; headers: string[]; rows: string[][] }> = [];
    let currentTextLines: string[] = [];
    let tableLines: string[] = [];
    let inTable = false;

    const flushText = () => {
      if (currentTextLines.length > 0) {
        const joined = currentTextLines.join('\n').trim();
        if (joined) {
          elements.push({ type: 'text', content: joined });
        }
        currentTextLines = [];
      }
    };

    const flushTable = () => {
      if (tableLines.length >= 2) {
        const parsedRows = tableLines
          .map((line) => line.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()))
          .filter((row) => row.length > 0);

        if (parsedRows.length >= 2) {
          const headers = parsedRows[0];
          const isSeparator = (r: string[]) => r.every((cell) => /^[:\-\s]+$/.test(cell));
          const rows = parsedRows.slice(1).filter((r) => !isSeparator(r));
          elements.push({ type: 'table', headers, rows });
        }
      } else if (tableLines.length > 0) {
        currentTextLines.push(...tableLines);
      }
      tableLines = [];
      inTable = false;
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const isTableLine = line.trim().startsWith('|') && line.trim().endsWith('|');

      if (isTableLine) {
        if (!inTable) {
          flushText();
          inTable = true;
        }
        tableLines.push(line);
      } else {
        if (inTable) {
          flushTable();
        }
        currentTextLines.push(line);
      }
    }

    if (inTable) flushTable();
    flushText();

    return elements;
  }, [text]);

  return (
    <div className="space-y-3.5 mt-2">
      {parts.map((part, idx) => {
        if (part.type === 'text') {
          // 段落ごとに分割して適切な余白を設ける
          const paragraphs = part.content.split(/\n{2,}/).filter((p) => p.trim());
          return (
            <div key={idx} className="space-y-3">
              {paragraphs.map((para, pIdx) => {
                const isHeading = para.trim().startsWith('【') && para.trim().includes('】');
                return (
                  <p
                    key={pIdx}
                    className={`whitespace-pre-line text-sm leading-relaxed text-[#1A1714] ${
                      isHeading ? 'font-medium' : ''
                    }`}
                  >
                    {para}
                  </p>
                );
              })}
            </div>
          );
        }
        return (
          <div key={idx} className="my-3 overflow-x-auto border-2 border-[#1A1714] bg-white shadow-[3px_3px_0_0_#1A1714]">
            <table className="min-w-full text-left text-xs sm:text-sm border-collapse">
              <thead>
                <tr className="border-b-2 border-[#1A1714] bg-[#1A1714] text-[#F7F1E3]">
                  {part.headers.map((h, hi) => (
                    <th key={hi} className="px-3 py-2 font-bold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1A1714]/15">
                {part.rows.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 1 ? 'bg-[#F7F1E3]/50' : 'bg-white'}>
                    {row.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2 text-[#1A1714] font-medium leading-normal whitespace-nowrap sm:whitespace-normal">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

function InteractiveExplanation({
  text,
  missedWords = [],
  relatedWords = [],
  onWordClick,
  onAddTerm,
}: InteractiveExplanationProps) {
  // 解説文から「真のIT専門用語・プロトコル名」だけを厳選抽出（日常語や例え話は除外）
  const detectedKeywords = React.useMemo(() => {
    const list: string[] = [];

    const push = (raw: string) => {
      const clean = raw.replace(/[()（）=＝].*$/, '').trim();
      if (
        clean &&
        clean.length >= 2 &&
        clean.length <= 15 &&
        !clean.includes(' ') &&
        !['からあげ', 'お弁当', '寿司', '仕組み', '本質', 'メリット'].some((ng) => clean.includes(ng)) &&
        !list.some((existing) => existing.toLowerCase() === clean.toLowerCase())
      ) {
        list.push(clean);
      }
    };

    // 1. missedWords（言えなかった重要キーワード）
    missedWords.forEach(push);

    // 2. AIが解説中から選んだ関連用語。
    //    以前は下のハードコード辞書40語だけが頼りで、そこに載っていない用語
    //    （＝これから習うもののほとんど）は1つもチップにならなかった。
    relatedWords.forEach(push);

    // 3. 保険：代表的なIT・Web専門用語・プロトコル名のみマッチ（大文字小文字対応）
    const technicalTerms = [
      'TCP/IP', 'TCP', 'UDP', 'QUIC', 'HTTP/2', 'HTTP/3', 'HTTP', 'HTTPS',
      'Content-Type', 'Cookie', 'Header', 'Body', 'Status Code', 'REST', 'API',
      'JSON', 'HTML', 'CSS', 'JavaScript', 'TypeScript', 'SSR', 'CSR', 'SSG', 'ISR', 'SQL',
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
  }, [text, missedWords, relatedWords]);

  return (
    <div>
      {/* 本文（Markdownテーブルもスマホ対応で美しく描画） */}
      <FormattedExplanationText text={text} />

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
