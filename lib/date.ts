// 「今日」の定義を日本時間に固定するための唯一の窓口。
//
// 以前は各所で new Date().toISOString().slice(0, 10) を使っていたが、
// これは UTC 基準なので日本時間とは最大9時間ズレる。実害は2つあった:
//
//   1. 毎朝の通知が「今日の分」を丸ごと取りこぼす
//      Vercel Cron は 22:00 UTC (= 07:00 JST) に走るが、その瞬間の
//      UTC 日付はまだ前日。next_review_at <= '前日' で検索するため、
//      JST の今日が復習日の用語が1件も引っかからなかった。
//
//   2. 朝に採点した用語が、その日のうちに復習キューへ戻ってくる
//      JST 08:00 に採点すると next_review_at が「JSTの今日」に設定され、
//      UTC の日付が変わる JST 09:00 に due 判定が真になって復活していた。
//
// サーバー（Vercel は UTC）でもブラウザ（端末のTZ次第）でも同じ答えを返す。

const JST = 'Asia/Tokyo';

// en-CA ロケールは YYYY-MM-DD 形式を返す
const jstFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: JST,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** 日本時間での「今日」を YYYY-MM-DD で返す */
export function todayStr(): string {
  return jstFormatter.format(new Date());
}

/** 日本時間での「今日」から n 日後を YYYY-MM-DD で返す */
export function addDaysStr(n: number): string {
  const [y, m, d] = todayStr().split('-').map(Number);
  // UTC で日付計算するのは、DST や月跨ぎでズレないようにするため。
  // 基準日は既に JST で確定しているので、ここでの UTC 利用は安全。
  const base = new Date(Date.UTC(y, m - 1, d));
  base.setUTCDate(base.getUTCDate() + n);
  return base.toISOString().slice(0, 10);
}
