'use client';

import React, { useState, useEffect } from 'react';

interface RenameTagModalProps {
  isOpen: boolean;
  oldTag: string;
  termCount: number;
  onClose: () => void;
  onRenamed: (oldTag: string, newTag: string) => void;
}

export default function RenameTagModal({
  isOpen,
  oldTag,
  termCount,
  onClose,
  onRenamed,
}: RenameTagModalProps) {
  const [newTag, setNewTag] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setNewTag(oldTag);
      setError('');
    }
  }, [isOpen, oldTag]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTag.trim();
    if (!trimmed) {
      setError('新しい分野名を入力してください。');
      return;
    }
    if (trimmed === oldTag) {
      onClose();
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/terms/rename-tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ oldTag, newTag: trimmed }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || '分野名の変更に失敗しました。');
      }

      onRenamed(oldTag, trimmed);
      onClose();
    } catch (err: any) {
      setError(err?.message || '分野名の変更に失敗しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md border-4 border-[#1A1714] bg-[#F7F1E3] p-6 shadow-[8px_8px_0_0_#1A1714] animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between border-b-2 border-[#1A1714] pb-3">
          <h3 className="font-serif text-lg font-bold text-[#1A1714]">
            🏷️ 分野（タグ）名を変更
          </h3>
          <button
            onClick={onClose}
            className="text-lg font-bold text-[#1A1714]/60 hover:text-[#1A1714]"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#1A1714]/70 mb-1">
              現在の分野名:
            </label>
            <div className="rounded border-2 border-[#1A1714]/30 bg-white/70 px-3 py-2 text-sm font-bold text-[#1A1714]">
              {oldTag}
              <span className="ml-2 font-mono text-xs font-normal text-[#1A1714]/60">
                （該当: {termCount}件）
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#1A1714] mb-1">
              新しい分野名（教材の正式タイトルなど）:
            </label>
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              placeholder="例: Webアプリの攻撃と防御"
              autoFocus
              className="w-full border-2 border-[#1A1714] bg-white p-2.5 text-sm font-bold text-[#1A1714] focus:outline-none focus:ring-2 focus:ring-[#B83227]"
            />
            <p className="mt-1 text-[11px] text-[#1A1714]/60">
              ※ このタグが付いているすべての用語（{termCount}件）が一括で新しい分野名に更新されます。
            </p>
          </div>

          {error && (
            <div className="border border-[#B83227] bg-[#B83227]/10 p-2.5 text-xs font-bold text-[#B83227]">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading || !newTag.trim() || newTag.trim() === oldTag}
              className="flex-1 border-2 border-[#1A1714] bg-[#B83227] px-4 py-2.5 font-bold text-[#F7F1E3] hover:bg-[#9c2a20] shadow-[2px_2px_0_0_#1A1714] disabled:bg-[#1A1714]/20 disabled:text-[#1A1714]/50 disabled:shadow-none"
            >
              {loading ? '更新中…' : '一括変更する'}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="border-2 border-[#1A1714] bg-white px-4 py-2.5 font-bold hover:bg-[#1A1714]/5"
            >
              キャンセル
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
