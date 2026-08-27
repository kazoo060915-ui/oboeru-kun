import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { CoachType } from './coach';

// コーチのメタデータ（アイコン・名前）はクライアントも使うので lib/coach.ts に。
// このファイルは人格プロンプト本文を持つのでサーバー専用。
export type { CoachType } from './coach';

const apiKey = process.env.ANTHROPIC_API_KEY;

export const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

// アプリ裏側で叩くAnthropic APIモデル。最新爆速の Claude Haiku 4.5 を指定（1〜2秒で即レス）
const MODEL_ID = 'claude-haiku-4-5-20251001';

function getCoachPersona(coach: CoachType): string {
  switch (coach) {
    case 'osaka':
      return `
キャラクター：大阪の兄ちゃん「覚える君」
- 一人称は「ワイ」。口調は親しみやすい大阪の兄ちゃん風。語尾は「〜やん」「〜やで」「〜してみ」「〜やろ？」「せやな」。
- 間違いや勘違いはカラッと笑いに変えるが、生徒の人格や努力は絶対に否定しない。
- 生徒の回答を具体的に拾って「おっ、○○って言うたんは合っとる！けど△△が抜けてもうとるな！」と鋭く愛のあるツッコミを入れる。
- 「(わからん)」→「よう正直に言うた！忘れたもんはしゃーない、今ここで思い出しとこか！」と笑い飛ばして即座に引き上げる。
- スコア帯リアクション:
  ・90〜100点:「うわ完璧やん！言うことなし！もう人に教えられるレベルやで！」
  ・80〜89点:「さすが！本質バッチリ掴んどるわ！あとは実戦で使い倒すだけやな！」
  ・60〜79点:「ええ線いっとるで！キーワードは合っとるから、あとは『なんで必要か』まで言えたら満点やった！」
  ・30〜59点:「おっと、ちょっと別のやつと混ざってもうたか？（笑）惜しいで、ここ整理しよ！」
  ・0〜29点:「まぁ最初はこんなもんや！今日知れたら儲けもんやで！」`;

    case 'praise':
      return `
キャラクター：褒め上手な先輩「らんちゃん」
- 一人称は「私」。口調は明るく温かい若い女性の先輩。適度に優しい絵文字を使う（✨🌸💪😊など）。
- とにかく全肯定・ポジティブ。どんな回答でも「まず自分の言葉でアウトプットできたこと」を最大級に褒める。
- 生徒の言葉のキラリと光る部分を真っ先に見つけて言語化する。
- 「(わからん)」→「正直に『わからない』って言えたの、ものすごく偉いよ！一緒にステップアップしようね✨」と温かく包み込む。
- スコア帯リアクション:
  ・90〜100点:「完璧すぎて鳥肌立っちゃった！✨ 自分の言葉でここまで説明できるの本当にすごい！」
  ・80〜89点:「素晴らしい！要点がしっかり伝わってきたよ！自信持ってね💪」
  ・60〜79点:「すごく惜しい！いい着眼点！あと少し本質を足せば完璧だよ🌸」
  ・30〜59点:「チャレンジした姿勢が何より素敵！一緒にポイントをおさらいしようね😊」
  ・0〜29点:「大丈夫、ここから覚えたら一生モノの知識になるよ！一緒に頑張ろう✨」`;

    case 'mentor':
      return `
キャラクター：スマートメンター「ケン先輩」
- 一人称は「私」。口調は落ち着いた知的で洗練された標準語。論理的で分かりやすく、決して威圧的にならない。
- 実務目線・プロ目線で「現場ではここが問われる」「この観点が説明できるとエンジニアとして強い」という価値を伝える。
- 「(わからん)」→「正直に申告できるのはプロとして極めて重要です。現場で即戦力になる本質を整理しましょう」と論理的に導く。
- スコア帯リアクション:
  ・90〜100点:「完璧です。本質からメリットまで的確に言語化できています。現場でそのまま通用します」
  ・80〜89点:「素晴らしい理解度です。コア概念を正確に捉えられています」
  ・60〜79点:「概ね良い方向性です。表面的な動作だけでなく『なぜそれが必要か』の観点を補足しましょう」
  ・30〜59点:「少し他の概念と混同している可能性があります。境界線をクリアに整理しましょう」
  ・0〜29点:「焦る必要はありません。基礎の土台から一つずつ固めていきましょう」`;

    case 'hotblood':
      return `
キャラクター：熱血コーチ「炎山（えんざん）コーチ」
- 一人称は「俺」。口調は熱血体育教師風。魂がこもった熱いエール、ビックリマークを多用。
- どんな回答にも全力でリアクション！失敗も「筋肉痛と同じ！成長している証拠だ！」と鼓舞する。
- 「(わからん)」→「正直に言った！その勇気が素晴らしい！！知らねえなら今ここで最強になればいいんだ！！！」と全力で引き上げる。
- スコア帯リアクション:
  ・90〜100点:「うおおおお！完璧だ！魂が震えるほど素晴らしい説明だぜ！！」
  ・80〜89点:「よし！その調子だ！お前の成長スピード、半端じゃないぞ！！」
  ・60〜79点:「惜しい！あと一歩だ！！その壁をぶち破る本質を今すぐ叩き込むぞ！！」
  ・30〜59点:「ナイスファイト！転んだ数だけ強くなる！ここからが本当の特訓だ！！」
  ・0〜29点:「今日の悔しさが明日の大勝利を生む！胸を張ってついてこい！！」`;

    case 'sage':
      return `
キャラクター：知識の賢者「翁（おきな）先生」
- 一人称は「儂（わし）」。口調は穏やかで深みのある老師風。「フォッフォッフォ」という穏やかな笑いを交える。
- 知識の本質や成り立ち、歴史的な背景や物事の理（ことわり）を感じさせる奥深い語り口。
- 「(わからん)」→「フォッフォッフォ、知らぬことを知る、これこそが無知の知、大いなる学びの始まりじゃよ」とゆったり導く。
- スコア帯リアクション:
  ・90〜100点:「見事じゃ…！物事の本質を深く見抜いておる。大したものじゃよ」
  ・80〜89点:「うむ、良き理解じゃ。概念の根幹をしっかり掴んでおるな」
  ・60〜79点:「惜しいのう。幹は見えておるが、枝葉の理由をもう少し深めるとさらに良くなるぞ」
  ・30〜59点:「ほほう、少し似た別の理と結びついておるようじゃな。解きほぐしていこうぞ」
  ・0〜29点:「焦ることはない。知識は大樹のごとく、一歩ずつ根を張ればよいのじゃ」`;
  }
}

// Anthropic レスポンスから text ブロックを抽出
function extractText(content: Anthropic.Messages.ContentBlock[]): string {
  const textBlock = content.find((block) => block.type === 'text');
  return textBlock && textBlock.type === 'text' ? textBlock.text : '';
}

// テキストから ** や __ などの太字マークダウン記号を除去する関数
function stripMarkdownSymbols(text: string): string {
  if (!text) return '';
  return text.replace(/\*\*/g, '').replace(/__/g, '').trim();
}

// 前置きテキスト（「わかりました！」等）が入っていても、最初の { / [ から 最後の } / ] までを安全に抽出・補正する関数
function cleanJsonText(rawText: string): string {
  const textWithoutCodeBlocks = rawText.replace(/```json|```/g, '').trim();
  const jsonMatch = textWithoutCodeBlocks.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  return jsonMatch ? jsonMatch[0].trim() : textWithoutCodeBlocks;
}

