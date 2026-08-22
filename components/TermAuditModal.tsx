'use client';

import { useState } from 'react';
import { Term } from '@/lib/types';

interface TermAuditModalProps {
  onClose: () => void;
  /** 削除が確定したら呼ばれる。削除された用語IDの配列を渡す。 */
  onDeleted: (deletedIds: string[]) => void;
}

interface Candidate {
  id: string;
  term: string;
  note: string;
  reason: string;
}

export default function TermAuditModal({ onClose, onDeleted }: TermAuditModalProps) {
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'review' | 'deleting' | 'done'>('idle');
  const [progressText, setProgressText] = useState('');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [keepCount, setKeepCount] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState('');
  const [doneMessage, setDoneMessage] = useState('');

  const runScan = async () => {
    setPhase('scanning');
    setError('');
    setCandidates([]);
    setKeepCount(0);

    const found: Candidate[] = [];
    let kept = 0;
    let offset = 0;

    try {
      // 件数が多いとAIの出力が長くなりすぎるため、サーバー側が決めた
      // バッチサイズで区切って複数回に分けて判定する。
      for (;;) {
        setProgressText(`${offset + 1}件目から判定中…`);
        const res = await fetch('/api/terms/audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ offset }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || '棚卸しに失敗しました。');
          setPhase('idle');
          return;
        }

        const termById = new Map<string, Term>((data.terms || []).map((t: Term) => [t.id, t]));
        for (const a of data.audits || []) {
          if (a.keep) {
            kept += 1;
          } else {
            const t = termById.get(a.id);
            if (t) found.push({ id: t.id, term: t.term, note: t.note || '', reason: a.reason || '' });
          }
        }

        if (data.nextOffset === null || data.nextOffset === undefined) break;
        offset = data.nextOffset;
      }

      setCandidates(found);
      setKeepCount(kept);
      // 既定で全件チェック済みにはしない。消すものは必ず自分で選ぶ。
      setSelectedIds(new Set());
      setPhase('review');
    } catch {
      setError('通信エラーが発生しました。');
      setPhase('idle');
    }
  };

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelectedIds(new Set(candidates.map((c) => c.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const runDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;

    setPhase('deleting');
    setError('');
    try {
      const res = await fetch('/api/terms', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '削除に失敗しました。');
        setPhase('review');
        return;
      }

      const deletedIds: string[] = data.deletedIds || [];
      onDeleted(deletedIds);
      setCandidates((prev) => prev.filter((c) => !deletedIds.includes(c.id)));
      setSelectedIds(new Set());
      setDoneMessage(`${data.deletedCount} 件を削除したで。`);
      setPhase('done');
    } catch {
      setError('通信エラーが発生しました。');
      setPhase('review');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#1A1714]/75 p-4 pt-10 backdrop-blur-sm">
      <div className="w-full max-w-2xl border-2 border-[#1A1714] bg-[#F7F1E3] shadow-[8px_8px_0_0_#1A1714]">
        <div className="flex items-center justify-between border-b-2 border-[#1A1714] bg-[#1A1714] px-5 py-4">
          <div>
            <p className="font-mono text-xs tracking-widest text-[#D9A441]">CLEAN UP</p>
            <h2 className="font-serif text-xl font-bold text-[#F7F1E3]">単語帳の棚卸し</h2>
          </div>
          <button
            onClick={onClose}
            className="border border-[#F7F1E3]/40 px-3 py-1 font-mono text-xs text-[#F7F1E3] hover:bg-[#F7F1E3]/10"
          >
            ✕ 閉じる
          </button>
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 border-2 border-[#B83227] bg-white px-4 py-2 text-sm font-bold text-[#B83227]">
              {error}
            </div>
          )}

          {phase === 'idle' && (
            <div>
              <p className="text-sm leading-relaxed text-[#1A1714]/80">
                登録済みの用語を1件ずつ見直して、「復習する価値があるか」を判定するで。
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[#1A1714]/80">
                講義中の言い回し（「面倒の正体」など）、行動のコツ（「型にはめる」など）、
                一般的な日本語（「図解」など）みたいな、覚えても実務で使わへんものを見つけ出す。
              </p>
              <div className="mt-4 border-l-4 border-[#D9A441] bg-[#D9A441]/10 px-3 py-2 text-xs leading-relaxed text-[#8a6300]">
                判定するだけで、この時点では何も消えへん。
                消すかどうかは次の画面で1件ずつ自分で選べるで。
              </div>
              <button
                onClick={runScan}
                className="mt-5 w-full border-2 border-[#1A1714] bg-[#1A1714] px-4 py-3 font-bold text-[#F7F1E3] hover:bg-[#332f2b]"
              >
                🔍 棚卸しをはじめる
              </button>
            </div>
          )}

          {phase === 'scanning' && (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#1A1714]/20 border-t-[#B83227]" />
              <div className="text-center">
                <p className="font-serif text-lg font-bold text-[#1A1714]">覚える君が見直しとるで…</p>
                <p className="mt-1 font-mono text-xs font-bold text-[#B83227]">{progressText}</p>
              </div>
            </div>
          )}

          {(phase === 'review' || phase === 'deleting') && (
            <div>
              <div className="mb-4 border-2 border-[#1A1714] bg-[#D9A441]/20 px-4 py-3">
                <p className="font-serif font-bold text-[#1A1714]">
                  {candidates.length === 0
                    ? '削除候補は見つからへんかった。ええ単語帳や！'
                    : `${candidates.length} 件が「復習せんでもええかも」と判定されたで`}
                </p>
                <p className="mt-0.5 text-xs text-[#1A1714]/60">
                  残す判定は {keepCount} 件。消したいものにチェックを入れてな。
                </p>
              </div>

              {candidates.length > 0 && (
                <>
                  <div className="mb-2 flex gap-2">
                    <button
                      onClick={selectAll}
                      className="border border-[#1A1714] bg-white px-3 py-1 text-xs font-bold hover:bg-[#1A1714] hover:text-[#F7F1E3]"
                    >
                      全選択 ({candidates.length})
                    </button>
                    <button
                      onClick={deselectAll}
                      className="border border-[#1A1714] bg-white px-3 py-1 text-xs font-bold hover:bg-[#1A1714] hover:text-[#F7F1E3]"
                    >
                      全解除
                    </button>
                    <span className="ml-auto self-center text-xs text-[#1A1714]/60">
                      {selectedIds.size} 件選択中
                    </span>
                  </div>

                  <div className="max-h-80 overflow-y-auto border-2 border-[#1A1714] bg-white">
                    {candidates.map((c) => (
                      <label
                        key={c.id}
                        className={`flex cursor-pointer items-start gap-3 border-b border-[#1A1714]/10 px-4 py-3 last:border-0 hover:bg-[#B83227]/5 ${
                          selectedIds.has(c.id) ? 'bg-[#B83227]/5' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.id)}
                          onChange={() => toggle(c.id)}
                          className="mt-0.5 h-4 w-4 shrink-0 accent-[#B83227]"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="font-bold text-[#1A1714]">{c.term}</p>
                            {c.reason && (
                              <span className="rounded bg-[#B83227]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#B83227]">
                                {c.reason}
                              </span>
                            )}
                          </div>
                          {c.note && <p className="mt-0.5 truncate text-xs text-[#1A1714]/60">{c.note}</p>}
                        </div>
                      </label>
                    ))}
                  </div>

                  <button
                    onClick={runDelete}
                    disabled={selectedIds.size === 0 || phase === 'deleting'}
                    className="mt-4 w-full border-2 border-[#1A1714] bg-[#B83227] px-4 py-3 font-bold text-[#F7F1E3] hover:bg-[#9c2a20] disabled:bg-[#1A1714]/20 disabled:text-[#1A1714]/50"
                  >
                    {phase === 'deleting'
                      ? '削除中…'
                      : `選択した ${selectedIds.size} 件を削除する`}
                  </button>
                </>
              )}
            </div>
          )}

          {phase === 'done' && (
            <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
              <span className="text-4xl">🧹</span>
              <p className="font-serif text-lg font-bold text-[#1A1714]">{doneMessage}</p>
              <div className="flex gap-2">
                {candidates.length > 0 && (
                  <button
                    onClick={() => setPhase('review')}
                    className="border-2 border-[#1A1714] bg-white px-4 py-2 font-bold hover:bg-[#1A1714]/5"
                  >
                    残りの候補を見る
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="border-2 border-[#1A1714] bg-[#1A1714] px-4 py-2 font-bold text-[#F7F1E3] hover:bg-[#332f2b]"
                >
                  閉じる
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
