import React from 'react';

interface StampProps {
  score: number;
}

export default function Stamp({ score }: StampProps) {
  const label = score >= 80 ? '花丸' : score >= 50 ? 'よし' : 'もう一回';

  return (
    <div className="stamp flex h-20 w-20 flex-col items-center justify-center rounded-full border-[3px] border-[#B83227] text-[#B83227]">
      <span className="font-serif text-base font-bold leading-none">{label}</span>
      <span className="mt-1 font-mono text-[10px]">{score}点</span>
    </div>
  );
}