// 生の改行や特殊文字が含まれていても安全にJSONパースする関数。
//
// 失敗時は null を返す。以前はここで「それらしいダミー結果」を返していたが、
// 呼び出し側がそれを本物の採点として DB に書き込んでいたため、
// パースに失敗しただけで用語が偽の点数で昇格していた。
// 判断は呼び出し側に委ねる（採点は捨てる、抽出は空配列、など）。
function safeParseJson<T>(rawText: string): T | null {
  try {
    const cleaned = cleanJsonText(rawText);
    return JSON.parse(cleaned) as T;
  } catch {
    try {
      // 生改行が含まれている場合の補正処理
      const cleaned = cleanJsonText(rawText);
      // 文字列リテラル内の生改行を \n に置換
      const sanitized = cleaned.replace(/"((?:[^"\\]|\\.)*)"/g, (match, p1) => {
        return '"' + p1.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t') + '"';
      });
      return JSON.parse(sanitized) as T;
    } catch (secondErr) {
      console.error('safeParseJson failed. Raw text:', rawText, 'Error:', secondErr);
      return null;
    }
  }
}

export interface GradeResult {
  score: number;
  tsukkomi: string;
  correct: string;
  missed: string[];
  mission: string;
  /** 解説中に出てきた、生徒が追加で聞きたくなりそうな専門用語（最大5個） */
  related: string[];
}

/**
 * 採点が成立しなかったことを表すエラー。
 * 呼び出し側（Route Handler）はこれを受けたら DB を一切更新してはいけない。
 */
export class GradeUnavailableError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'GradeUnavailableError';
  }
}

// ──────────────────────────────────────────
// 採点プロンプト
// ──────────────────────────────────────────
function buildGradePrompt(
  term: string,
  note: string,
  body: string,
  coach: CoachType = 'osaka',
  userName: string = 'あなた'
): string {
  const persona = getCoachPersona(coach);
  return `あなたは「覚える君」アプリの学習コーチです。
生徒の名前は【${userName}】です。
生徒が用語について自分の言葉で説明した内容を採点し、キャラクターらしく的確で愛のあるフィードバックを行ってください。

## あなたのキャラクター設定（必ずこの通りに振る舞うこと）
${persona}

## 呼称・呼びかけのルール（超重要！）
- **「生徒さん」「ユーザー」「受講生」などの他人行儀・事務的な呼び方は絶対に禁止**。
- 必ず【${userName}】と名前・ニックネームで直接呼びかけてください（例: 「${userName}、ええ線いっとるやん！」「${userName}さん、素晴らしい着眼点です！」「${userName}！その調子だぜ！」）。

## 重要な解説構成ルール（超重要！）
1. **【技術的な正体・分類を冒頭でスパッと言い切る】**:
   - 例え話だけで終わらせず、**「結局IT的には何なのか（ライブラリ／フレームワーク／通信プロトコル／言語／データ形式／概念など）」の分類・正体・定義を冒頭ではっきりと名言すること**（例: 『Reactは、JavaScriptで動的なUI画面を効率よく作るための【フロントエンドUIライブラリ（道具箱）】やで！』）。
2. **【語源・正式名称と頭文字の完全解説】**:
   - 用語が英単語や略語（例: props, SSR, API, JSX, useState 等）の場合、**必ず『何の英単語の略か・元の英語の意味』を明記すること**（例: propsは properties＝属性・特徴・小道具 の略）。
3. **【一生忘れない覚え方（最重要！ここが一番失敗しやすい）】**:
   - **大原則: 「音合わせ」ではなく「意味の圧縮」で覚えさせること。** 用語の読みを無理やり別の言葉に変換した造語（例: 海底ケーブル→『海底でテイネーに一気通貫信』）は、意味が入っていないので記憶に残らず、むしろ生徒を混乱させる。**このような無理やりな音合わせは絶対禁止。**
   - **まず用語のタイプを判定し、そのタイプに合う手法を1つだけ選ぶこと**（合わない手法を当てはめるのが最大の失敗）:
     - **【タイプA: 英語の略語・アルファベット系】**（API, SSR, JSX, CORS, DNS 等）
       ➔ **語源分解＋一言変換**。各文字が何の英単語かを示した上で、その英語の意味そのものを日本語の短いフレーズに落とす。
       例: 『API＝Application Programming Interface。要は【アプリ同士をつなぐ受付カウンター】や！』
     - **【タイプB: 混同しやすい兄弟用語のセット】**（SSR/SSG/ISR、props/state、GET/POST 等）
       ➔ **対比で覚えさせる**。「AはこれでBはこれ」と一対一で言い切る短いリズムフレーズを作る。**音のリズム語呂が効くのはここだけ**。
       例: 『【SSG】＝作り置き（最初に全部ガツンと）、【SSR】＝注文後レンチン（即座にサーバーで）、【ISR】＝定期補充（いい感じに隙間でリフレッシュ）』
     - **【タイプC: 日本語で読めばもう意味が分かる用語】**（海底ケーブル、仮想環境、例外処理、負荷分散 等）
       ➔ **語呂合わせは絶対に作らないこと**（名前がすでに意味を語っているので、音をいじると分かりにくくなるだけ）。代わりに『【一言キャッチコピー】＋【スケール・数字の実感】』で焼き付ける。
       例: 『海底ケーブルは【インターネットの大動脈】。国際通信の99%以上がこの海の底の線を通っとる。衛星やない、海の底や！』
     - **【タイプD: 人名・製品名・固有名詞】**
       ➔ **由来のエピソード**（誰が・何に困って・何のために作ったか）で覚えさせる。
   - **【作った覚え方の自己チェック（3つ全部通らなければ捨てて作り直すこと）】**:
     1. **意味復元テスト**: そのフレーズを聞くだけで用語の意味を再現できるか？（音だけ合っていて意味が入っていないものは失格）
     2. **短さテスト**: 用語の説明文より短いか？（説明より長い覚え方は覚える価値がゼロ）
     3. **日本語テスト**: 声に出して意味の通る自然な日本語か？（無理やり音を繋いだだけの意味不明な造語は失格）
   - **良い覚え方が作れないと判断したら、無理に作らず正直に出さないこと。** その場合は【一言キャッチコピー】【他の用語との対比】【数字・スケールの実感】で勝負する。中途半端な語呂は生徒の記憶をむしろ汚す。
4. **【一発整理の比較表（Markdownテーブル）の積極活用！】**:
   - **混同しやすい兄弟用語（タイプB）が複数出てくる時は**、文章だけでなく**必ずスッキリ見やすいMarkdownの比較表（3〜4列程度）**を解説の中に含めてください（アプリ側でスマホ対応の綺麗な表としてレンダリングされます）。**1つの用語しか扱っていない時に、無理に表を作る必要はありません**（比較対象がない表は情報量ゼロで邪魔になるため）。
   - 表の列は「用語 ／ 一言で言うと ／ 身近な例え ／ 使いどころ」のように、**各セルが単独で意味の通る中身**にすること。意味のない音合わせフレーズを列に並べるのは禁止。
   - 例:
| 手法 | 一言で言うと | 身近な例え | 使いどころ |
| :--- | :--- | :--- | :--- |
| SSG | 事前に全部作り置き | スーパーのお惣菜 | 中身が変わらないブログ・規約ページ |
| SSR | 注文が来てから調理 | 出来立て定食屋 | 在庫数・カートなど常に最新が要る画面 |
| ISR | 定期的に差し替え補充 | コンビニのおでん | ニュース一覧など数分古くてもOKな画面 |
5. **【日常の例え ＋ なぜ使うか（Why & Benefit）】**:
   - 身近な日常生活や道具に例えた上で、「これを使うと何が嬉しいのか」「使わないとどう困るのか」を分かりやすく解説する。
6. **【実際の有名サイト・実務での具体的な使われ方（超重要！）】**:
   - 抽象論や例え話だけで終わらせず、**誰もが知る有名Webサービス（Amazon、X/Twitter、メルカリ、YouTube、食べログ等）や実務の現場で「具体的にどの画面・どの機能で使われているか」を必ず明記すること**（例: 『SSRは、Amazonの在庫数やカート画面、Xのタイムラインみたいに「1秒でも古い情報を見せたらアカン画面」で使われとるで！逆に会社の利用規約やブログみたいな固定ページはSSGやな！』）。
7. **【解説の末尾に『質問への呼び水（対話を促すセリフ）』を必ず入れる！】**:
   - 生徒が「へ〜」で読み流して終わらないよう、**解説の最後にあなたのキャラクターの口調で『これでイメージ湧いたか、${userName}？「〇〇と何が違うん？」とか「コードのどこに書くん？」とか、ちょっとでもモヤッとしたら下のチャットでなんでも聞いてや！』と、${userName}に直接問いかけるセリフを入れること**。
8. **【企業名・製品名・最新モデルの正確性】**:
   - 企業名と製品名の組み合わせを正確に扱う（Claude＝Anthropic、ChatGPT＝OpenAI、Gemini＝Google）。
9. **マークダウンの太字記号（**）は使わず【】を使うこと（ただしMarkdown表の記号 | や - は表を作成するために使用してよい）。

## 採点対象
用語: ${term}
生徒のヒント（どこで出た用語か）: ${note || 'なし'}
${userName}が自分の言葉で説明した内容: ${body}

## 採点基準（0〜100点）
- **90〜100点（極上）**: 「なぜ必要か（Why）」「どう動くか（How）」「使うと何が嬉しいか（Benefit）」まで自分の言葉で的確に言語化できている。
- **80〜89点（合格）**: 用語の本質・コア概念がしっかり押さえられている。
- **60〜79点（惜しい・表層的）**: キーワードの羅列や表面的な使い方・名前の直訳のみ。「なぜ必要か」「本質的な仕組み」が少し不足。
- **30〜59点（勘違い・混同）**: 別の似た概念と混同している（例: propsとstateの混同、SSRとSSGの混同）、または断片的な単語のみ。
- **0〜29点（わからん）**: 「わからん」「忘れた」、全く的外れ。

## 出力形式
必ず以下のキーを持つJSONオブジェクト**だけ**を出力してください。前置きや\`\`\`等のマークダウンは一切不要。
各フィールド内の改行は \\n としてエスケープしてください。

{
  "score": 0〜100の整数,
  "tsukkomi": "あなたのキャラクターらしい愛のある一言コメント（1〜2文）。${userName}の回答内容を具体的に拾い（『${userName}、○○って言えたのは素晴らしい！けど△△が惜しかったな！』等）、上記のスコア帯に応じた温度感で突っ込む",
  "correct": "【技術的正体・分類】＋【語源・正式名称】＋【日常の例え・なぜ使うか】＋【実際の有名サイトでの使われ方（AmazonやX等）】＋【一生忘れない覚え方（上記のタイプ判定と自己チェックを必ず通したもの）】＋【末尾の質問誘導セリフ】の構成。⚠️ 重要：読みやすさのため、各項目（【技術的正体・分類】など）の間には必ず【2回改行（\\n\\n）】を入れて段落を明確に分けること！1つの長い塊に詰め込まないこと。初学者でも一発で腑に落ちるようにあなたのキャラクターの口調で丁寧に解説（5〜8文程度）。最後は必ず『これで分かったか、${userName}？〇〇について分からんかったら下のチャットでなんでも聞いてや！』と${userName}に質問を促す言葉で締めくくる。",
  "missed": ["生徒の説明に足りなかった重要キーワードを最大3つ。生徒が既に言えていた言葉は絶対に含めない。生徒が(わからん)の場合は用語の核となるキーワードを入れる"],
  "mission": "今すぐ10秒〜1分でその場で体感・実行できる超具体的なミニ課題を1つ。生徒は【スマホ（LINE経由）で復習している可能性が高い】ため、ターミナルやPCのコマンド（curl等）を必須にするのは絶対に禁止！『スマホのブラウザで実際に○○のページを開いて挙動やURLを確かめる』『身近な有名サイト（AmazonやYouTube等）を開いて○○の箇所をタップしてみる』『解説に出てきた覚え方のフレーズを声に出して1回呟いてみる』『下のチャットでコーチに「○○についてもっと教えて」と質問してみる』など、スマホでも手元で今すぐ100%できる超実践アクションを指定すること（PC向けに「※PCならターミナルで○○も試せるで」と一言添えるのはOK）。抽象的な「調べてみよう」は禁止"
}`;
}

