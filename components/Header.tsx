'use client';

import React from 'react';

interface HeaderProps {
  todayStr: string;
  onOpenSettings?: () => void;
}

export default function Header({ todayStr, onOpenSettings }: HeaderProps) {
  return (
    <header className="mb-8 flex items-end justify-between border-b-2 border-[#1A1714]/20 pb-4">
      <div>
        <p className="font-serif text-xs font-bold tracking-wider text-[#1A1714]/70">
          忘れた頃にやってくる復習コーチ
        </p>
        <h1 translate="no" className="font-serif text-4xl font-bold tracking-tight text-[#1A1714] notranslate">
          覚える君
        </h1>
      </div>
      <div className="flex items-center gap-3">
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="border-2 border-[#1A1714] bg-[#F7F1E3] px-3 py-1 text-xs font-bold transition hover:bg-[#1A1714] hover:text-[#F7F1E3]"
          >
            ⚙ 通知設定
          </button>
        )}
        <p className="font-mono text-xs text-[#1A1714]/60">{todayStr}</p>
      </div>
    </header>
  );
}
