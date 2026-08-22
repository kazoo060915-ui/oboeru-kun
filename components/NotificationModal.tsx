'use client';

import React, { useEffect, useState } from 'react';

interface NotificationModalProps {
  onClose: () => void;
}

type NotificationChannel = 'line' | 'email' | 'both' | 'none';

interface SettingsState {
  notificationChannel: NotificationChannel;
  emailAddress: string;
  lineEnvConfigured: boolean;
  emailEnvConfigured: boolean;
  canSave: boolean;
}

const CHANNEL_OPTIONS: { value: NotificationChannel; label: string }[] = [
  { value: 'both', label: 'LINE + メール' },
  { value: 'line', label: 'LINEのみ' },
  { value: 'email', label: 'メールのみ' },
  { value: 'none', label: '通知しない' },
];

export default function NotificationModal({ onClose }: NotificationModalProps) {
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [channel, setChannel] = useState<NotificationChannel>('both');
  const [emailInput, setEmailInput] = useState('');
  const [loadError, setLoadError] = useState('');

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');

  const [testing, setTesting] = useState(false);
  const [testMessage, setTestMessage] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (!res.ok) {
          setLoadError(data.error || '通知設定の読み込みに失敗しました。');
          return;
        }
        setSettings(data);
        setChannel(data.notificationChannel);
        setEmailInput(data.emailAddress || '');
      } catch {
        setLoadError('通知設定の読み込みに失敗しました。通信環境を確認してください。');
      }
    })();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaveMessage('');
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notificationChannel: channel, emailAddress: emailInput.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveMessage(data.error || '保存に失敗しました。');
        return;
      }
      setSaveMessage('保存したで！次回の通知から反映される。');
      setSettings((prev) => (prev ? { ...prev, notificationChannel: channel, emailAddress: emailInput.trim() } : prev));
    } catch {
      setSaveMessage('通信エラーが発生しました。');
    } finally {
      setSaving(false);
    }
  };

  const triggerTestNotify = async () => {
    setTesting(true);
    setTestMessage('');
    try {
      // ログイン済みCookieで認証されるので、シークレットの手入力は不要
      const res = await fetch('/api/notify', { method: 'POST' });
      const data = await res.json();

      if (res.ok) {
        const lineText = data.results?.line?.startsWith('sent') ? '送れた' : `${data.results?.line || 'N/A'}`;
        const emailText = data.results?.email?.startsWith('sent') ? '送れた' : `${data.results?.email || 'N/A'}`;
        setTestMessage(`テスト送信完了（対象 ${data.dueCount}件）／ LINE: ${lineText} ／ メール: ${emailText}`);
      } else {
        setTestMessage(`送信失敗: ${data.error || 'Unauthorized'}`);
      }
    } catch {
      setTestMessage('通信エラーが発生しました。');
    } finally {
      setTesting(false);
    }
  };

  const showEmailInput = channel === 'email' || channel === 'both';

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#1A1714]/70 p-4 pt-10 backdrop-blur-sm">
      <div className="w-full max-w-lg border-2 border-[#1A1714] bg-[#F7F1E3] p-6 shadow-[8px_8px_0_0_#1A1714]">
        <div className="flex items-center justify-between border-b-2 border-[#1A1714] pb-3">
          <h2 className="font-serif text-xl font-bold text-[#1A1714]">
            通知設定
          </h2>
          <button
            onClick={onClose}
            className="font-mono text-sm font-bold hover:underline"
          >
            ✕ 閉じる
          </button>
        </div>

        <div className="mt-4 space-y-4 text-sm text-[#1A1714]">
          <p className="leading-relaxed text-[#1A1714]/80">
            毎朝、その日の復習対象を知らせる通知の届け先を設定するで。
          </p>

          {loadError && (
            <div className="border-2 border-[#B83227] bg-white p-3 text-xs font-bold text-[#B83227]">
              {loadError}
            </div>
          )}

          {settings && (
            <>
              {!settings.canSave && (
                <div className="border-2 border-[#D9A441] bg-[#D9A441]/10 p-3 text-xs leading-relaxed text-[#8a6300]">
                  DBが未設定のため、この画面での保存はできへん。今表示されているのは環境変数由来の設定や。
                </div>
              )}

              <div>
                <p className="mb-1.5 text-xs font-bold text-[#1A1714]/70">通知チャネル</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {CHANNEL_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setChannel(opt.value)}
                      className={`border-2 px-3 py-2 text-xs font-bold transition-colors ${
                        channel === opt.value
                          ? 'border-[#1A1714] bg-[#1A1714] text-[#F7F1E3]'
                          : 'border-[#1A1714]/30 bg-white hover:border-[#1A1714]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {showEmailInput && (
                <div>
                  <label className="mb-1.5 block text-xs font-bold text-[#1A1714]/70">
                    メールの送り先
                  </label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full border-2 border-[#1A1714] bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B83227]"
                  />
                  {!settings.emailEnvConfigured && (
                    <p className="mt-1 text-[10px] text-[#B83227]">
                      ⚠️ サーバー側の RESEND_API_KEY が未設定なので、宛先を登録しても実際には届かへん。
                    </p>
                  )}
                  <p className="mt-1 text-[10px] text-[#1A1714]/50">
                    ※ Resendでドメイン検証をしていない場合、送信元は onboarding@resend.dev になり、
                    宛先は Resend に登録した自分のアドレスに限られる。
                  </p>
                </div>
              )}

              {(channel === 'line' || channel === 'both') && (
                <div className="border-l-4 border-[#1A1714]/20 bg-white px-3 py-2 text-xs leading-relaxed text-[#1A1714]/70">
                  {settings.lineEnvConfigured ? (
                    <p>✅ LINE通知は使える状態や（サーバー側の設定済み）。</p>
                  ) : (
                    <p>
                      LINEはサーバー側の設定（<code>LINE_CHANNEL_ACCESS_TOKEN</code> / <code>LINE_USER_ID</code>）が
                      まだやから、この画面からは選べても実際には届かへん。LINE Developersでチャネルを作って
                      環境変数に設定してな。
                    </p>
                  )}
                </div>
              )}

              {saveMessage && (
                <div className="border-2 border-[#1A1714] bg-white p-3 font-mono text-xs">
                  {saveMessage}
                </div>
              )}

              <button
                onClick={handleSave}
                disabled={saving || !settings.canSave}
                className="w-full border-2 border-[#1A1714] bg-[#1A1714] px-4 py-3 font-bold text-[#F7F1E3] hover:bg-[#332f2b] disabled:bg-[#1A1714]/20 disabled:text-[#1A1714]/50"
              >
                {saving ? '保存中…' : '設定を保存する'}
              </button>
            </>
          )}

          <div className="border-t border-[#1A1714]/15 pt-4">
            {testMessage && (
              <div className="mb-2 border-2 border-[#1A1714] bg-white p-3 font-mono text-xs text-[#B83227]">
                {testMessage}
              </div>
            )}
            <button
              onClick={triggerTestNotify}
              disabled={testing}
              className="w-full border-2 border-[#1A1714] bg-[#B83227] px-4 py-3 font-bold text-[#F7F1E3] hover:bg-[#9c2a20] disabled:bg-[#1A1714]/20"
            >
              {testing ? '送信テスト中…' : '今すぐテスト送信する'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