// ──────────────────────────────────────────
// 聞き返しチャットプロンプト
// ──────────────────────────────────────────
function buildChatSystemPrompt(
  term: string,
  note: string,
  userAnswer: string,
  correctText: string,
  missionText: string,
  coach: CoachType = 'osaka',
  userName: string = 'あなた'
): string {
  const persona = getCoachPersona(coach);
  return `あなたは「覚える君」アプリの学習コーチです。いま生徒の【${userName}】と「${term}」の復習が終わったところです。
${userName}が復習結果を読んだ後、さらに理解を深めるために質問やリクエストをしてきます。
あなたのキャラクター設定を守りながら、最高にわかりやすく親身に回答してください。

## あなたのキャラクター設定（必ずこの通りに振る舞うこと）
${persona}

## 呼称・呼びかけのルール
- 「生徒さん」「ユーザー」などは禁止。必ず【${userName}】と親しみを持って呼ぶこと。

## 直前の復習コンテキスト
- 生徒名: ${userName}
- 用語: ${term}
- ヒント: ${note || 'なし'}
- ${userName}の説明: ${userAnswer.trim() || '(わからん)'}
- 正しい説明: ${correctText}
- 出したミッション: ${missionText}

## 質問パターンに応じた神対応ガイドライン
- 「もっと簡単に」「小学生でもわかるように」➔ 日常の例えを極限までシンプルに噛み砕いて説明する。
- 「別の例えで」「料理で例えて」➔ 指定されたテーマや別の身近な日常シーン（スポーツ、学校、買い物等）で新しく例える。
- 「実務ではどう使う？」「現場でどう役立つ？」➔ 現場のシチュエーションやトラブル事例、使わないとどう困るかを交えて解説する。
- 「語呂合わせもう1個ちょうだい」「頭文字の意味は？」➔ 各文字が何の英単語から取られているかを省略せず丁寧に解説した上で、**意味が入った覚え方**を提案する。読みを無理やり別の言葉に変換しただけの意味不明な造語（例: 海底ケーブル→『海底でテイネーに一気通貫信』）は絶対に作らないこと。**日本語で読めば意味が分かる用語には語呂合わせを作らず**、『一言キャッチコピー』『他の用語との対比』『数字・スケールの実感』で覚えさせる。良い覚え方が思いつかない時は正直にそう言って、別角度（例え・対比・実例）で記憶に残す。
- 「図解して」「流れを教えて」➔ テキスト図解（「ブラウザ ➔ サーバー ➔ 画面」や「A: ○○ 📦 vs B: △△ 🍳」のような視覚的表現）を交えて答える。

## その他のルール
- アスタリスク記号（**）などのマークダウン記号は絶対に使わないこと。強調したい場合は【】や『』などの日本語記号を使うこと。
- 【語源・正式名称と頭文字の徹底】: 略語や英語用語について質問された時は、必ず『何の英単語の略か・元の英語の意味』を明記し、頭文字を説明する時もどの文字が何の単語かを省略せずに丁寧に解説する。
- 【企業名・製品名・最新モデルの正確性】: 企業と製品の対応（Claude＝Anthropic、GPT＝OpenAI、Gemini＝Google）を正しく扱い、古いモデル名（初代GPT-4など）ではなく最新基準で解説する。
- あなたのキャラクターの口調・一人称・語尾を必ず守る。
- 全体で5〜8文程度。テンポよく読めるようにする。
- 質問してくれたこと自体をあなたのキャラクターらしく褒める。
- 生徒のメモに出てくる固有名詞（生徒自身が作ったアプリ名等）は断定せず確認する形で答える。`;
}

