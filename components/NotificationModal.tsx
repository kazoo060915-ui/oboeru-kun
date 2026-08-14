'use client';

import React, { useState } from 'react';

interface NotificationModalProps {
  onClose: () => void;
}

export default function NotificationModal({ onClose }: NotificationModalProps) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [cronSecret, setCronSecret] = useState('');

  const triggerTestNotify = async () => {
    setLoading(true);
    setMessage('');
    try {
      const url = cronSecret
        ? `/api/notify?secret=${encodeURIComponent(cronSecret)}`
        : '/api/notify';
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        setMessage(
          `送信完了! 件数: ${data.dueCount}件 / LINE: ${data.results?.line || 'N/A'} / Email: ${data.results?.email || 'N/A'}`
        );
      } else {
        setMessage(`送信失敗: ${data.error || 'Unauthorized'}`);
      }
    } catch {
      setMessage('通信エラーが発生しました。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1A1714]/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg border-2 border-[#1A1714] bg-[#F7F1E3] p-6 shadow-[8px_8px_0_0_#1A1714]">
        <div className="flex items-center justify-between border-b-2 border-[#1A1714] pb-3">
          <h2 className="font-serif text-xl font-bold text-[#1A1714]">
            通知パイプライン設定・テスト
          </h2>
          <button
            onClick={onClose}
            className="font-mono text-sm font-bold hover:underline"
          >
            ✕ 閉じる
          </button>
        </div>

        <div className="mt-4 space-y-4 text-sm text-[#1A1714]">
          <p className="leading-relaxed">
            毎朝その日の復習対象用語件数を <strong>LINE / メール</strong> で送信するパイプラインです。環境変数（`LINE_NOTIFY_TOKEN`, `RESEND_API_KEY`等）を設定することで自動連携されます。
          </p>

          <div className="border border-[#1A1714]/20 bg-white p-3">
            <label className="block text-xs font-bold text-[#1A1714]/80">
              CRON SECRET (認証用・任意)
            </label>
            <input
              type="password"
              value={cronSecret}
              onChange={(e) => setCronSecret(e.target.value)}
              placeholder="CRON_SECRET が設定されている場合入力"
              className="mt-1 w-full border border-[#1A1714]/40 bg-[#F7F1E3] p-2 text-xs focus:outline-none"
            />
          </div>

          {message && (
            <div className="border-2 border-[#1A1714] bg-white p-3 font-mono text-xs text-[#B83227]">
              {message}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              onClick={triggerTestNotify}
              disabled={loading}
              className="flex-1 border-2 border-[#1A1714] bg-[#B83227] px-4 py-3 font-bold text-[#F7F1E3] hover:bg-[#9c2a20] disabled:bg-[#1A1714]/20"
            >
              {loading ? '送信テスト中…' : '今すぐリマインドテスト送信'}
            </button>
            <button
              onClick={onClose}
              className="border-2 border-[#1A1714] px-4 py-3 font-bold hover:bg-[#1A1714]/5"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
