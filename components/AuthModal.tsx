'use client';

import React, { useState } from 'react';

interface AuthModalProps {
  onSuccess: () => void;
}

export default function AuthModal({ onSuccess }: AuthModalProps) {
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passcode.trim() || loading) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: passcode.trim() }),
      });
      const data = await res.json();

      if (data.success) {
        onSuccess();
      } else {
        setError(data.error || 'アクセスコードが違います。');
      }
    } catch {
      setError('通信エラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1714]/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md border-2 border-[#1A1714] bg-[#F7F1E3] p-6 shadow-[8px_8px_0_0_#1A1714]">
        <h2 className="font-serif text-2xl font-bold text-[#1A1714]">
          アクセスコード入力
        </h2>
        <p className="mt-2 text-sm text-[#1A1714]/70">
          覚える君を利用するには、パスコードを入力してください。
        </p>

        {error && (
          <div className="mt-4 border-2 border-[#B83227] bg-[#F7F1E3] px-4 py-2 text-sm text-[#B83227]">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#1A1714]/80">
              パスコード
            </label>
            <input
              type="password"
              value={passcode}
              onChange={(e) => setPasscode(e.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full border-2 border-[#1A1714] bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#B83227]"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading || !passcode.trim()}
            className="w-full border-2 border-[#1A1714] bg-[#B83227] px-4 py-3 font-bold text-[#F7F1E3] transition hover:bg-[#9c2a20] disabled:bg-[#1A1714]/20 disabled:text-[#1A1714]/50"
          >
            {loading ? '確認中…' : 'ログインする'}
          </button>
        </form>
      </div>
    </div>
  );
}