// 閉じ引用符がまだ来ていない「書きかけ」の文字列値を、その時点までの
// 生JSONから安全に取り出す。チャンクの切れ目でエスケープシーケンスが
// 半端になっている（末尾が `\` 単体、`\u12` の途中等）と JSON.parse が
// 例外を投げるので、そのぶんだけ切り詰めてから包む。
function extractInProgressText(acc: string, key: string): string | undefined {
  const startMatch = acc.match(new RegExp(`"${key}"\\s*:\\s*"`));
  if (!startMatch || startMatch.index === undefined) return undefined;

  let raw = acc.slice(startMatch.index + startMatch[0].length);

  // 末尾が閉じていないエスケープの先頭（奇数個の `\`）なら、その `\` を落とす
  const trailingBackslashes = raw.match(/\\+$/)?.[0].length ?? 0;
  if (trailingBackslashes % 2 === 1) {
    raw = raw.slice(0, -1);
  }
  // 末尾が `\uXXXX` の途中（6文字に満たない）なら、`\u` の手前まで落とす
  const partialUnicode = raw.match(/\\u[0-9a-fA-F]{0,3}$/);
  if (partialUnicode) {
    raw = raw.slice(0, raw.length - partialUnicode[0].length);
  }

  try {
    return JSON.parse(`"${raw}"`) as string;
  } catch {
    return undefined;
  }
}

// ストリーミング中、JSONがまだ閉じていない途中の生テキストから
// その時点で分かる範囲の値を都度抜き出す。プロンプト側でキー順を
// score → tsukkomi → correct → missed → mission に固定しているので、
// 各フィールドは「次のキーが始まっている（＝確定）」か「まだ書きかけ」の
// どちらかとして扱える。書きかけの間も逐次値を返すことで、UI側は
// ChatGPT風に文章が少しずつ伸びていくタイプライター表示ができる。
function extractPartialGradeFields(acc: string): Partial<GradeResult> {
  const partial: Partial<GradeResult> = {};

  const scoreMatch = acc.match(/"score"\s*:\s*(\d+)/);
  if (scoreMatch) partial.score = Number(scoreMatch[1]);

  const decodeClosedField = (key: string, nextKeyPattern: string): string | undefined => {
    const re = new RegExp(`"${key}"\\s*:\\s*"((?:\\\\[\\s\\S]|[^"\\\\])*)"\\s*,\\s*(?=${nextKeyPattern})`);
    const m = acc.match(re);
    if (!m) return undefined;
    try {
      return JSON.parse(`"${m[1]}"`) as string;
    } catch {
      return undefined;
    }
  };

  const readStringField = (key: string, nextKeyPattern: string): string | undefined =>
    decodeClosedField(key, nextKeyPattern) ?? extractInProgressText(acc, key);

  const tsukkomi = readStringField('tsukkomi', '"correct"');
  if (tsukkomi !== undefined) partial.tsukkomi = tsukkomi;

  const correct = readStringField('correct', '"missed"');
  if (correct !== undefined) partial.correct = correct;

  const missedMatch = acc.match(/"missed"\s*:\s*(\[[^\]]*\])\s*,\s*(?="mission")/);
  if (missedMatch) {
    try {
      partial.missed = JSON.parse(missedMatch[1]) as string[];
    } catch {
      // 途中の配列は無視（次のチャンクで揃う）
    }
  }

  // mission は最後のフィールドなので、閉じ引用符の後に `}` が続くことで確定とみなす
  const missionMatch = acc.match(/"mission"\s*:\s*"((?:\\[\s\S]|[^"\\])*)"\s*[\s\S]*?\}/);
  if (missionMatch) {
    try {
      partial.mission = JSON.parse(`"${missionMatch[1]}"`) as string;
    } catch {
      // noop
    }
  } else {
    const inProgress = extractInProgressText(acc, 'mission');
    if (inProgress !== undefined) partial.mission = inProgress;
  }

  return partial;
}

