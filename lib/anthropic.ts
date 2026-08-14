import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.ANTHROPIC_API_KEY;

export const anthropic = apiKey ? new Anthropic({ apiKey }) : null;

// アプリ裏側で叩くAnthropic APIモデル。最新爆速の Claude Haiku 4.5 を指定（1〜2秒で即レス）
const MODEL_ID = 'claude-haiku-4-5-20251001';

// ──────────────────────────────────────────
// コーチキャラクター定義
// ──────────────────────────────────────────
export type CoachType = 'osaka' | 'praise' | 'mentor' | 'hotblood' | 'sage';

export const COACH_LIST: { id: CoachType; icon: string; name: string; description: string }[] = [
  { id: 'osaka',    icon: '👦', name: '大阪の兄ちゃん',   description: '笑いながら背中を押すツッコミ系' },
  { id: 'praise',   icon: '🌸', name: '褒め上手な先輩',   description: '全肯定で優しく応援してくれる' },
  { id: 'mentor',   icon: '👔', name: 'スマートメンター', description: 'ロジカル＆知的な標準語解説' },
  { id: 'hotblood', icon: '🔥', name: '熱血コーチ',       description: 'ガツンと喝！燃え上がるやる気' },
  { id: 'sage',     icon: '🧙', name: '知識の賢者',       description: '穏やかで深みのある哲学的解説' },
];

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

// 前置きテキスト（「わかりました！」等）が入っていても、最初の { / [ から 最後の } / ] までを安全に抽出する関数
function cleanJsonText(rawText: string): string {
  const textWithoutCodeBlocks = rawText.replace(/```json|```/g, '').trim();
  // 最も外側の { ... } または [ ... ] を検索
  const jsonMatch = textWithoutCodeBlocks.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  return jsonMatch ? jsonMatch[0].trim() : textWithoutCodeBlocks;
}

export interface GradeResult {
  score: number;
  tsukkomi: string;
  correct: string;
  missed: string[];
  mission: string;
}

