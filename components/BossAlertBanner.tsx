'use client';

import React from 'react';

interface BossAlertBannerProps {
  reason: string;
  isDefeated?: boolean; // 正解して撃破したかどうか
}

export default function BossAlertBanner({ reason, isDefeated = false }: BossAlertBannerProps) {
  if (isDefeated) {
    return (
      <div className="mb-4 animate-bounce border-2 border-[#1A1714] bg-[#2e7d32] px-4 py-3 text-[#F7F1E3] shadow-[4px_4px_0_0_#1A1714]">
        <div className="flex items-center gap-2">
          <span className="text-2xl">⚔️</span>
          <div>
            <p className="font-mono text-[10px] font-bold tracking-wider text-[#F7F1E3]/80">
              BOSS DEFEATED!
            </p>
            <p className="text-sm font-bold">
              見事ボス撃破！苦手克服＆ナイスリベンジや！
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 border-2 border-[#1A1714] bg-[#B83227] px-4 py-3 text-[#F7F1E3] shadow-[4px_4px_0_0_#1A1714] animate-pulse">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🚨</span>
          <div>
            <p className="font-mono text-[10px] font-bold tracking-wider text-[#F7F1E3]/80">
              WARNING: BOSS ENCOUNTER
            </p>
            <h4 className="font-serif text-sm sm:text-base font-bold">
              苦手ボス出現！
            </h4>
          </div>
        </div>
        <span className="rounded border border-[#F7F1E3]/40 bg-[#1A1714]/40 px-2 py-0.5 font-mono text-[10px] font-bold">
          リベンジ戦 🔥
        </span>
      </div>
      <p className="mt-1.5 text-xs leading-relaxed text-[#F7F1E3]/95 font-bold">
        {reason}
      </p>
    </div>
  );
}
