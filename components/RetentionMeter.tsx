'use client';

import React from 'react';
import { Term } from '@/lib/types';
import { calculateRetentionStats } from '@/lib/learnerRank';
import { CoachType } from '@/lib/coach';

interface RetentionMeterProps {
  terms: Term[];
  coach?: CoachType;
  userName?: string;
}

export default function RetentionMeter({ terms, coach = 'osaka', userName = 'カズ' }: RetentionMeterProps) {
  const stats = React.useMemo(() => calculateRetentionStats(terms), [terms]);

  if (!terms || terms.length === 0) return null;

  const isOsaka = coach === 'osaka';
  const encourageMsg = stats.masteredCount === stats.totalTerms
    ? (isOsaka ? `${userName}、全単語が殿堂入り（Lv.4）や！完全無敵やで！` : `${userName}さん、全用語が殿堂入り達成です！完璧です！`)
    : stats.retentionRate >= 70
    ? (isOsaka ? `定着率${stats.retentionRate}%！殿堂入りまであと${stats.totalTerms - stats.masteredCount}単語や！ええ仕上がり！` : `定着率${stats.retentionRate}%！殿堂入りまであと${stats.totalTerms - stats.masteredCount}単語です！`)
    : stats.retentionRate >= 40
    ? (isOsaka ? `定着率${stats.retentionRate}%！着実に脳のシナプス繋がってきとるで！` : `定着率${stats.retentionRate}%！着実に知識が定着してきています！`)
    : (isOsaka ? `定着率${stats.retentionRate}%！まずは毎日の3問復習でLv.1を増やしていこ！` : `定着率${stats.retentionRate}%！毎日の復習で少しずつレベルを上げていきましょう！`);

  // バーのパーセンテージ計算
  const masteredPct = stats.totalTerms > 0 ? (stats.masteredCount / stats.totalTerms) * 100 : 0;
  const inProgressPct = stats.totalTerms > 0 ? (stats.inProgressCount / stats.totalTerms) * 100 : 0;
  const learningPct = stats.totalTerms > 0 ? (stats.learningCount / stats.totalTerms) * 100 : 0;

  return (
    <div className="border-2 border-[#1A1714] bg-[#F7F1E3] p-3 sm:p-4 shadow-[3px_3px_0_0_#1A1714]">
      {/* ヘッダー＆定着率 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-lg shrink-0">🧠</span>
          <div className="min-w-0">
            <h4 className="font-serif text-xs sm:text-sm font-bold text-[#1A1714] truncate">
              知識の定着度メーター
            </h4>
          </div>
        </div>
        <div className="flex items-baseline gap-1 shrink-0">
          <span className="font-mono text-xl sm:text-2xl font-bold leading-none text-[#B83227]">
            {stats.retentionRate}
          </span>
          <span className="font-mono text-[10px] font-bold text-[#1A1714]/60">% 定着</span>
        </div>
      </div>

      {/* 3色プログレスバー */}
      <div className="mt-2">
        <div className="relative flex h-2.5 sm:h-3 w-full overflow-hidden rounded-full border border-[#1A1714] bg-stone-200">
          {/* 殿堂入り (Lv.4) - 深緑 */}
          <div
            style={{ width: `${masteredPct}%` }}
            className="h-full bg-[#2e7d32] transition-all duration-500"
            title={`殿堂入り(Lv.4): ${stats.masteredCount}件 (${Math.round(masteredPct)}%)`}
          />
          {/* 定着中 (Lv.2〜3) - 黄土・ゴールド */}
          <div
            style={{ width: `${inProgressPct}%` }}
            className="h-full bg-[#D9A441] transition-all duration-500"
            title={`定着中(Lv.2-3): ${stats.inProgressCount}件 (${Math.round(inProgressPct)}%)`}
          />
          {/* 覚えたて (Lv.0〜1) - 朱赤 */}
          <div
            style={{ width: `${learningPct}%` }}
            className="h-full bg-[#B83227] transition-all duration-500"
            title={`覚えたて(Lv.0-1): ${stats.learningCount}件 (${Math.round(learningPct)}%)`}
          />
        </div>

        {/* 凡例 & 内訳 */}
        <div className="mt-1.5 flex items-center justify-between text-[9px] sm:text-[11px] font-mono font-bold">
          <div className="flex items-center gap-1 text-[#2e7d32]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2e7d32]" />
            <span>殿堂入り(Lv4): {stats.masteredCount}</span>
          </div>
          <div className="flex items-center gap-1 text-[#8a6300]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D9A441]" />
            <span>定着中(Lv2-3): {stats.inProgressCount}</span>
          </div>
          <div className="flex items-center gap-1 text-[#B83227]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#B83227]" />
            <span>覚えたて(Lv0-1): {stats.learningCount}</span>
          </div>
        </div>
      </div>

      {/* コーチの励ましメッセージ */}
      <div className="mt-2 border-t border-[#1A1714]/10 pt-1.5">
        <p className="text-[11px] sm:text-xs text-[#1A1714]/80 leading-tight font-bold truncate">
          💬 {encourageMsg}
        </p>
      </div>
    </div>
  );
}