// ──────────────────────────────────────────
// 採点プロンプト
// ──────────────────────────────────────────
function buildGradePrompt(term: string, note: string, body: string, coach: CoachType = 'osaka'): string {
  const persona = getCoachPersona(coach);
  return `あなたは「覚える君」アプリの学習コーチです。
生徒はWeb開発、プログラミング、AI、資格、ビジネスなどの知識を学んでいる学習者です。
生徒が用語について自分の言葉で説明した内容を採点し、キャラクターらしく的確で愛のあるフィードバックを行ってください。

## あなたのキャラクター設定（必ずこの通りに振る舞うこと）
${persona}

## 重要な文章ルール
- アスタリスク記号（**）などのマークダウン記号は絶対に使わないこと。強調したい場合は【】や『』などの日本語記号を使うこと。
- 【語源・正式名称と頭文字の完全解説】: 
  1. 用語が英単語や略語（例: props, SSR, API, JSX, useState 等）の場合、**必ず『何の英単語の略か・元の英語の意味』を冒頭で明記すること（例: propsは properties＝属性・特徴・小道具 の略）**。
  2. 頭文字を使った語呂合わせや暗記フレーズを提案する時は、**『それぞれのアルファベットが元のどの単語から来ているのか』を絶対に省略せず、1文字ずつ明記して解説すること（例: JSXなら『J = JavaScript, S = Syntax(構文), X = XML(タグ拡張)』など）**。
- 【企業名・製品名・最新モデルの正確性】:
  1. 企業名と製品名の組み合わせを絶対に間違えないこと（例: Claude は Anthropic社、ChatGPT/GPT-4o は OpenAI社、Gemini は Google社）。『ClaudeをOpenAIのサイトで検索する』等のチグハグな指示は絶対に禁止。
  2. AIモデルを例に出す場合は、古い世代（初代GPT-4無印等）ではなく、現在主流の最新モデル（Gemini 3.7, Claude Sonnet / Opus, GPT-4o 等）を基準に正確に言及すること。

## 採点対象
用語: ${term}
生徒のヒント（どこで出た用語か）: ${note || 'なし'}
生徒が自分の言葉で説明した内容: ${body}

## 採点基準（0〜100点）
- **90〜100点（極上）**: 「なぜ必要か（Why）」「どう動くか（How）」「使うと何が嬉しいか（Benefit）」まで自分の言葉で的確に言語化できている。
- **80〜89点（合格）**: 用語の本質・コア概念がしっかり押さえられている。
- **60〜79点（惜しい・表層的）**: キーワードの羅列や表面的な使い方・名前の直訳のみ。「なぜ必要か」「本質的な仕組み」が少し不足。
- **30〜59点（勘違い・混同）**: 別の似た概念と混同している（例: propsとstateの混同、SSRとSSGの混同）、または断片的な単語のみ。
- **0〜29点（わからん）**: 「わからん」「忘れた」、全く的外れ。

## 出力形式
下の JSON **だけ** を返すこと。前置き・説明・マークダウン記号（\`\`\`等）は一切不要。

{
  "score": 0〜100の整数,
  "tsukkomi": "あなたのキャラクターらしい愛のある一言コメント（1〜2文）。生徒の回答内容を具体的に拾い（『○○って言えたのは素晴らしい！けど△△が惜しかったな！』等）、上記のスコア帯に応じた温度感で突っ込む",
  "correct": "【語源・正式名称】＋【日常の例え】＋【本質の仕組み】＋【身近な実例】＋【一生忘れない覚え方】の充実構成で、初学者でも一発で腑に落ちるようにあなたのキャラクターの口調で丁寧に解説（5〜8文程度）。アスタリスク(**)は絶対使わない。\n1.【正式名称・語源】略語や英語なら何の単語の略か・元の意味をハッキリ説明（例:『propsは properties（プロパティ＝属性・特徴・小道具）の略やで！』）\n2.【日常の例え】「ざっくり言うと○○みたいなもんや」という日常の例え（料理・コンビニ・引っ越し・日常生活など）\n3.【本質の仕組み】専門用語を即座にかみ砕いた言い換え付きで技術・概念の本当の仕組みを解説\n4.【身近な実例】Amazon, X (Twitter), YouTube, Google など誰もが知る有名サービスや日常での具体例\n5.【一生忘れない覚え方】頭文字のアルファベットの由来も省略せず丁寧に明記した、クスッと笑えて納得できる暗記フックの提案",
  "missed": ["生徒の説明に足りなかった重要キーワードを最大3つ。生徒が既に言えていた言葉は絶対に含めない。生徒が(わからん)の場合は用語の核となるキーワードを入れる"],
  "mission": "今すぐ30秒〜3分で手を動かして実感できる超具体的なミニ課題を1つ。『VS Codeを開いて○○を検索する』『ターミナルで○○を叩く』『ブラウザでGoogle検索して○○を調べる』など、何をどこでやるか（企業と製品の対応も正確に）まで指定する。抽象的な『調べてみよう』は禁止"
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
  coach: CoachType = 'osaka'
): string {
  const persona = getCoachPersona(coach);
  return `あなたは「覚える君」アプリの学習コーチです。いま生徒と「${term}」の復習が終わったところです。
生徒が復習結果を読んだ後、さらに理解を深めるために質問やリクエストをしてきます。
あなたのキャラクター設定を守りながら、最高にわかりやすく親身に回答してください。

## あなたのキャラクター設定（必ずこの通りに振る舞うこと）
${persona}

## 直前の復習コンテキスト
- 用語: ${term}
- 生徒のヒント: ${note || 'なし'}
- 生徒の説明: ${userAnswer.trim() || '(わからん)'}
- 正しい説明: ${correctText}
- 出したミッション: ${missionText}

## 質問パターンに応じた神対応ガイドライン
- 「もっと簡単に」「小学生でもわかるように」➔ 日常の例えを極限までシンプルに噛み砕いて説明する。
- 「別の例えで」「料理で例えて」➔ 指定されたテーマや別の身近な日常シーン（スポーツ、学校、買い物等）で新しく例える。
- 「実務ではどう使う？」「現場でどう役立つ？」➔ 現場のシチュエーションやトラブル事例、使わないとどう困るかを交えて解説する。
- 「語呂合わせもう1個ちょうだい」「頭文字の意味は？」➔ 各文字が何の英単語から取られているかを省略せず丁寧に解説し、クスッと笑える暗記フレーズを提案する。
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

export async function gradeAnswer(
  term: string,
  note: string,
  userAnswer: string,
  coach: CoachType = 'osaka'
): Promise<GradeResult> {
  const body = userAnswer.trim() || '(わからん)';
  const prompt = buildGradePrompt(term, note, body, coach);

  if (!anthropic) {
    return buildFallbackGradeResult(term, body, coach);
  }

  try {
    const response = await anthropic.messages.create({
      model: MODEL_ID,
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = extractText(response.content);
    const jsonString = cleanJsonText(text);
    const parsed = JSON.parse(jsonString) as GradeResult;

    // ** 記号を綺麗に除去して安全に返却
    return {
      score: Math.min(100, Math.max(0, Number(parsed.score) || 0)),
      tsukkomi: stripMarkdownSymbols(parsed.tsukkomi || ''),
      correct: stripMarkdownSymbols(parsed.correct || ''),
      missed: Array.isArray(parsed.missed) ? parsed.missed.map((m) => stripMarkdownSymbols(m)) : [],
      mission: stripMarkdownSymbols(parsed.mission || ''),
    };
  } catch (err) {
    console.error('API or JSON Parse error, fallback activated:', err);
    return buildFallbackGradeResult(term, body, coach);
  }
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function askCoachChat(
  term: string,
  note: string,
  userAnswer: string,
  correctText: string,
  missionText: string,
  chatHistory: ChatMessage[],
  coach: CoachType = 'osaka'
): Promise<string> {
  const systemPrompt = buildChatSystemPrompt(term, note, userAnswer, correctText, missionText, coach);
  
  // コーチ別の初期挨拶セリフ
  const greetings: Record<CoachType, string> = {
    osaka:    'ほな、なんでも聞いてや！例え話でも実務の話でもなんでも答えるで！',
    praise:   'なんでも聞いてね！一緒に楽しく理解を深めよう✨',
    mentor:   '何か疑問点があれば遠慮なくどうぞ。論理的かつ実践的に解説します。',
    hotblood: '聞きたいことがあったら遠慮なくドンドン来い！！熱く答えてやるぜ！！',
    sage:     'フォッフォッフォ、何でも聞くがよい。知恵を授けようぞ。',
  };

  if (!anthropic) {
    return buildFallbackChatReply(chatHistory, coach);
  }

  try {
    const response = await anthropic.messages.create({
      model: MODEL_ID,
      max_tokens: 800,
      system: systemPrompt,
      messages: [
        { role: 'assistant', content: greetings[coach] },
        ...chatHistory,
      ],
    });

    const text = extractText(response.content);
    const cleaned = stripMarkdownSymbols(text);
    return cleaned || 'うまく答えられんかった。もう一度聞いてみて！';
  } catch (err) {
    console.error('Coach Chat API Error:', err);
    return buildFallbackChatReply(chatHistory, coach);
  }
}

// ──────────────────────────────────────────
// フォールバック（APIキー未設定時・エラー時）
// ──────────────────────────────────────────
function buildFallbackGradeResult(term: string, body: string, coach: CoachType = 'osaka'): GradeResult {
  const isWakaran = body === '(わからん)';

  if (isWakaran) {
    return {
      score: 15,
      tsukkomi: coach === 'osaka'
        ? '「わからん」って正直に言えたの、それだけで百点満点のスタートや！忘れたもんはしゃーない、今すぐ頭に焼き付けよ！'
        : '正直に「わからない」と言えたのが一番の成長のチャンスです！一緒にマスターしましょう。',
      correct: `【例え話】ざっくり言うと「${term}」は、日常で言う「専門の担当窓口」や「お決まりのルール」のようなものです。\n【本質の仕組み】コードやシステムを正しく安全に動かすための重要な仕組みです。\n【身近な実例】身近な例で言うと、AmazonのカートやXのタイムラインの更新でも裏側でこうした仕組みが活躍しています。\n【語呂合わせ】頭文字を意識して、口に出してリズムで覚えると忘れません！`,
      missed: [term, '仕組み'],
      mission: `VS Codeで Cmd+Shift+F（全体検索）を押して「${term}」を検索してみよう！プロジェクト内のどこで使われているか1箇所見つけるだけでOK！`,
    };
  }

  return {
    score: 75,
    tsukkomi: coach === 'osaka'
      ? 'おっ、ええ線いっとるやん！コアな部分は捉えとるから、あとは「なぜそれを使うんか」まで言えたら完璧やったな！'
      : '良い着眼点です！基本概念は掴めているので、さらに「メリットや背景」まで言語化できると完璧です。',
    correct: `【例え話】「${term}」は、日常で言う「便利なショートカットツール」のような役割を果たします。\n【本質の仕組み】単に使うだけでなく「なぜこれが必要か」「どう動くか」を押さえておくと応用がグッと効くようになります。\n【身近な実例】有名なWebサービスやスマホアプリでも、データの受け渡しや画面表示の高速化のために使われています。\n【語呂合わせ】声に出して特徴的なキーワードとセットで覚えるのがおすすめです！`,
    missed: [term, '本質', 'メリット'],
    mission: `VS Codeを開いて「${term}」が使われているファイルを1つ開き、その周辺のコードを声に出して読んでみよう！`,
  };
}

function buildFallbackChatReply(chatHistory: ChatMessage[], coach: CoachType = 'osaka'): string {
  const lastQuestion = chatHistory[chatHistory.length - 1]?.content || '';
  if (coach === 'osaka') {
    return `ええ質問やん！「${lastQuestion.slice(0, 20)}」についてやな。ざっくり言うと、開発をスムーズにしてバグを防ぐための仕組みやで。もっと詳しく聞きたいとこあったら言うてな！`;
  }
  return `ご質問ありがとうございます。「${lastQuestion.slice(0, 20)}」についてですね。これはシステムを安定させ、開発を効率化するための重要な概念です。気になる点があればさらに詳しくお聞きください。`;
}

// ──────────────────────────────────────────
// 用語自動抽出（ファイルインポート機能用）
// ──────────────────────────────────────────

export interface ExtractedTerm {
  term: string;
  note: string;
}

/**
 * 講義文字起こし・スライドなどのテキストから復習すべき用語を自動抽出する。
 * source は元ファイル名（コンテキスト参照用）。
 */
export async function extractTermsFromText(
  text: string,
  source: string
): Promise<ExtractedTerm[]> {
  // 1MB超えのテキストは先頭30000文字に切り詰める（API上限対策）
  const truncated = text.length > 30000 ? text.slice(0, 30000) + '\n\n[... 以降は省略 ...]' : text;

  const prompt = `あなたは知識・学習の専門家コーチです。
以下のテキストは「${source}」からのものです（資料、講義の文字起こし、スライド、メモ、本の一節など）。

このテキストを読んで、**学習者が繰り返し復習して覚えるべき真に重要な専門用語・キーワード・概念・コア比喩**を最大15個まで厳選して抽出してください。

## 抽出の厳格な基準（超重要！）
- ⭕ **積極抽出する対象**:
  1. IT・Web・プログラミング固有の用語・構文・技術名（例: props, useState, Next.js, Git, SSR, API, Supabase, コンポーネント 等）
  2. AI・LLM固有の概念・仕様（例: トークン, コンテキストウィンドウ, プロンプト, RAG, エージェント 等）
  3. 講義の核となる設計思想や重要なキーワード・比喩（例: 実行係, 頭脳と手足の役割分担 等）
- ❌ **絶対に抽出してはいけない対象（ノイズ除外）**:
  1. 単なる一般的な日本語の複合語（例: 「進捗可視化ツール」「作業効率化」「情報共有」「データ管理」「開発環境」「課題解決」「業務改善」など）
  2. 日本語としてそのまま意味が通じる日常語や一般的な説明文の一部
  3. 単なる日付、場所、挨拶、一般的な接続詞

## note の作り方（ここが最重要！）
note は「学習者が自分で思い出せるような文脈ヒント」のみを書くこと。
以下のルールを必ず守ること：
- ✅ 許可：「${source}の第○章で登場」「コンポーネント間の汎用性を説明する際に使った言葉」
- ✅ 許可：「学習の第○回に登場したキーワード」
- ❌ 禁止：用語の意味・定義・解説を note に書くこと（それは答えのネタバレになる）
- ❌ 禁止：「○○とは△△のこと」という形式の記述
- note は必ず30字以内で簡潔に。ファイル名を必ず含める。

## 出力形式
JSON配列だけを返してください。前置き・説明・マークダウン記号（\`\`\`等）は一切不要。

[
  {"term": "抽出した用語", "note": "登場した講義・場面・文脈のヒント（30字以内）"},
  ...
]

## テキスト
${truncated}`;

  if (!anthropic) {
    return [
      { term: 'サンプル用語1', note: `${source} から抽出（APIキー未設定のためデモ）` },
      { term: 'サンプル用語2', note: `${source} から抽出（APIキー未設定のためデモ）` },
    ];
  }

  const response = await anthropic.messages.create({
    model: MODEL_ID,
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const rawText = extractText(response.content) || '[]';
  const cleaned = rawText.replace(/```json|```/g, '').trim();

  return JSON.parse(cleaned) as ExtractedTerm[];
}

/**
 * 画像（PNG/JPG/JPEG/WEBP）から Claude Vision API で用語を直接抽出する。
 * imageBase64 は data URL なし の純粋な base64 文字列。
 * mediaType は 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp'。
 */
export async function extractTermsFromImage(
  imageBase64: string,
  mediaType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp',
  source: string
): Promise<ExtractedTerm[]> {
  const textPrompt = `あなたは知識・学習の専門家コーチです。
この画像は「${source}」からのものです（スライド、図解、ノート、ホワイトボード、書類などの写真/スクリーンショット）。

画像に含まれるテキストや図を読み取り、**学習者が繰り返し復習して覚えるべき真に重要な専門用語・キーワード・概念・コア比喩**を最大15個まで厳選して抽出してください。

## 抽出の厳格な基準（超重要！）
- ⭕ **積極抽出する対象**: IT/Web技術用語、AI概念、プログラミング構文、講義の核となる設計思想や重要なキーワード
- ❌ **絶対に抽出してはいけない対象（ノイズ除外）**: 単なる一般的な日本語の複合語（「進捗可視化ツール」「作業効率化」「情報共有」「データ管理」など）、単なる日常語、イラストの説明

## note の作り方（ここが最重要！）
note は「学習者が自分で思い出せるような文脈ヒント」のみを書くこと。
- ✅ 許可：「${source}の第○スライドで登場」「学習の第○回に登場したキーワード」
- ❌ 禁止：用語の意味・定義・解説を note に書くこと（それは答えのネタバレになる）
- ❌ 禁止：「○○とは△△のこと」という形式の記述
- note は必ず30字以内で簡潔に。ファイル名を必ず含める。

## 出力形式
JSON配列だけを返してください。前置き・説明・マークダウン記号（\`\`\`等）は一切不要。

[
  {"term": "抽出した用語", "note": "登場した講義・場面・文脈のヒント（30字以内）"},
  ...
]

画像に専門用語が含まれていない場合は空配列 [] を返してください。`;

  if (!anthropic) {
    return [
      { term: 'サンプル用語（画像）', note: `${source} から抽出（APIキー未設定のためデモ）` },
    ];
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

  const rawText = extractText(response.content) || '[]';
  const cleaned = rawText.replace(/```json|```/g, '').trim();

  return JSON.parse(cleaned) as ExtractedTerm[];
}
