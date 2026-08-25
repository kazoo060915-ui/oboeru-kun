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
    <div className="border-2 border-[#1A1714] bg-[#F7F1E3] p-4 sm:p-5 shadow-[4px_4px_0_0_#1A1714]">
      {/* ヘッダー部分 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🧠</span>
          <div>
            <p className="font-mono text-[9px] font-bold tracking-wider text-[#1A1714]/60">
              RETENTION STATUS
            </p>
            <h4 className="font-serif text-sm sm:text-base font-bold text-[#1A1714]">
              知識の定着度メーター
            </h4>
          </div>
        </div>
        <div className="text-right">
          <p className="font-mono text-2xl sm:text-3xl font-bold leading-none text-[#B83227]">
            {stats.retentionRate}
            <span className="text-xs font-sans font-bold text-[#1A1714] ml-0.5">%</span>
          </p>
          <p className="font-mono text-[9px] text-[#1A1714]/60">定着率</p>
        </div>
      </div>

      {/* 3色プログレスバー */}
      <div className="mt-3">
        <div className="relative flex h-3.5 w-full overflow-hidden rounded-full border-2 border-[#1A1714] bg-stone-200">
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
        <div className="mt-2 flex items-center justify-between text-[10px] sm:text-xs font-mono font-bold">
          <div className="flex items-center gap-1 text-[#2e7d32]">
            <span className="h-2 w-2 rounded-full bg-[#2e7d32]" />
            <span>殿堂入り(Lv4): {stats.masteredCount}</span>
          </div>
          <div className="flex items-center gap-1 text-[#8a6300]">
            <span className="h-2 w-2 rounded-full bg-[#D9A441]" />
            <span>定着中(Lv2-3): {stats.inProgressCount}</span>
          </div>
          <div className="flex items-center gap-1 text-[#B83227]">
            <span className="h-2 w-2 rounded-full bg-[#B83227]" />
            <span>覚えたて(Lv0-1): {stats.learningCount}</span>
          </div>
        </div>
      </div>

      {/* コーチの励ましメッセージ */}
      <div className="mt-3 border-t border-[#1A1714]/15 pt-2.5">
        <p className="text-xs text-[#1A1714]/80 leading-relaxed font-bold">
          💬 {encourageMsg}
        </p>
      </div>
    </div>
  );
}