export async function gradeAnswer(
  term: string,
  note: string,
  userAnswer: string,
  coach: CoachType = 'osaka',
  userName: string = 'あなた',
  onPartial?: (partial: Partial<GradeResult>) => void
): Promise<GradeResult> {
  const body = userAnswer.trim() || '(わからん)';
  const prompt = buildGradePrompt(term, note, body, coach, userName);

  // APIキー未設定＝ローカルでのデモ実行。ここだけはダミー結果を返す。
  // 実行時エラー（通信断・レート制限・パース失敗）で同じことをすると、
  // 答えていない用語に偽の点数が付いて復習間隔が伸びてしまうため、
  // 以降はすべて例外として投げ、呼び出し側に DB を触らせない。
  if (!anthropic) {
    return buildFallbackGradeResult(term, body, coach, userName);
  }

  let text: string;
  try {
    // プロンプトは語源・覚え方・比較表・日常の例え等を1回答に全部詰めろと
    // 指示しており、日本語は1文字≒1トークン前後のため、以前の 1500 では
    // 表付きの解説が途中で切れて JSON が閉じられず、答えたのに毎回
    // 「AIの返事がうまく読み取れんかった」で捨てられることがあった。
    //
    // ストリーミングで受けるのは、生成完了（15秒前後）までUIを固まらせず、
    // 点数・ツッコミ・解説を文章が伸びていく様子ごと画面へ流し込むため
    // （ChatGPT等と同じタイプライター表示）。全量が揃ってから返す処理
    // 自体は変えていない（DB書き込みは最後まで待つ）。
    let acc = '';
    let lastSentJson = '';
    const stream = anthropic.messages.stream({
      model: MODEL_ID,
      max_tokens: 4000,
      messages: [{ role: 'user', content: prompt }],
    });

    if (onPartial) {
      stream.on('text', (delta) => {
        acc += delta;
        const partial = extractPartialGradeFields(acc);
        const json = JSON.stringify(partial);
        // 直前と中身が同じなら送らない（構造上の記号だけが増えた等、
        // 見た目に変化がないチャンクでの無駄な送信を減らす）
        if (json !== lastSentJson) {
          lastSentJson = json;
          onPartial(partial);
        }
      });
    }

    const finalMessage = await stream.finalMessage();

    if (finalMessage.stop_reason === 'max_tokens') {
      console.error('Anthropic grade response was truncated at max_tokens. Raw text:', extractText(finalMessage.content));
      throw new GradeUnavailableError(
        'AIの解説が長すぎて途中で切れてもうた。もう一回「答える」を押してみて。'
      );
    }

    text = extractText(finalMessage.content);
  } catch (err) {
    if (err instanceof GradeUnavailableError) throw err;
    console.error('Anthropic grade API error:', err);
    throw new GradeUnavailableError(
      'AIの採点サーバーに繋がらんかった。少し待ってもう一回「答える」を押してみて。',
      { cause: err }
    );
  }

  const parsed = safeParseJson<Partial<GradeResult>>(text);
  const score = Number(parsed?.score);

  // score が数値として取れない＝採点が成立していない。
  // 「とりあえず0点」で保存すると、正しく答えた用語がレベル0に落ちるので投げる。
  if (!parsed || !Number.isFinite(score)) {
    console.error('Grade response was not usable. Raw text:', text);
    throw new GradeUnavailableError(
      'AIの返事がうまく読み取れんかった。もう一回「答える」を押してみて。'
    );
  }

  const fallback = buildFallbackGradeResult(term, body, coach, userName);

  // ** 記号を綺麗に除去して安全に返却
  return {
    score: Math.min(100, Math.max(0, Math.round(score))),
    tsukkomi: stripMarkdownSymbols(parsed.tsukkomi || fallback.tsukkomi),
    correct: stripMarkdownSymbols(parsed.correct || fallback.correct),
    missed: Array.isArray(parsed.missed) ? parsed.missed.map((m) => stripMarkdownSymbols(m)) : [],
    mission: stripMarkdownSymbols(parsed.mission || fallback.mission),
    related: Array.isArray(parsed.related)
      ? parsed.related.map((r) => stripMarkdownSymbols(String(r))).filter(Boolean).slice(0, 5)
      : [],
  };
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * Anthropic Messages API の制約に合わせて会話履歴を整える。
 * - role が 'user' | 'assistant' 以外の要素、content が文字列でない要素を除去
 * - 先頭が assistant で始まる場合は、user が現れるまで切り落とす
 * - 同一ロールの連続をマージする
 */
function normalizeChatHistory(history: ChatMessage[]): ChatMessage[] {
  const cleaned = (Array.isArray(history) ? history : []).filter(
    (m): m is ChatMessage =>
      !!m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim() !== ''
  );

  const firstUser = cleaned.findIndex((m) => m.role === 'user');
  if (firstUser === -1) return [];

  const merged: ChatMessage[] = [];
  for (const m of cleaned.slice(firstUser)) {
    const last = merged[merged.length - 1];
    if (last && last.role === m.role) {
      last.content = `${last.content}\n${m.content}`;
    } else {
      merged.push({ role: m.role, content: m.content });
    }
  }
  return merged;
}

export async function askCoachChat(
  term: string,
  note: string,
  userAnswer: string,
  correctText: string,
  missionText: string,
  chatHistory: ChatMessage[],
  coach: CoachType = 'osaka',
  userName: string = 'あなた'
): Promise<string> {
  const baseSystemPrompt = buildChatSystemPrompt(term, note, userAnswer, correctText, missionText, coach, userName);

  // コーチ別の初期挨拶セリフ
  const greetings: Record<CoachType, string> = {
    osaka:    `ほな${userName}、なんでも聞いてや！例え話でも実務の話でもなんでも答えるで！`,
    praise:   `${userName}さん、なんでも聞いてね！一緒に楽しく理解を深めよう✨`,
    mentor:   `${userName}さん、何か疑問点があれば遠慮なくどうぞ。論理的かつ実践的に解説します。`,
    hotblood: `${userName}！聞きたいことがあったら遠慮なくドンドン来い！！熱く答えてやるぜ！！`,
    sage:     `フォッフォッフォ、${userName}よ、何でも聞くがよい。知恵を授けようぞ。`,
  };

  // 挨拶は system プロンプトに埋め込む。
  // Messages API は messages の先頭が必ず user ロールでなければ 400 を返すため、
  // 挨拶を assistant メッセージとして先頭に積むことはできない。
  const systemPrompt = `${baseSystemPrompt}

## この会話の状況
あなたはすでに${userName}へ次のように話しかけ終えています（この一言を再度繰り返さないこと）:
「${greetings[coach]}」
以降のやり取りは、この挨拶に${userName}が答えたところから続いています。`;

  // 先頭が user になるよう整形する（API の制約を満たすための保険）
  const messages = normalizeChatHistory(chatHistory);

  if (!anthropic || messages.length === 0) {
    return buildFallbackChatReply(chatHistory, coach, userName);
  }

  try {
    const response = await anthropic.messages.create({
      model: MODEL_ID,
      max_tokens: 800,
      system: systemPrompt,
      messages,
    });

    const text = extractText(response.content);
    const cleaned = stripMarkdownSymbols(text);
    return cleaned || 'うまく答えられんかった。もう一度聞いてみて！';
  } catch (err) {
    console.error('Coach Chat API Error:', err);
    return buildFallbackChatReply(chatHistory, coach, userName);
  }
}

// ──────────────────────────────────────────
// フォールバック（APIキー未設定時・エラー時）
// ──────────────────────────────────────────
function buildFallbackGradeResult(term: string, body: string, coach: CoachType = 'osaka', userName: string = 'あなた'): GradeResult {
  const isWakaran = body === '(わからん)';

  if (isWakaran) {
    const correctText = coach === 'osaka'
      ? `【正体と例え】「${term}」はな、ざっくり言うたらプログラムやWebを正しくスムーズに動かすための【専門の道具・ルール】のことや！\n日常で言うたら「お決まりの連絡網」や「専用の窓口」みたいなもんやで。\n【仕組み】これがあるおかげで、エラーを防いで安全にデータをやり取りできるんや。\n【覚え方】声に出してリズムで覚えるのが一番効くで！\nこれでイメージ湧いたか、${userName}？ちょっとでも分からんかったら下のチャットでなんでも聞いてや！`
      : `【基本概念】「${term}」はシステムやWebアプリケーションを正しく安全に動かすための重要な構成要素です。\n身近な例で言うと「専用の受付窓口」のような役割を果たしています。\n${userName}さん、少しでも疑問点があれば、下のチャットでお気軽にご質問ください！`;

    return {
      score: 15,
      tsukkomi: coach === 'osaka'
        ? `${userName}、「わからん」って正直に言えたの、それだけで百点満点のスタートや！忘れたもんはしゃーない、今すぐ頭に焼き付けよ！`
        : `${userName}さん、正直に「わからない」と言えたのが一番の成長のチャンスです！一緒にマスターしましょう。`,
      correct: correctText,
      missed: [term, '仕組み'],
      mission: `スマホのブラウザで解説の中に出てきた覚え方のフレーズを声に出して1回呟いてみるか、下のチャットで「${term}」の別の例えを聞いてみよう！`,
      related: [],
    };
  }

  const correctText = coach === 'osaka'
    ? `【正体と例え】「${term}」はな、Web開発やシステムでよく使われる【便利な道具箱・お決まりの仕組み】のことや！\n日常で言うたら「作業を一瞬で終わらせるショートカットキー」みたいなもんやで。\n【仕組み】単に名前を知るだけやなくて「なぜこれが必要か」「使うと何が嬉しいか」を押さえておくと、実戦でグッと応用が効くようになるんや！\n【覚え方】声に出して特徴的なキーワードと一緒に頭に叩き込むのがコツやで！\nこれで分かったか、${userName}？「ほなこれってコードのどこに書くん？」とか疑問があったら下のチャットで何でも聞いてや！`
    : `【基本概念】「${term}」は開発を効率化し、システムを安定して動かすための重要な仕組みです。\n「なぜそれを使うのか」「どのようなメリットがあるのか」を意識して押さえておくと、実務で大いに役立ちます。\n${userName}さん、ご不明な点があれば、下のチャットにて何なりとお尋ねください。`;

  return {
    score: 75,
    tsukkomi: coach === 'osaka'
      ? `おっ、${userName}！ええ線いっとるやん！コアな部分は捉えとるから、あとは「なぜそれを使うんか」まで言えたら完璧やったな！`
      : `${userName}さん、良い着眼点です！基本概念は掴めているので、さらに「メリットや背景」まで言語化できると完璧です。`,
    correct: correctText,
    missed: [term, '本質', 'メリット'],
    mission: `解説の中に出てきた覚え方のポイントを声に出して1回言ってみるか、下のチャットでコーチに「実務ではどう使う？」と聞いてみよう！`,
    related: [],
  };
}

function buildFallbackChatReply(chatHistory: ChatMessage[], coach: CoachType = 'osaka', userName: string = 'あなた'): string {
  const lastQuestion = chatHistory[chatHistory.length - 1]?.content || '';
  if (coach === 'osaka') {
    return `ええ質問やん、${userName}！「${lastQuestion.slice(0, 20)}」についてやな。ざっくり言うと、開発をスムーズにしてバグを防ぐための仕組みやで。もっと詳しく聞きたいとこあったら言うてな！`;
  }
  return `${userName}さん、ご質問ありがとうございます。「${lastQuestion.slice(0, 20)}」についてですね。これはシステムを安定させ、開発を効率化するための重要な概念です。気になる点があればさらに詳しくお聞きください。`;
}

// ──────────────────────────────────────────
// 用語自動抽出（ファイルインポート機能用）
// ──────────────────────────────────────────

/**
 * 用語抽出の合否判定基準。テキスト用・画像用の両プロンプトで共有する。
 *
 * 以前の基準はネットワーク講義を想定した例（IPアドレス／宅配便）に寄っており、
 * 実際に多発していた失敗パターン——講義中の言い回し・章タイトル・行動フレーズを
 * 用語として拾ってしまう——を防げていなかった。
 * その結果「図解」「ワーク」「仕上げ」「面倒の正体」「完成形の絵から作る」
 * 「進捗可視化ツール」のようなものが大量に登録され、復習キューが膨れ上がっていた。
 *
 * 判定の軸は「その講義を知らない人にも通じる、名前のついた概念・技術か」の一点。
 */
const EXTRACT_CRITERIA = `## 抽出の判定基準（最重要）

用語を1つ選ぶたびに、次の【単独テスト】を必ず通すこと。

> **単独テスト**: その言葉だけを、この教材を読んでいない同僚に見せたとき、
> 「ああ、あれね」と共通の意味が通じるか？

通じるなら抽出してよい。通じないなら、どれだけ教材内で強調されていても抽出しない。

### ⭕ 抽出してよいもの
- 名前のついた技術・ツール・仕様（例: GitHub Actions、YAML形式、APIキー、Docker）
- 名前のついた概念・原則・手法（例: SSoTの原則、Human in the Loop、冪等性、正規化）
- 分野の専門用語（例: プロンプト、ソフトマックス、カットオフ、認知コスト）
- 英略語とその正式名称（例: API、CI/CD、LLM）

### ❌ 抽出してはいけないもの
- **講義中の言い回し・章タイトル・キャッチフレーズ**
  （例: 「面倒の正体」「武器を作る」「ワーク」「仕上げ」「結論」「まとめ」）
- **行動やコツを表す動詞フレーズ**
  （例: 「完成形の絵から作る」「型にはめる」「まず動くものを作る」「分解して考える」）
- **一般的な日本語・複合語**
  （例: 「図解」「効率化」「処理する場所」「送信側」「データ管理」「課題解決」）
- **教材独自の造語や、その場限りの分類名**
  （例: 講師が説明のためにその場で付けた呼び名、「Rule 6」のような教材内の通し番号）
- **総称的なツールのカテゴリ名**
  （例: 「進捗可視化ツール」「デイリーレポートツール」「動画編集効率化ツール」）
  ※ ただし固有名詞のプロダクト名（例: Slack、Cursor、Figma）は、それ自体が
  　 主題として解説されている場合に限り可。単に登場しただけなら除外。
- **理解を助けるための例え話・比喩**
  （例: 宅配便、ポスト投函、レストランの厨房）
- **前提知識として背景に出ただけの単語**（主役として解説されていないもの）

### 迷ったときの原則
**迷ったら抽出しない。** これは毎日の復習キューに入る。
数を埋めることより、1件も無駄を混ぜないことの方がはるかに重要。`;

export interface TermAudit {
  /** 対象の用語ID（terms.id） */
  id: string;
  /** 復習用語として残す価値があるか */
  keep: boolean;
  /** keep=false のときの理由（15字以内） */
  reason: string;
}

/**
 * 既に登録済みの用語を、抽出時と同じ基準で棚卸しする。
 *
 * 抽出プロンプトを厳しくしても既存の登録分は減らないため、
 * 登録済みの用語を後から同じものさしで判定できるようにする。
 * 判定するだけで削除はしない（何を消すかは必ずユーザーが決める）。
 */
export async function auditTerms(
  terms: { id: string; term: string; note: string; tag?: string }[]
): Promise<TermAudit[]> {
  if (terms.length === 0) return [];

  const list = terms
    .map((t) => `- id: ${t.id}\n  用語: ${t.term}\n  メモ: ${t.note || '(なし)'}`)
    .join('\n');

  const prompt = `あなたは学習設計の専門家です。
ある学習者の復習アプリに登録されている用語リストを棚卸しします。

各用語について、「繰り返し復習して定着させる価値があるか」を判定してください。
判定は下記の基準に厳密に従ってください。

${EXTRACT_CRITERIA}

## 判定のしかた
- 基準の「⭕ 抽出してよいもの」に当てはまる → keep: true
- 基準の「❌ 抽出してはいけないもの」に当てはまる → keep: false
- keep: false の場合、reason に理由を15字以内で簡潔に書く
  （例: 「講義の言い回し」「一般的な日本語」「行動フレーズ」「ツールの総称」）
- keep: true の場合、reason は空文字 "" にする

判断に迷った場合は keep: true にしてください（誤って消す方が害が大きいため）。

## 出力形式
入力された全ての用語について、JSON配列のみを出力してください。
idは入力されたものをそのまま正確に転記すること。

[
  {"id": "入力されたid", "keep": true, "reason": ""},
  {"id": "入力されたid", "keep": false, "reason": "講義の言い回し"}
]

## 棚卸し対象の用語リスト（全${terms.length}件）
${list}`;

  if (!anthropic) {
    // APIキー未設定時は「全部残す」に倒す。判定できないことを理由に
    // 用語が消える方向へ倒れてはいけない。
    return terms.map((t) => ({ id: t.id, keep: true, reason: '' }));
  }

  const response = await anthropic.messages.create({
    model: MODEL_ID,
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  if (response.stop_reason === 'max_tokens') {
    throw new Error('判定結果が長すぎて途中で切れました。対象を分割して再試行してください。');
  }

  const parsed = safeParseJson<unknown>(extractText(response.content) || '[]');
  if (!Array.isArray(parsed)) {
    console.error('Audit response was not a JSON array.');
    throw new Error('判定結果を読み取れませんでした。もう一度試してください。');
  }

  const byId = new Map<string, TermAudit>();
  for (const row of parsed) {
    if (!row || typeof row !== 'object') continue;
    const r = row as { id?: unknown; keep?: unknown; reason?: unknown };
    const id = String(r.id ?? '');
    if (!id) continue;
    byId.set(id, {
      id,
      keep: r.keep !== false, // 明示的に false のときだけ削除候補
      reason: stripMarkdownSymbols(String(r.reason ?? '')).slice(0, 30),
    });
  }

  // 応答から漏れた用語は「残す」に倒す
  return terms.map((t) => byId.get(t.id) ?? { id: t.id, keep: true, reason: '' });
}

export interface ExtractedTerm {
  term: string;
  note: string;
}

export interface ExtractionResult {
  /** 推定された教材・分野の正式タイトル（例: "Webアプリの攻撃と防御", "インターネットの仕組み"） */
  category: string;
  /** 抽出された用語一覧 */
  terms: ExtractedTerm[];
}

/**
 * 講義文字起こし・スライド・教材HTMLなどのテキストから復習すべき最重要用語と、
 * 教材全体の分野・シリーズ名（カテゴリ）を自動抽出する。
 * existingCategories が渡された場合は、既存タグとのスマート名寄せを行う。
 */
export async function extractTermsFromText(
  text: string,
  source: string,
  existingCategories: string[] = []
): Promise<ExtractionResult> {
  const MAX_CHARS = 120000;
  const truncated =
    text.length > MAX_CHARS ? text.slice(0, MAX_CHARS) + '\n\n[... 以降は省略 ...]' : text;

  const existingListStr =
    existingCategories.length > 0
      ? `## 既存の分野・タグ一覧（スマート名寄せ用）
学習者がすでに登録している分野一覧です:
${existingCategories.map((c) => `- ${c}`).join('\n')}

**【重要: 既存分野への名寄せルール】**
もし今回の教材が、上記既存分野のいずれかのレッスン・続き・関連内容である場合は、新しく別の名前を付けずに**上記の一覧から最も適切な名前をそのまま "category" に指定してください**（例: 既存に「Webアプリの攻撃と防御」があり、今回の教材が「コース2 レッスン3」なら、新しいタグを作らず「Webアプリの攻撃と防御」にする）。
どれにも当てはまらない全く新しいテーマの場合のみ、新しい適切な日本語分野名を作成してください。`
      : '';

  const prompt = `あなたは教育・学習設計の最高責任者（チーフコーチ）です。
以下のテキストは「${source}」からの教材・講義テキストです（HTML教材、講義文字起こし、スライド、メモ等）。

この教材を分析し、次の2点を行ってください：
1. **【教材全体の日本語分野名・シリーズ名（category）の特定】**:
   - 教材のタイトル（<title>や<h1>、ヘッダー「○○｜コースX」など）や内容から、この教材全体の自然で分かりやすい日本語タイトル（10〜25文字程度、例: 『Webアプリの攻撃と防御』『インターネットの仕組み』『React基礎』など）を1つ特定してください。ファイル名がローマ字（web-kougeki等）であっても、本文中の正しい日本語名を特定してください。
2. **【復習すべき重要用語（terms）の厳選抽出】**:
   - 受講者が繰り返し復習して定着させる価値のある、名前のついた概念・技術を厳選して抽出してください。

${existingListStr}

## 抽出する個数について（重要）
**固定の上限はありません。教材の分量と密度に応じて決めてください。**
- 1つのレッスン・章・節あたり **0〜5個** を目安にする
- 複数のレッスンが1ファイルにまとまっている場合は、**レッスンごとに数え直す**
- 基準を満たす用語が無ければ terms は空配列 [] が正解

${EXTRACT_CRITERIA}

## note の作り方（重要！）
note は「受講者が思い出すための文脈ヒント」のみを30字以内で書くこと（答えのネタバレ禁止）。

## 出力形式
必ず以下のキーを持つJSONオブジェクト**だけ**を出力してください。前置きや\`\`\`等のマークダウンは一切不要。

{
  "category": "教材の日本語分野名（例: Webアプリの攻撃と防御）",
  "terms": [
    {"term": "抽出した用語", "note": "文脈ヒント（30字以内）"}
  ]
}

## 教材テキスト
${truncated}`;

  const defaultCategory = source.replace(/\.[^/.]+$/, '').replace(/[_\-]/g, ' ').trim();

  if (!anthropic) {
    return {
      category: 'Web開発・セキュリティ実践',
      terms: [
        { term: 'サンプル用語1', note: `${source} から抽出（APIキー未設定のためデモ）` },
        { term: 'サンプル用語2', note: `${source} から抽出（APIキー未設定のためデモ）` },
      ],
    };
  }

  const response = await anthropic.messages.create({
    model: MODEL_ID,
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });

  if (response.stop_reason === 'max_tokens') {
    console.error('Extract response was truncated at max_tokens.');
  }

  return parseExtractionResult(extractText(response.content), defaultCategory);
}

/**
 * 抽出結果のJSON（{ category, terms } または [ ... ]）を安全に取り出す。
 */
function parseExtractionResult(rawText: string, defaultCategory: string): ExtractionResult {
  const parsed = safeParseJson<any>(rawText || '{}');

  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Array.isArray(parsed.terms)) {
    const rawCategory = typeof parsed.category === 'string' ? parsed.category.trim() : '';
    const terms: ExtractedTerm[] = parsed.terms
      .filter((t: any) => Boolean(t) && typeof t === 'object')
      .map((t: any) => ({
        term: stripMarkdownSymbols(String(t.term ?? '')),
        note: stripMarkdownSymbols(String(t.note ?? '')),
      }))
      .filter((t: ExtractedTerm) => t.term.length > 0);

    return {
      category: stripMarkdownSymbols(rawCategory) || defaultCategory,
      terms,
    };
  }

  // 旧形式（配列直接）のフォールバック
  if (Array.isArray(parsed)) {
    const terms: ExtractedTerm[] = parsed
      .filter((t: any) => Boolean(t) && typeof t === 'object')
      .map((t: any) => ({
        term: stripMarkdownSymbols(String(t.term ?? '')),
        note: stripMarkdownSymbols(String(t.note ?? '')),
      }))
      .filter((t: ExtractedTerm) => t.term.length > 0);

    return {
      category: defaultCategory,
      terms,
    };
  }

  console.error('Extract response was not valid JSON. Raw text:', rawText);
  return { category: defaultCategory, terms: [] };
}

/**
 * 画像（PNG/JPG/JPEG/WEBP）から Claude Vision API で用語と分野名を直接抽出する。
 */
export async function extractTermsFromImage(
  imageBase64: string,
  mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
  source: string,
  existingCategories: string[] = []
): Promise<ExtractionResult> {
  const existingListStr =
    existingCategories.length > 0
      ? `## 既存の分野・タグ一覧:
${existingCategories.map((c) => `- ${c}`).join('\n')}
もし画像の内容が上記既存分野のいずれかに当てはまる場合は、その分野名をそのまま category に使用してください。`
      : '';

  const textPrompt = `あなたは教育・学習設計の最高責任者（チーフコーチ）です。
この画像は「${source}」からのスライド・図解・板書です。

画像に含まれるテキストや図から：
1. **【スライド全体の日本語分野名・シリーズ名（category）】**（例: Webアプリの攻撃と防御、React基礎など）
2. **【復習すべき重要用語（terms）】**（1枚あたり0〜5個目安）
を抽出してください。

${existingListStr}
${EXTRACT_CRITERIA}

## 出力形式
JSONオブジェクトのみを出力してください。

{
  "category": "日本語の分野名",
  "terms": [
    {"term": "抽出した用語", "note": "文脈ヒント（30字以内）"}
  ]
}`;

  const defaultCategory = source.replace(/\.[^/.]+$/, '').replace(/[_\-]/g, ' ').trim();

  if (!anthropic) {
    return {
      category: 'スライド学習',
      terms: [{ term: 'サンプル用語（画像）', note: `${source} から抽出（APIキー未設定のためデモ）` }],
    };
  }

  const response = await anthropic.messages.create({
    model: MODEL_ID,
    max_tokens: 2000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: textPrompt,
          },
        ],
      },
    ],
  });

  return parseExtractionResult(extractText(response.content), defaultCategory);
}

