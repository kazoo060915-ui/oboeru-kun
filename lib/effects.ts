import confetti from 'canvas-confetti';

/**
 * 得点に応じたアニメーション効果を発火
 */
export function triggerScoreEffects(score: number) {
  if (typeof window === 'undefined') return;

  // 🌸 80点以上（高得点・花丸）：和風の華やかな桜吹雪＆金銀吹雪
  if (score >= 80) {
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
  // ✨ 40〜79点（合格・まずまず）：中央からフワッと広がる星・金色の紙吹雪
  else if (score >= 40) {
    confetti({
      particleCount: 40,
      spread: 60,
      origin: { y: 0.6 },
      colors: ['#D9A441', '#E67E22', '#1A1714', '#F7F1E3'],
      scalar: 0.9,
    });
  }
  // 💧 40点未満は confetti を出さず、UI側のシェイク＋雨粒エフェクト
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
