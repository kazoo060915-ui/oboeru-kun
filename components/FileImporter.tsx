'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Term } from '@/lib/supabase';

interface ExtractedTerm {
  term: string;
  note: string;
}

interface FileImporterProps {
  onImported: (terms: Term[]) => void;
  onClose: () => void;
}

export default function FileImporter({ onImported, onClose }: FileImporterProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [extractedTerms, setExtractedTerms] = useState<ExtractedTerm[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sourceName, setSourceName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 複数ファイルを一括で処理する関数
  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    setError('');
    setMessage('');
    setExtractedTerms([]);
    setSelectedIds(new Set());
    setIsExtracting(true);

    const allExtracted: ExtractedTerm[] = [];
    const processedSources: string[] = [];
    let errorCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setProgressText(
        `全 ${files.length} ファイル中 ${i + 1} つ目の「${file.name}」を解析中…`
      );

      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await fetch('/api/extract', { method: 'POST', body: formData });
        const data = await res.json();

        if (res.ok && data.terms && data.terms.length > 0) {
          allExtracted.push(...data.terms);
          processedSources.push(file.name);
        } else if (!res.ok) {
          errorCount++;
        }
      } catch {
        errorCount++;
      }
    }

    setIsExtracting(false);
    setProgressText('');

    if (allExtracted.length === 0) {
      setError(
        errorCount > 0
          ? `${files.length} 件のファイルから用語を抽出できませんでした（一部エラー発生）。`
          : '指定されたファイルから復習すべき用語は見つかりませんでした。'
      );
      return;
    }

    setExtractedTerms(allExtracted);

    const sourceSummary =
      files.length === 1
        ? files[0].name
        : `${files[0].name} ほか全 ${files.length} ファイル`;
    setSourceName(sourceSummary);

    setMessage(
      `合計 ${files.length} 件のファイルから ${allExtracted.length} 件の用語を抽出したで！`
    );

    // 初期状態：全選択
    const allIds = new Set<number>(allExtracted.map((_, i) => i));
    setSelectedIds(allIds);
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) handleFiles(files);
    },
    [handleFiles]
  );

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const onDragLeave = () => setIsDragging(false);

  const toggleSelect = (idx: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

  const selectAll = () =>
    setSelectedIds(new Set(extractedTerms.map((_, i) => i)));
  const deselectAll = () => setSelectedIds(new Set());

  const handleRegister = async () => {
    const toRegister = extractedTerms.filter((_, i) => selectedIds.has(i));
    if (toRegister.length === 0) return;

    setIsRegistering(true);
    setError('');

    try {
      // 各用語を /api/terms に登録（並列）
      const results = await Promise.allSettled(
        toRegister.map((t) =>
          fetch('/api/terms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ term: t.term, note: t.note }),
          }).then((r) => r.json())
        )
      );

      const succeeded: Term[] = results
        .filter((r): r is PromiseFulfilledResult<{ term: Term }> => r.status === 'fulfilled')
        .map((r) => r.value.term)
        .filter(Boolean);

      if (succeeded.length > 0) {
        onImported(succeeded);
      }

      const failed = results.filter((r) => r.status === 'rejected').length;
      if (failed > 0) {
        setError(`${failed} 件の登録に失敗しました。`);
      }
    } catch {
      setError('登録中にエラーが発生しました。');
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[#1A1714]/75 p-4 pt-10 backdrop-blur-sm">
      <div className="w-full max-w-2xl border-2 border-[#1A1714] bg-[#F7F1E3] shadow-[8px_8px_0_0_#1A1714]">
        {/* ヘッダー */}
        <div className="flex items-center justify-between border-b-2 border-[#1A1714] bg-[#1A1714] px-5 py-4">
          <div>
            <p className="font-mono text-xs tracking-widest text-[#D9A441]">FILE IMPORT</p>
            <h2 className="font-serif text-xl font-bold text-[#F7F1E3]">
              ファイルから用語を自動抽出
            </h2>
          </div>
          <button
            onClick={onClose}
            className="border border-[#F7F1E3]/40 px-3 py-1 font-mono text-xs text-[#F7F1E3] hover:bg-[#F7F1E3]/10"
          >
            ✕ 閉じる
          </button>
        </div>

        <div className="p-6">
          {/* ドラッグ＆ドロップエリア */}
          {extractedTerms.length === 0 && !isExtracting && (
            <div>
              <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed py-12 transition-colors ${
                  isDragging
                    ? 'border-[#B83227] bg-[#B83227]/5'
                    : 'border-[#1A1714]/40 bg-white hover:border-[#B83227] hover:bg-[#B83227]/5'
                }`}
              >
                <span className="text-4xl">{isDragging ? '📂' : '📄'}</span>
                <div className="text-center">
                  <p className="font-serif text-lg font-bold text-[#1A1714]">
                    {isDragging
                      ? 'ここでドロップ！'
                      : 'ファイルをドロップ、またはクリックして選択'}
                  </p>
                  <p className="mt-1 text-xs font-bold text-[#B83227]">
                    ※ 複数ファイルをまとめて同時にドロップできます！
                  </p>
                  <p className="mt-1 text-xs text-[#1A1714]/60">
                    .txt / .md / .vtt / .html / .pdf / .png / .jpg 対応　最大20MB
                  </p>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".txt,.md,.vtt,.srt,.csv,.json,.html,.htm,.pdf,.png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={(e) => {
                  const files = e.target.files ? Array.from(e.target.files) : [];
                  if (files.length > 0) handleFiles(files);
                }}
              />

              <div className="mt-4 border border-[#1A1714]/15 bg-white p-3">
                <p className="text-xs font-bold text-[#1A1714]/70">
                  💡 こんなファイルをまとめて放り込んでみよう
                </p>
                <ul className="mt-1 space-y-0.5 text-xs text-[#1A1714]/60">
                  <li>🌐 本気ドリルのWebページ（.html / .htm）</li>
                  <li>📄 全講義の文字起こし（第1回〜第9回など .vtt / .md）</li>
                  <li>📕 講義スライドのPDF（.pdf）</li>
                  <li>🖼️ スライドや板書のスクリーンショット（.png / .jpg）</li>
                </ul>
                <p className="mt-2 text-[10px] text-[#1A1714]/40">
                  ※ 複数ファイルの場合は1ファイルずつ順次AIが読み取り、全用語を集約します。
                </p>
              </div>
            </div>
          )}

          {/* 抽出中スピナー */}
          {isExtracting && (
            <div className="flex flex-col items-center justify-center gap-4 py-16">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-[#1A1714]/20 border-t-[#B83227]" />
              <div className="text-center">
                <p className="font-serif text-lg font-bold text-[#1A1714]">
                  覚える君が読んどるで…
                </p>
                <p className="mt-1 font-mono text-xs font-bold text-[#B83227]">
                  {progressText}
                </p>
              </div>
            </div>
          )}

          {/* 抽出結果 */}
          {extractedTerms.length > 0 && (
            <div>
              {/* ソース名とメッセージ */}
              <div className="mb-4 border-2 border-[#1A1714] bg-[#D9A441]/20 px-4 py-3">
                <p className="font-mono text-xs text-[#1A1714]/70">{sourceName}</p>
                <p className="font-serif font-bold text-[#1A1714]">{message}</p>
                <p className="mt-0.5 text-xs text-[#1A1714]/60">
                  登録したい用語にチェックを入れて「一括登録」してな。
                </p>
              </div>

              {/* 全選択・全解除 */}
              <div className="mb-2 flex gap-2">
                <button
                  onClick={selectAll}
                  className="border border-[#1A1714] bg-white px-3 py-1 text-xs font-bold hover:bg-[#1A1714] hover:text-[#F7F1E3]"
                >
                  全選択 ({extractedTerms.length})
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

              {/* 用語リスト */}
              <div className="max-h-72 overflow-y-auto border-2 border-[#1A1714] bg-white">
                {extractedTerms.map((item, idx) => (
                  <label
                    key={idx}
                    className={`flex cursor-pointer items-start gap-3 border-b border-[#1A1714]/10 px-4 py-3 last:border-0 hover:bg-[#D9A441]/10 ${
                      selectedIds.has(idx) ? 'bg-[#D9A441]/5' : ''
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(idx)}
                      onChange={() => toggleSelect(idx)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-[#B83227]"
                    />
                    <div className="min-w-0">
                      <p className="font-bold text-[#1A1714]">{item.term}</p>
                      <p className="text-xs text-[#1A1714]/60">{item.note}</p>
                    </div>
                  </label>
                ))}
              </div>

              {error && (
                <div className="mt-3 border-2 border-[#B83227] bg-white px-4 py-2 text-sm font-bold text-[#B83227]">
                  {error}
                </div>
              )}

              {/* 登録ボタン */}
              <div className="mt-4 flex gap-2">
                <button
                  onClick={handleRegister}
                  disabled={selectedIds.size === 0 || isRegistering}
                  className="flex-1 border-2 border-[#1A1714] bg-[#B83227] px-4 py-3 font-bold text-[#F7F1E3] hover:bg-[#9c2a20] disabled:bg-[#1A1714]/20 disabled:text-[#1A1714]/50"
                >
                  {isRegistering
                    ? '登録中…'
                    : `選択した ${selectedIds.size} 件を一括登録する`}
                </button>
                <button
                  onClick={() => {
                    setExtractedTerms([]);
                    setSelectedIds(new Set());
                    setMessage('');
                    setError('');
                  }}
                  className="border-2 border-[#1A1714] px-4 py-3 font-bold hover:bg-[#1A1714]/5"
                >
                  別のファイル
                </button>
              </div>
            </div>
          )}

          {/* エラー（抽出段階） */}
          {error && extractedTerms.length === 0 && !isExtracting && (
            <div className="mt-4 border-2 border-[#B83227] bg-white px-4 py-3 text-sm font-bold text-[#B83227]">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
