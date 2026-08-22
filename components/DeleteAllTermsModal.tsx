'use client';

import { useState } from 'react';

interface DeleteAllTermsModalProps {
  termIds: string[];
  onClose: () => void;
  onDeleted: (deletedIds: string[]) => void;
}

/**
 * 全用語の一括削除。取り消せない操作なので、確認は window.confirm ではなく
 * 「件数を入力させる」二重確認にしている。誤タップ・誤クリックでは
 * 絶対に成立しない形にするため。
 */
export default function DeleteAllTermsModal({ termIds, onClose, onDeleted }: DeleteAllTermsModalProps) {
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const expected = String(termIds.length);
  const canDelete = confirmText.trim() === expected && termIds.length > 0;

  const handleDelete = async () => {
    if (!canDelete) return;
    setDeleting(true);
    setError('');
    try {
      const res = await fetch('/api/terms', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: termIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '削除に失敗しました。');
        setDeleting(false);
        return;
      }
      onDeleted(data.deletedIds || termIds);
      onClose();
    } catch {
      setError('通信エラーが発生しました。');
      setDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1714]/75 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md border-2 border-[#B83227] bg-[#F7F1E3] shadow-[8px_8px_0_0_#1A1714]">
        <div className="border-b-2 border-[#B83227] bg-[#B83227] px-5 py-4">
          <p className="font-mono text-xs tracking-widest text-white/70">DANGER ZONE</p>
          <h2 className="font-serif text-xl font-bold text-white">全用語を削除</h2>
        </div>

        <div className="p-6 text-sm text-[#1A1714]">
          <p className="leading-relaxed">
            登録済みの用語 <strong className="text-[#B83227]">{termIds.length}件</strong> と、
            その復習履歴をすべて削除します。<strong>この操作は取り消せません。</strong>
          </p>
          <p className="mt-2 leading-relaxed text-[#1A1714]/70">
            本当に削除する場合は、下の欄に件数「{expected}」を入力してください。
          </p>

          <input
            type="text"
            inputMode="numeric"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={expected}
            className="mt-3 w-full border-2 border-[#1A1714] bg-white px-3 py-2 text-center font-mono text-lg font-bold focus:outline-none focus:ring-2 focus:ring-[#B83227]"
          />

          {error && (
            <div className="mt-3 border-2 border-[#B83227] bg-white px-3 py-2 text-xs font-bold text-[#B83227]">
              {error}
            </div>
          )}

          <div className="mt-5 flex gap-2">
            <button
              onClick={handleDelete}
              disabled={!canDelete || deleting}
              className="flex-1 border-2 border-[#B83227] bg-[#B83227] px-4 py-3 font-bold text-white hover:bg-[#9c2a20] disabled:border-[#1A1714]/20 disabled:bg-[#1A1714]/10 disabled:text-[#1A1714]/40"
            >
              {deleting ? '削除中…' : `${expected}件を完全に削除する`}
            </button>
            <button
              onClick={onClose}
              disabled={deleting}
              className="border-2 border-[#1A1714] px-4 py-3 font-bold hover:bg-[#1A1714]/5"
            >
              キャンセル
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
