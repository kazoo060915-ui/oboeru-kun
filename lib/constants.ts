// 間隔リピティションの復習間隔（日数）。レベル0〜4に対応。
// 採点API（サーバー）とレベル表示（クライアント）の両方が参照するため、
// 定義はここ1箇所だけに置く。以前は app/page.tsx と
// app/api/grade/route.ts に同じ配列がコピーされていた。
export const INTERVALS = [1, 3, 7, 14, 30];

// 採点スコアの閾値。レベル昇格・演出・判子の文言すべてがここを参照する。
// 以前は app/api/grade/route.ts が 80/50、lib/effects.ts が 80/40、
// components/Stamp.tsx が 80/50 と、ファイルごとに別々の数字を持っていたため、
// 40〜49点で「紙吹雪（祝福）」と「レベルリセット（降格）」が同時に起きていた。
export const SCORE_PROMOTE = 80; // これ以上でレベルアップ
export const SCORE_KEEP = 50; // これ以上ならレベル維持、未満はレベル0へリセット
