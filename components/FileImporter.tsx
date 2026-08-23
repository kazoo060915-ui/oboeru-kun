'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Term, LECTURE_TITLES } from '@/lib/types';

interface ExtractedTerm {
  term: string;
  note: string;
  tag?: string;
  isExisting?: boolean;
}

interface FileImporterProps {
  existingTerms?: Term[];
  onImported: (terms: Term[]) => void;
  onClose: () => void;
}

function extractTagFromFileName(name: string): string {
  const match = name.match(/第\s*(\d+)\s*回(?:講義)?/);
  if (match) {
    const num = match[1];
    return LECTURE_TITLES[num] || `第${num}回講義`;
  }
  const cleanName = name.replace(/\.[^/.]+$/, '').replace(/[_\-]/g, ' ').trim();
  return cleanName.slice(0, 15);
}

function normalizeTerm(term: string): string {
  return term.trim().toLowerCase().replace(/\s+/g, ' ');
}

export default function FileImporter({ existingTerms = [], onImported, onClose }: FileImporterProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [extractedTerms, setExtractedTerms] = useState<ExtractedTerm[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [sourceName, setSourceName] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerResult, setRegisterResult] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 既存用語の正規化セット（高速ルックアップ用）
  const existingSet = new Set(
    existingTerms.map((t) => normalizeTerm(t.term))
  );

  // 既存のユニークなタグ一覧
  const existingTagsList = React.useMemo(() => {
    const set = new Set<string>();
    existingTerms.forEach((t) => {
      if (t.tag && t.tag.trim()) set.add(t.tag.trim());
    });
    return Array.from(set);
  }, [existingTerms]);

  const [activeCategory, setActiveCategory] = useState<string>('');

  // 複数ファイルを一括で処理する関数
  const handleFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) return;

    setError('');
    setMessage('');
    setRegisterResult('');
    setExtractedTerms([]);
    setSelectedIds(new Set());
    setIsExtracting(true);

    const rawExtracted: Array<{ term: string; note: string; tag: string }> = [];
    let errorCount = 0;
    let detectedCategory = '';

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fallbackTag = extractTagFromFileName(file.name);

      setProgressText(
        `全 ${files.length} ファイル中 ${i + 1} つ目の「${file.name}」をAIが解析中…`
      );

      try {
        const formData = new FormData();
        formData.append('file', file);
        if (existingTagsList.length > 0) {
          formData.append('existingTags', JSON.stringify(existingTagsList));
        }

        const res = await fetch('/api/extract', { method: 'POST', body: formData });
        const data = await res.json();

        if (res.ok && data.terms && data.terms.length > 0) {
          const fileCategory = (data.category || '').trim() || fallbackTag;
          if (!detectedCategory && fileCategory) {
            detectedCategory = fileCategory;
          }

          data.terms.forEach((t: any) => {
            rawExtracted.push({
              term: (t.term || '').trim(),
              note: (t.note || '').trim(),
              tag: fileCategory,
            });
          });
        } else if (!res.ok) {
          errorCount++;
        }
      } catch {
        errorCount++;
      }
    }

    setIsExtracting(false);
    setProgressText('');

    if (rawExtracted.length === 0) {
      setError(
        errorCount > 0
          ? `${files.length} 件のファイルから用語を抽出できませんでした（一部エラー発生）。`
          : '指定されたファイルから復習すべき重要用語は見つかりませんでした。'
      );
      return;
    }

    const mainCategory = detectedCategory || '一般';
    setActiveCategory(mainCategory);

    // 重複マージ（ファイル間での同じ単語を1つに統合）
    const termMap = new Map<string, ExtractedTerm>();
    let duplicateCount = 0;

    rawExtracted.forEach((item) => {
      if (!item.term) return;
      const key = normalizeTerm(item.term);

      if (termMap.has(key)) {
        duplicateCount++;
        const existing = termMap.get(key)!;
        // タグの結合
        if (item.tag && existing.tag && !existing.tag.includes(item.tag)) {
          existing.tag = `${existing.tag} / ${item.tag}`;
        }
      } else {
        const isExisting = existingSet.has(key);
        termMap.set(key, {
          term: item.term,
          note: item.note,
          tag: item.tag || mainCategory,
          isExisting,
        });
      }
    });

    const mergedList = Array.from(termMap.values());
    setExtractedTerms(mergedList);

    const sourceSummary =
      files.length === 1
        ? files[0].name
        : `${files[0].name} ほか全 ${files.length} ファイル`;
    setSourceName(sourceSummary);

    const dupeMsg = duplicateCount > 0 ? `（重複 ${duplicateCount} 件を統合済）` : '';
    setMessage(
      `合計 ${files.length} ファイルから ${mergedList.length} 件の最重要用語を厳選したで！${dupeMsg}`
    );

    // 初期選択：すでに登録済みのものは除外して選択
    const initialSelected = new Set<number>();
    mergedList.forEach((item, i) => {
      if (!item.isExisting) {
        initialSelected.add(i);
      }
    });
    // すべて登録済みの場合は全選択
    if (initialSelected.size === 0 && mergedList.length > 0) {
      mergedList.forEach((_, i) => initialSelected.add(i));
    }
    setSelectedIds(initialSelected);
  }, [existingSet, existingTagsList]);

  const updateAllTags = (newCategory: string) => {
    setActiveCategory(newCategory);
    setExtractedTerms((prev) =>
      prev.map((item) => ({
        ...item,
        tag: newCategory.trim() || '一般',
      }))
    );
  };

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
    const targetIdx = [...selectedIds];
    const toRegister = targetIdx.map((i) => extractedTerms[i]);
    if (toRegister.length === 0) return;

    setIsRegistering(true);
    setError('');
    setRegisterResult('');

    try {
      // fetch は HTTP 409（重複）や 500 でも reject しない（例外は通信自体が
      // 失敗した時だけ）。以前は Promise.allSettled の fulfilled/rejected だけを
      // 見ていたため、409/500 は succeeded にも failed にも数えられず、
      // 「登録件数もエラーも出ないまま何も起きない」ように見えていた。
      const results = await Promise.all(
        toRegister.map((t) =>
          fetch('/api/terms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ term: t.term, note: t.note, tag: t.tag }),
          })
            .then(async (r) => ({ ok: r.ok, status: r.status, body: await r.json().catch(() => ({})) }))
            .catch((err) => ({ ok: false, status: 0, body: { error: err?.message } }))
        )
      );

      const succeeded: Term[] = [];
      let duplicateCount = 0;
      let failedCount = 0;
      const registeredIdx = new Set<number>();

      results.forEach((r, i) => {
        const originalIdx = targetIdx[i];
        if (r.ok && r.body?.term) {
          succeeded.push(r.body.term);
          registeredIdx.add(originalIdx);
        } else if (r.status === 409) {
          duplicateCount += 1;
          registeredIdx.add(originalIdx); // 既に登録済みなので選択リストから外してよい
        } else {
          failedCount += 1;
        }
      });

      if (succeeded.length > 0) {
        onImported(succeeded);
      }

      // 登録・重複が確定した項目はリストから外し、失敗した項目だけ再登録できるように残す
      setExtractedTerms((prev) => prev.filter((_, i) => !registeredIdx.has(i)));
      setSelectedIds(new Set());

      const parts: string[] = [];
      if (succeeded.length > 0) parts.push(`登録 ${succeeded.length} 件`);
      if (duplicateCount > 0) parts.push(`すでに登録済み ${duplicateCount} 件`);
      if (failedCount > 0) parts.push(`失敗 ${failedCount} 件`);
      setRegisterResult(parts.join(' / '));

      if (failedCount > 0) {
        setError(`${failedCount} 件の登録に失敗しました。もう一度試すか、内容を確認してください。`);
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
          {/* 全件登録・全件重複などで抽出リストが空になった直後の結果画面。
              これが無いと登録完了と同時にドロップゾーンへ戻ってしまい、
              「何件登録できたか」が一瞬も表示されないまま消えていた。 */}
          {extractedTerms.length === 0 && !isExtracting && registerResult && (
            <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
              <span className="text-4xl">✅</span>
              <p className="font-serif text-lg font-bold text-[#1A1714]">{registerResult}</p>
              <button
                onClick={() => setRegisterResult('')}
                className="border-2 border-[#1A1714] bg-[#1A1714] px-4 py-2 font-bold text-[#F7F1E3] hover:bg-[#332f2b]"
              >
                さらにファイルを追加する
              </button>
            </div>
          )}

          {/* ドラッグ＆ドロップエリア */}
          {extractedTerms.length === 0 && !isExtracting && !registerResult && (
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

              {/* 分野（タグ名）設定バー */}
              <div className="mb-4 rounded border-2 border-[#1A1714] bg-white p-3 shadow-[2px_2px_0_0_#1A1714]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs font-bold text-[#8a6300]">🏷️ 登録する分野名（タグ）:</span>
                    <span className="text-[10px] text-[#1A1714]/50">AI自動判定・変更可能</span>
                  </div>
                  {existingTagsList.length > 0 && (
                    <div className="flex flex-wrap gap-1 items-center">
                      <span className="text-[10px] text-[#1A1714]/50">既存タグ:</span>
                      {existingTagsList.slice(0, 4).map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => updateAllTags(tag)}
                          className={`border px-1.5 py-0.5 text-[10px] font-bold transition-colors ${
                            activeCategory === tag
                              ? 'border-[#B83227] bg-[#B83227] text-white'
                              : 'border-[#1A1714]/30 bg-white hover:border-[#1A1714]'
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="mt-2">
                  <input
                    type="text"
                    value={activeCategory}
                    onChange={(e) => updateAllTags(e.target.value)}
                    placeholder="例: Webアプリの攻撃と防御"
                    className="w-full border-2 border-[#1A1714] bg-[#F7F1E3] px-3 py-1.5 text-xs font-bold text-[#1A1714] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#B83227]"
                  />
                </div>
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
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-bold text-[#1A1714]">{item.term}</p>
                        {item.tag && (
                          <span className="rounded bg-[#1A1714]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#1A1714]/70">
                            {item.tag}
                          </span>
                        )}
                        {item.isExisting && (
                          <span className="rounded bg-[#B83227]/10 px-1.5 py-0.5 text-[10px] font-bold text-[#B83227]">
                            登録済み
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-xs text-[#1A1714]/60">{item.note}</p>
                    </div>
                  </label>
                ))}
              </div>

              {registerResult && (
                <div className="mt-3 border-2 border-[#1A1714] bg-[#D9A441]/20 px-4 py-2 text-sm font-bold text-[#1A1714]">
                  {registerResult}
                </div>
              )}

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
                    setRegisterResult('');
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
