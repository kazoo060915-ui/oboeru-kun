// 称号・アバター進化システムおよび記憶定着・苦手ボス判定のロジック

import { Term } from './types';

export interface LearnerRank {
  rank: number;
  title: string; // 肩書き（例: "ひよっこ", "脳みそパンパンの"）
  icon: string;  // アバターアイコン（例: "🐥", "🧠"）
  minReviews: number; // 昇格に必要な累計復習回数
  coachMessage: string; // 昇格時のコーチの一言
}

export const LEARNER_RANKS: LearnerRank[] = [
  {
    rank: 1,
    title: '忘れん坊の',
    icon: '🐣',
    minReviews: 0,
    coachMessage: 'まずは1問、気軽にいこか！一歩踏み出しただけでハナマルや！',
  },
  {
    rank: 2,
    title: 'ひよっこ',
    icon: '🐥',
    minReviews: 5,
    coachMessage: 'お、ちょっと頭に入ってきたな！その調子やで！',
  },
  {
    rank: 3,
    title: '口の達者な',
    icon: '🕶️',
    minReviews: 15,
    coachMessage: 'おっ！専門用語でドヤれるようになってきたやん！ええ調子！',
  },
  {
    rank: 4,
    title: '脳みそパンパンの',
    icon: '🧠',
    minReviews: 30,
    coachMessage: 'ええ仕上がりや！脳のシナプスがバチバチ弾けとるで！',
  },
  {
    rank: 5,
    title: '浪速の記憶モンスター',
    icon: '🔥',
    minReviews: 50,
    coachMessage: 'もう教えることあらへん！記憶モンスターの誕生や！',
  },
  {
    rank: 6,
    title: '記憶の人間国宝',
    icon: '👑',
    minReviews: 100,
    coachMessage: '人間国宝師匠！一生ついていきます！無敵の境地や！',
  },
];

export interface LearnerStats {
  totalReviews: number; // 累計復習回数
  totalCorrect: number; // 累計正解数
  currentRank: number;  // 現在のランク
}

const EMPTY_STATS: LearnerStats = { totalReviews: 0, totalCorrect: 0, currentRank: 1 };

/**
 * サーバー（DB）からユーザーの学習実績を取得。
 *
 * 以前は localStorage にのみ保存していたため、PC とスマホなど端末が
 * 違うと累計復習回数が別々にカウントされ、同じアカウントなのに表示
 * されるランクが端末ごとにズレていた。DBに一本化することでどの端末
 * からでも同じランクが見えるようにする。
 */
export async function fetchLearnerStats(): Promise<LearnerStats> {
  try {
    const res = await fetch('/api/learner-stats');
    if (!res.ok) return EMPTY_STATS;
    const data = await res.json();
    const totalReviews = Number(data.totalReviews) || 0;
    const totalCorrect = Number(data.totalCorrect) || 0;
    return {
      totalReviews,
      totalCorrect,
      currentRank: getRankByReviews(totalReviews).rank,
    };
  } catch {
    return EMPTY_STATS;
  }
}

/** 累計復習回数からランクを取得 */
export function getRankByReviews(reviews: number): LearnerRank {
  for (let i = LEARNER_RANKS.length - 1; i >= 0; i--) {
    if (reviews >= LEARNER_RANKS[i].minReviews) {
      return LEARNER_RANKS[i];
    }
  }
  return LEARNER_RANKS[0];
}

/** 次のランクまでの必要回数を取得 */
export function getNextRankInfo(reviews: number): { nextRank: LearnerRank | null; remaining: number; progressPercent: number } {
  const currentRank = getRankByReviews(reviews);
  const nextRank = LEARNER_RANKS.find((r) => r.rank === currentRank.rank + 1) || null;
  if (!nextRank) {
    return { nextRank: null, remaining: 0, progressPercent: 100 };
  }
  const prevThreshold = currentRank.minReviews;
  const targetThreshold = nextRank.minReviews;
  const currentProgress = reviews - prevThreshold;
  const totalNeeded = targetThreshold - prevThreshold;
  const progressPercent = Math.min(100, Math.max(0, Math.round((currentProgress / totalNeeded) * 100)));
  const remaining = Math.max(0, targetThreshold - reviews);

  return { nextRank, remaining, progressPercent };
}

