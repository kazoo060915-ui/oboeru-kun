import React from 'react';
import { SCORE_PROMOTE, SCORE_KEEP } from '@/lib/constants';

interface StampProps {
  score: number;
  /** 「わからん」経由の回答か。true の場合は「もう一回」ではなく正直申告を肯定する表示にする */
  isWakaran?: boolean;
}

export default function Stamp({ score, isWakaran = false }: StampProps) {
  const label = isWakaran
    ? '正直'
    : score >= SCORE_PROMOTE
    ? '花丸'
    : score >= SCORE_KEEP
    ? 'よし'
    : 'もう一回';

  return (
    <div className="stamp flex h-20 w-20 flex-col items-center justify-center rounded-full border-[3px] border-[#B83227] text-[#B83227]">
      <span className="font-serif text-base font-bold leading-none">{label}</span>
      <span className="mt-1 font-mono text-[10px]">{score}点</span>
    </div>
  );
}
