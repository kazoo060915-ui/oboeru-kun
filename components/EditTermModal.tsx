'use client';

import React, { useState, useEffect } from 'react';
import { Term } from '@/lib/types';
import { todayStr } from '@/lib/date';

interface EditTermModalProps {
  term: Term | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: (updatedTerm: Term) => void;
  onDeleted: (termId: string) => void;
}

export default function EditTermModal({
  term,
  isOpen,
  onClose,
  onSaved,
  onDeleted,
}: EditTermModalProps) {
  const [termText, setTermText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [tagText, setTagText] = useState('');
  const [level, setLevel] = useState(0);
  const [nextReviewAt, setNextReviewAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (term) {
      setTermText(term.term || '');
      setNoteText(term.note || '');
      setTagText(term.tag || '');
      setLevel(term.level || 0);
      setNextReviewAt(term.next_review_at || todayStr());
      setError('');
    }
  }, [term]);

  if (!isOpen || !term) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termText.trim()) {
      setError('用語名は必須です。');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/terms', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: term.id,
          term: termText.trim(),
          note: noteText.trim(),
          tag: tagText.trim(),
          level,
          next_review_at: nextReviewAt,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '更新に失敗しました');

      onSaved({
        ...term,
        term: termText.trim(),
        note: noteText.trim(),
        tag: tagText.trim(),
        level,
        next_review_at: nextReviewAt,
      });
      onClose();
    } catch (err: any) {
      setError(err?.message || '更新中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm(`用語「${term.term}」を削除してもよろしいですか？\n※復習履歴も削除されます。`)) {
      return;
    }

    setDeleting(true);
    setError('');

    try {
      const res = await fetch(`/api/terms?id=${encodeURIComponent(term.id)}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '削除に失敗しました');

      onDeleted(term.id);
      onClose();
    } catch (err: any) {
      setError(err?.message || '削除中にエラーが発生しました');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1714]/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md border-2 border-[#1A1714] bg-[#F7F1E3] p-6 shadow-[8px_8px_0_0_#1A1714]">
        <div className="flex items-center justify-between border-b-2 border-[#1A1714] pb-3">
          <h3 className="font-serif text-lg font-bold text-[#1A1714]">用語の編集</h3>
          <button
            onClick={onClose}
            className="border border-[#1A1714] bg-white px-2 py-0.5 text-xs font-bold hover:bg-[#1A1714] hover:text-[#F7F1E3]"
          >
            ✕ 閉じる
          </button>
        </div>

        {error && (
          <div className="mt-3 border-2 border-[#B83227] bg-white px-3 py-2 text-xs font-bold text-[#B83227]">
            {error}
          </div>
        )}

        <form onSubmit={handleSave} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-bold text-[#1A1714]">用語名</label>
            <input
              type="text"
              value={termText}
              onChange={(e) => setTermText(e.target.value)}
              className="mt-1 w-full border-2 border-[#1A1714] bg-white p-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#B83227]"
              placeholder="例: useState"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#1A1714]">
              講義回・分野タグ（例: 第1回講義, React, Git 等）
            </label>
            <input
              type="text"
              value={tagText}
              onChange={(e) => setTagText(e.target.value)}
              className="mt-1 w-full border-2 border-[#1A1714] bg-white p-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#B83227]"
              placeholder="例: 第1回講義 / React / Git"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#1A1714]">
              ヒント・メモ（どこで出てきたか）
            </label>
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              rows={2}
              className="mt-1 w-full resize-none border-2 border-[#1A1714] bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B83227]"
              placeholder="例: Reactの講義第3回、タスク管理アプリで登場"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-[#1A1714]">習得レベル (0〜4)</label>
              <select
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
                className="mt-1 w-full border-2 border-[#1A1714] bg-white p-2 text-sm font-bold focus:outline-none"
              >
                <option value={0}>Lv.0（毎日復習）</option>
                <option value={1}>Lv.1（3日後）</option>
                <option value={2}>Lv.2（7日後）</option>
                <option value={3}>Lv.3（14日後）</option>
                <option value={4}>Lv.4（30日後・卒業間近）</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#1A1714]">次回復習日</label>
              <input
                type="date"
                value={nextReviewAt}
                onChange={(e) => setNextReviewAt(e.target.value)}
                className="mt-1 w-full border-2 border-[#1A1714] bg-white p-2 text-xs font-bold focus:outline-none"
              >
              </input>
            </div>
          </div>

          <div className="flex items-center justify-between border-t-2 border-[#1A1714] pt-4">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || loading}
              className="border border-[#B83227] bg-[#B83227]/10 px-3 py-2 text-xs font-bold text-[#B83227] hover:bg-[#B83227] hover:text-[#F7F1E3] disabled:opacity-50"
            >
              {deleting ? '削除中…' : '🗑 この用語を削除'}
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="border-2 border-[#1A1714] bg-white px-3 py-2 text-xs font-bold hover:bg-[#1A1714]/10"
              >
                キャンセル
              </button>
              <button
                type="submit"
                disabled={loading || deleting}
                className="border-2 border-[#1A1714] bg-[#B83227] px-4 py-2 text-xs font-bold text-[#F7F1E3] hover:bg-[#9c2a20] disabled:bg-[#1A1714]/20"
              >
                {loading ? '保存中…' : '変更を保存'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