/**
 * 回答をサーバー（DB）に記録し、ランクアップしたか判定して新しいStatsを返却。
 * ランクアップ判定に必要な「更新前のランク」は呼び出し側が保持している
 * 現在のstateを渡す（サーバーには前回値を問い合わせずに済む）。
 */
export async function recordReviewStats(
  prevStats: LearnerStats,
  answeredCount: number,
  correctCount: number
): Promise<{
  newStats: LearnerStats;
  promotedRank: LearnerRank | null;
}> {
  const prevRank = getRankByReviews(prevStats.totalReviews);

  try {
    const res = await fetch('/api/learner-stats', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answeredCount, correctCount }),
    });
    if (!res.ok) throw new Error('failed to update learner stats');
    const data = await res.json();
    const totalReviews = Number(data.totalReviews) || 0;
    const totalCorrect = Number(data.totalCorrect) || 0;
    const newRank = getRankByReviews(totalReviews);

    const newStats: LearnerStats = { totalReviews, totalCorrect, currentRank: newRank.rank };
    const promotedRank = newRank.rank > prevRank.rank ? newRank : null;
    return { newStats, promotedRank };
  } catch (e) {
    console.error('Failed to save learner stats:', e);
    return { newStats: prevStats, promotedRank: null };
  }
}

/** 知識定着率（0〜100%）および各レベル件数を計算 */
export interface RetentionStats {
  retentionRate: number; // 0〜100%
  levelCounts: [number, number, number, number, number]; // Lv.0〜4の件数
  masteredCount: number; // Lv.4（殿堂入り）の件数
  inProgressCount: number; // Lv.2〜3（定着中）の件数
  learningCount: number; // Lv.0〜1（覚えたて）の件数
  totalTerms: number;
}

export function calculateRetentionStats(terms: Term[]): RetentionStats {
  if (!terms || terms.length === 0) {
    return {
      retentionRate: 0,
      levelCounts: [0, 0, 0, 0, 0],
      masteredCount: 0,
      inProgressCount: 0,
      learningCount: 0,
      totalTerms: 0,
    };
  }

  const counts: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let totalWeight = 0;

  terms.forEach((t) => {
    const lvl = Math.max(0, Math.min(4, t.level || 0));
    counts[lvl] += 1;
    // Lv.0: 0%, Lv.1: 25%, Lv.2: 50%, Lv.3: 75%, Lv.4: 100%
    totalWeight += lvl / 4;
  });

  const retentionRate = Math.round((totalWeight / terms.length) * 100);

  return {
    retentionRate,
    levelCounts: counts,
    masteredCount: counts[4],
    inProgressCount: counts[2] + counts[3],
    learningCount: counts[0] + counts[1],
    totalTerms: terms.length,
  };
}

/** 苦手ボス用語かどうかの判定 */
export function isBossTerm(term: Term | null): { isBoss: boolean; reason: string } {
  if (!term) return { isBoss: false, reason: '' };

  // 1. 直前のスコアが50点未満（前回つまずいた）
  if (term.last_score !== null && term.last_score !== undefined && term.last_score < 50) {
    return {
      isBoss: true,
      reason: '前回つまずいてLv.0に落ちた要注意用語！リベンジしたれ！',
    };
  }

  // 2. レベル0かつ次回復習日が今日以前（初期・未定着の強敵）
  if (term.level === 0 && term.last_score !== null && term.last_score !== undefined) {
    return {
      isBoss: true,
      reason: 'まだ頭に定着していない手強い相手や！今度こそモノにしよ！',
    };
  }

  return { isBoss: false, reason: '' };
}
