import confetti from 'canvas-confetti';
import { SCORE_PROMOTE, SCORE_KEEP } from './constants';

/**
 * 得点に応じたアニメーション効果を発火
 * @param isWakaran 「わからん」経由の回答なら true。正直な自己申告を演出で罰さないよう、
 *   低得点時のシェイク・雨粒（呼び出し側の JSX）と同様に紙吹雪も抑制する。
 */
export function triggerScoreEffects(score: number, isWakaran: boolean = false) {
  if (typeof window === 'undefined' || isWakaran) return;

  // 🌸 80点以上（高得点・花丸）：和風の華やかな桜吹雪＆金銀吹雪
  if (score >= SCORE_PROMOTE) {
    const end = Date.now() + 1.2 * 1000;
    const colors = ['#B83227', '#D9A441', '#FFB7C5', '#FFFFFF', '#E67E22'];

    (function frame() {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: colors,
        shapes: ['circle', 'square'],
        scalar: 1.1,
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: colors,
        shapes: ['circle', 'square'],
        scalar: 1.1,
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    })();
  }
  // ✨ 50〜79点（レベル維持ライン以上）：中央からフワッと広がる星・金色の紙吹雪
  // 閾値はレベル維持ラインの SCORE_KEEP と揃える。以前は 40 点固定だったため
  // 40〜49点（＝レベルは 0 にリセットされる）でも紙吹雪が舞い、
  // 「祝福」と「降格」が同一フレームで衝突していた。
  else if (score >= SCORE_KEEP) {
    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#D9A441', '#E67E22', '#1A1714', '#F7F1E3'],
      scalar: 0.9,
    });
  }
  // 💧 50点未満（＝レベル0リセット）は confetti を出さず、UI側のシェイク＋雨粒エフェクト
}

/**
 * セッション達成時のフィナーレ紙吹雪
 */
export function triggerSessionCompleteEffects(avgScore: number) {
  if (typeof window === 'undefined') return;

  const count = avgScore >= 70 ? 120 : 60;
  confetti({
    particleCount: count,
    spread: 100,
    origin: { y: 0.5 },
    colors: ['#B83227', '#D9A441', '#FFB7C5', '#FFFFFF'],
  });
}