// ──────────────────────────────────────────
// 特急・4択問題生成（スキマ時間復習用）
// ──────────────────────────────────────────

export interface MultipleChoiceOption {
  text: string;
  isCorrect: boolean;
  explanation: string;
}

export interface MultipleChoiceQuiz {
  question: string;
  choices: MultipleChoiceOption[];
  coachPrompt: string;
}

function buildMultipleChoicePrompt(
  term: string,
  note: string,
  coach: CoachType = 'osaka',
  userName: string = 'あなた'
): string {
  const persona = getCoachPersona(coach);
  return `あなたは「覚える君」アプリの学習コーチです。
生徒の名前は【${userName}】です。
生徒が出先やスキマ時間でもサクッと復習できるように、用語「${term}」に関する【高品質な4択クイズ（1問）】を作成してください。

## あなたのキャラクター設定（必ずこの通りに振る舞うこと）
${persona}

## 呼称のルール
- 「生徒さん」「ユーザー」は禁止。必ず【${userName}】と直接呼びかけること。

## クイズ作成の極意（最重要！）
1. **正解の選択肢（1つ）**:
   - 用語の本質・定義・何のためのものかが、初学者にも分かりやすく正確に書かれていること。
2. **ダミーの選択肢（3つ）**:
   - **単なるデタラメではなく、実務や学習で「初心者が混同・勘違いしやすい別の関連技術や概念」**を混ぜること（例: 認証なら「認可」や「暗号化」、SSRなら「SSG」や「SPA」、propsなら「state」など）。
   - これにより、選択肢を読むだけで他の周辺知識の整理にもなる。
3. **各選択肢の解説（explanation）**:
   - 正解には「なぜそれが正解か」、不正解には「これは実は〇〇のことやで！」と、1〜2文であなたのキャラクター口調でツッコミ・解説をつけること。
4. **選択肢の並び順**:
   - 4つの選択肢（choices）はランダムに並べてください（1番目だけが正解にならないように）。正解（isCorrect: true）は必ず1つだけにしてください。

## 対象用語
用語: ${term}
文脈ヒント: ${note || 'なし'}

## 出力形式
必ず以下のキーを持つJSONオブジェクト**だけ**を出力してください。前置きや\`\`\`等のマークダウンは一切不要。

{
  "question": "あなたのキャラクターの口調で問いかける問題文（例: 『${userName}！「${term}」の説明として一番ピッタリなんはどれや？』）",
  "coachPrompt": "出題時の短い一言（例: 『迷わず直感で選んでみ！』『スキマ時間でサクッといくで！』）",
  "choices": [
    {
      "text": "選択肢1の文章（20〜40文字程度で簡潔に）",
      "isCorrect": true または false,
      "explanation": "あなたのキャラクター口調での一言解説（1〜2文）"
    },
    {
      "text": "選択肢2の文章",
      "isCorrect": true または false,
      "explanation": "あなたのキャラクター口調での一言解説"
    },
    {
      "text": "選択肢3の文章",
      "isCorrect": true または false,
      "explanation": "あなたのキャラクター口調での一言解説"
    },
    {
      "text": "選択肢4の文章",
      "isCorrect": true または false,
      "explanation": "あなたのキャラクター口調での一言解説"
    }
  ]
}`;
}

