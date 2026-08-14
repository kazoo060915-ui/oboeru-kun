'use client';

import React, { useState, useEffect } from 'react';

interface MicButtonProps {
  onText: (text: string) => void;
  onError?: (msg: string) => void;
  label?: string;
}

export default function MicButton({
  onText,
  onError,
  label = '話す',
}: MicButtonProps) {
  const [rec, setRec] = useState<any>(null);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const windowObj = window as any;
    const SR = windowObj.SpeechRecognition || windowObj.webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const r = new SR();
    r.lang = 'ja-JP';
    r.continuous = true;
    r.interimResults = false;
    setRec(r);

    return () => {
      try {
        r.stop();
      } catch {}
    };
  }, []);

  const toggle = () => {
    if (!rec) return;
    if (listening) {
      rec.stop();
      setListening(false);
      return;
    }
    rec.onresult = (e: any) => {
      let text = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) text += e.results[i][0].transcript;
      }
      if (text) onText(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = (e: any) => {
      setListening(false);
      onError?.(
        e.error === 'not-allowed'
          ? 'マイクが使えへん。ブラウザの設定でマイクを許可して。'
          : '音声がうまく拾えんかった。もう一回試してみて。'
      );
    };
    try {
      rec.start();
      setListening(true);
    } catch {
      onError?.('マイクを起動できひんかった。');
    }
  };

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={listening}
      className={`flex shrink-0 items-center gap-2 border-2 border-[#1A1714] px-3 py-2 text-sm font-bold ${
        listening
          ? 'bg-[#B83227] text-[#F7F1E3]'
          : 'bg-transparent text-[#1A1714] hover:bg-[#1A1714]/5'
      }`}
    >
      <span
        className={`block h-2.5 w-2.5 rounded-full ${
          listening
            ? 'animate-pulse bg-[#F7F1E3] motion-reduce:animate-none'
            : 'bg-[#B83227]'
        }`}
      />
      {listening ? 'とめる' : label}
    </button>
  );
}