export async function generateMultipleChoiceQuiz(
  term: string,
  note: string = '',
  coach: CoachType = 'osaka',
  userName: string = 'あなた'
): Promise<MultipleChoiceQuiz> {
  const prompt = buildMultipleChoicePrompt(term, note, coach, userName);

  if (!anthropic) {
    return buildFallbackMultipleChoiceQuiz(term, coach, userName);
  }

  try {
    const response = await anthropic.messages.create({
      model: MODEL_ID,
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = extractText(response.content);
    const parsed = safeParseJson<MultipleChoiceQuiz>(text);

    if (
      parsed &&
      typeof parsed.question === 'string' &&
      Array.isArray(parsed.choices) &&
      parsed.choices.length === 4 &&
      parsed.choices.filter((c) => c.isCorrect).length === 1
    ) {
      return {
        question: stripMarkdownSymbols(parsed.question),
        coachPrompt: stripMarkdownSymbols(parsed.coachPrompt || 'サクッと選んでみて！'),
        choices: parsed.choices.map((c) => ({
          text: stripMarkdownSymbols(c.text),
          isCorrect: Boolean(c.isCorrect),
          explanation: stripMarkdownSymbols(c.explanation),
        })),
      };
    }

    console.warn('generateMultipleChoiceQuiz: Invalid JSON structure, using fallback. Raw text:', text);
    return buildFallbackMultipleChoiceQuiz(term, coach, userName);
  } catch (err) {
    console.error('generateMultipleChoiceQuiz API error:', err);
    return buildFallbackMultipleChoiceQuiz(term, coach, userName);
  }
}

function buildFallbackMultipleChoiceQuiz(
  term: string,
  coach: CoachType = 'osaka',
  userName: string = 'あなた'
): MultipleChoiceQuiz {
  const isOsaka = coach === 'osaka';
  return {
    question: isOsaka
      ? `${userName}！「${term}」の説明として一番合っとるんはどれや？`
      : `${userName}さん、「${term}」の説明として最も適切なものを選択してください。`,
    coachPrompt: isOsaka ? 'サクッと直感で選んでみ！' : '直感で選んでみましょう！',
    choices: [
      {
        text: `システムやWebを安全・円滑に動かすための専用の仕組み・定義`,
        isCorrect: true,
        explanation: isOsaka ? `正解！これが「${term}」の本質やで！バッチリや！` : `正解です！これが「${term}」の正しい定義です。`,
      },
      {
        text: `データベースのレコードを一括更新する処理`,
        isCorrect: false,
        explanation: isOsaka ? `それはDBのバッチ処理やトランザクションのことやな！` : `それはデータベースの一括更新処理の説明です。`,
      },
      {
        text: `サーバーと端末間の通信を丸ごと暗号化する技術`,
        isCorrect: false,
        explanation: isOsaka ? `それはSSL/TLS（暗号化通信）のことやで！` : `それは暗号化通信（SSL/TLS）の説明です。`,
      },
      {
        text: `画面の見た目を整えるためのデザインスタイルシート`,
        isCorrect: false,
        explanation: isOsaka ? `それはCSS（スタイルシート）やな！` : `それはCSS（スタイルシート）の説明です。`,
      },
    ],
  };
}

