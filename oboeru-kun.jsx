import React, { useState, useEffect } from "react";

const STORE_KEY = "oboeru-terms-v1";
const INTERVALS = [1, 3, 7, 14, 30];

const SEED = [
  { term: "useState", note: "kazu-dashboardのタスクリストで使った" },
  { term: "useEffect", note: "週間カレンダーの初期読み込みで使った" },
  { term: "props", note: "Reactコンポーネント間のデータ受け渡し" },
  { term: "SSR / SSG / ISR", note: "Next.jsのレンダリング戦略。第9回講義" },
  { term: "JSX", note: "HTMLっぽく書けるやつ" },
  { term: "commit / push", note: "Git。ローカルとGitHubの関係がややこしい" },
  { term: "function calling", note: "AIエージェント回。LLMが道具を呼ぶ仕組み" },
  { term: "コンテキストウィンドウ", note: "AIが一度に読める量" },
];

const today = () => new Date().toISOString().slice(0, 10);
const addDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export default function OboeruKun() {
  const [terms, setTerms] = useState(null);
  const [view, setView] = useState("home");
  const [current, setCurrent] = useState(null);
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [newTerm, setNewTerm] = useState("");
  const [newNote, setNewNote] = useState("");
  const [chat, setChat] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(STORE_KEY);
        setTerms(JSON.parse(r.value));
      } catch {
        const seeded = SEED.map((t, i) => ({
          id: `t${i}`,
          ...t,
          level: 0,
          next: today(),
          lastScore: null,
        }));
        setTerms(seeded);
        save(seeded);
      }
    })();
  }, []);

  const save = async (next) => {
    try {
      await window.storage.set(STORE_KEY, JSON.stringify(next));
    } catch {
      setError("保存できひんかった。もう一回試してみて。");
    }
  };

  const due = (terms || []).filter((t) => t.next <= today());

  const startQuiz = () => {
    if (due.length === 0) return;
    setCurrent(due[Math.floor(Math.random() * due.length)]);
    setAnswer("");
    setResult(null);
    setChat([]);
    setChatInput("");
    setError("");
    setView("quiz");
  };

  const grade = async () => {
    setLoading(true);
    setError("");
    const body = answer.trim() || "(わからん)";
    const prompt = `あなたは関西弁でツッコミを入れる学習コーチ「覚える君」。生徒はWeb開発を学び始めた社会人です。

用語: ${current.term}
生徒のメモ: ${current.note || "なし"}
生徒が自分の言葉で説明した内容: ${body}

採点して、下のJSONだけを返してください。前置き・説明・マークダウンの記号は一切つけないこと。

{
  "score": 0から100の整数,
  "tsukkomi": "関西弁のツッコミ、または褒め。1〜2文。間違いを馬鹿にせず、惜しいところを笑いに変える。人格は絶対に否定しない。「(わからん)」の場合は責めずに笑って引き上げる",
  "correct": "正しい説明を2〜3文。専門用語を使うときは必ずかみ砕く",
  "missed": ["説明に足りなかったキーワードを最大3つ"],
  "mission": "今すぐ30秒〜3分で手を動かせる具体的なミニ課題を1つ。エディタで実際に書く、コンソールで叩く、既存コードの該当行を探す等"
}`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [{ role: "user", content: prompt }],
        }),
      });
      const data = await res.json();
      const text = data.content
        .map((c) => (c.type === "text" ? c.text : ""))
        .join("");
      const parsed = JSON.parse(text.replace(/```json|```/g, "").trim());
      setResult(parsed);

      const lvl =
        parsed.score >= 80
          ? Math.min(current.level + 1, INTERVALS.length - 1)
          : parsed.score >= 50
          ? current.level
          : 0;
      const next = terms.map((t) =>
        t.id === current.id
          ? { ...t, level: lvl, next: addDays(INTERVALS[lvl]), lastScore: parsed.score }
          : t
      );
      setTerms(next);
      save(next);
      setView("result");
    } catch {
      setError("採点でコケた。もう一回「答える」を押してみて。");
    }
    setLoading(false);
  };

  const askChat = async (q) => {
    const question = (q || chatInput).trim();
    if (!question || chatLoading) return;
    const nextChat = [...chat, { role: "user", content: question }];
    setChat(nextChat);
    setChatInput("");
    setChatLoading(true);

    const context = `あなたは関西弁の学習コーチ「覚える君」。いま生徒と次の用語を復習し終えたところです。

用語: ${current.term}
生徒のメモ: ${current.note || "なし"}
生徒の説明: ${answer.trim() || "(わからん)"}
正しい説明: ${result.correct}
出したミッション: ${result.mission}

生徒はこのやりとりの中で出てきた言葉が分からなくて聞き返してきます。関西弁で、3文以内で、専門用語を使わずに答えてください。長々と説明しないこと。生徒のメモに出てくる固有名詞(自分で作ったツールの名前など)を聞かれたら、それは生徒自身が作ったものなので、断定せずに「たぶんこれのことちゃう？」と確認する形で答えること。`;

    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 1000,
          messages: [
            { role: "user", content: context },
            { role: "assistant", content: "ほな、なんでも聞いて。" },
            ...nextChat,
          ],
        }),
      });
      const data = await res.json();
      const text = data.content
        .map((c) => (c.type === "text" ? c.text : ""))
        .join("")
        .trim();
      setChat([...nextChat, { role: "assistant", content: text }]);
    } catch {
      setChat([
        ...nextChat,
        { role: "assistant", content: "ごめん、いま答えられへんかった。もっかい聞いて。" },
      ]);
    }
    setChatLoading(false);
  };

  const addTerm = () => {
    if (!newTerm.trim()) return;
    const next = [
      ...terms,
      {
        id: `t${Date.now()}`,
        term: newTerm.trim(),
        note: newNote.trim(),
        level: 0,
        next: today(),
        lastScore: null,
      },
    ];
    setTerms(next);
    save(next);
    setNewTerm("");
    setNewNote("");
    setView("home");
  };

  if (!terms) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#D9A441] text-[#1A1714] font-sans">
        読み込み中…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#D9A441] text-[#1A1714] font-sans px-4 py-10">
      <style>{`
        @keyframes thump {
          0% { transform: scale(1.9) rotate(-18deg); opacity: 0; }
          60% { transform: scale(0.92) rotate(-9deg); opacity: 1; }
          100% { transform: scale(1) rotate(-9deg); opacity: 1; }
        }
        .stamp { animation: thump .45s cubic-bezier(.2,.8,.3,1) both; }
        @media (prefers-reduced-motion: reduce) {
          .stamp { animation: none; transform: rotate(-9deg); }
        }
      `}</style>

      <div className="mx-auto max-w-xl">
        <header className="mb-8 flex items-end justify-between">
          <div>
            <p className="font-mono text-xs tracking-widest text-[#1A1714]/60">
              PERSONAL REVIEW COACH
            </p>
            <h1 className="font-serif text-4xl font-bold tracking-tight">覚える君</h1>
          </div>
          <p className="font-mono text-xs text-[#1A1714]/60">{today()}</p>
        </header>

        {error && (
          <div className="mb-4 border-2 border-[#B83227] bg-[#F7F1E3] px-4 py-3 text-sm text-[#B83227]">
            {error}
          </div>
        )}

        {view === "home" && (
          <div className="space-y-5">
            <div className="border-2 border-[#1A1714] bg-[#F7F1E3] p-6 shadow-[6px_6px_0_0_#1A1714]">
              <p className="text-sm text-[#1A1714]/70">今日ぶり返す用語</p>
              <p className="font-serif text-6xl font-bold leading-none">
                {due.length}
                <span className="ml-2 font-sans text-base font-normal">件</span>
              </p>
              <button
                onClick={startQuiz}
                disabled={due.length === 0}
                className="mt-5 w-full border-2 border-[#1A1714] bg-[#B83227] px-4 py-3 font-bold text-[#F7F1E3] transition hover:bg-[#9c2a20] disabled:cursor-not-allowed disabled:bg-[#1A1714]/20 disabled:text-[#1A1714]/50"
              >
                {due.length === 0 ? "今日はもう全部やった" : "今日の復習をはじめる"}
              </button>
            </div>

            <div className="border-2 border-[#1A1714] bg-[#F7F1E3]">
              <div className="flex items-center justify-between border-b-2 border-[#1A1714] px-4 py-2">
                <h2 className="font-serif text-lg font-bold">覚え中の用語</h2>
                <button
                  onClick={() => setView("add")}
                  className="font-mono text-xs underline underline-offset-4"
                >
                  + 追加する
                </button>
              </div>
              <ul>
                {terms.map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between border-b border-[#1A1714]/15 px-4 py-3 last:border-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{t.term}</p>
                      {t.note && (
                        <p className="truncate text-xs text-[#1A1714]/55">{t.note}</p>
                      )}
                    </div>
                    <div className="ml-3 shrink-0 text-right">
                      <div className="flex gap-1">
                        {INTERVALS.map((_, i) => (
                          <span
                            key={i}
                            className={`block h-1.5 w-3 ${
                              i < t.level ? "bg-[#B83227]" : "bg-[#1A1714]/15"
                            }`}
                          />
                        ))}
                      </div>
                      <p className="mt-1 font-mono text-[10px] text-[#1A1714]/55">
                        {t.next <= today() ? "今日" : t.next}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {view === "quiz" && current && (
          <div className="border-2 border-[#1A1714] bg-[#F7F1E3] p-6 shadow-[6px_6px_0_0_#1A1714]">
            <p className="font-mono text-xs tracking-widest text-[#1A1714]/60">お題</p>
            <h2 className="mt-1 font-serif text-3xl font-bold">{current.term}</h2>
            <div className="mt-2 h-1 w-24 bg-[#B83227]" />
            {current.note && (
              <p className="mt-3 text-sm text-[#1A1714]/70">メモ：{current.note}</p>
            )}

            <label className="mt-6 block text-sm font-medium">
              自分の言葉で説明してみて
            </label>
            <textarea
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={5}
              placeholder="人に教えるつもりで書くと定着する"
              className="mt-2 w-full resize-none border-2 border-[#1A1714] bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#B83227]"
            />

            <div className="mt-3 flex items-center gap-3">
              <MicButton
                onText={(t) =>
                  setAnswer((a) => (a ? a.trim() + " " : "") + t)
                }
                onError={setError}
                label="声で説明する"
              />
              <p className="text-xs text-[#1A1714]/60">
                口に出す方が、ごまかしが効かへん
              </p>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={grade}
                disabled={loading || !answer.trim()}
                className="flex-1 border-2 border-[#1A1714] bg-[#B83227] px-4 py-3 font-bold text-[#F7F1E3] hover:bg-[#9c2a20] disabled:bg-[#1A1714]/20 disabled:text-[#1A1714]/50"
              >
                {loading ? "採点中…" : "答える"}
              </button>
              <button
                onClick={grade}
                disabled={loading}
                className="border-2 border-[#1A1714] px-4 py-3 font-bold hover:bg-[#1A1714]/5"
              >
                わからん
              </button>
            </div>
          </div>
        )}

        {view === "result" && result && (
          <div className="space-y-4">
            <div className="relative border-2 border-[#1A1714] bg-[#F7F1E3] p-6 shadow-[6px_6px_0_0_#1A1714]">
              <div className="stamp absolute right-4 top-4">
                <Stamp score={result.score} />
              </div>
              <p className="font-mono text-xs tracking-widest text-[#1A1714]/60">
                {current.term}
              </p>
              <p className="mt-4 pr-24 font-serif text-xl font-bold leading-relaxed">
                「{result.tsukkomi}」
              </p>
            </div>

            <div className="border-2 border-[#1A1714] bg-[#F7F1E3] p-5">
              <h3 className="font-serif font-bold">ほんまのところ</h3>
              <p className="mt-2 text-sm leading-relaxed">{result.correct}</p>
              {result.missed?.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-[#1A1714]/60">言えてなかった言葉</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {result.missed.map((m, i) => (
                      <button
                        key={i}
                        onClick={() => askChat(`「${m}」ってどういう意味？`)}
                        className="border border-[#B83227] px-2 py-1 font-mono text-xs text-[#B83227] hover:bg-[#B83227] hover:text-[#F7F1E3]"
                      >
                        {m} <span aria-hidden="true">?</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="border-2 border-[#1A1714] bg-[#1A1714] p-5 text-[#F7F1E3]">
              <h3 className="font-serif font-bold text-[#D9A441]">
                今すぐ手を動かす
              </h3>
              <p className="mt-2 text-sm leading-relaxed">{result.mission}</p>
            </div>

            <div className="border-2 border-[#1A1714] bg-[#F7F1E3]">
              <div className="border-b-2 border-[#1A1714] px-4 py-2">
                <h3 className="font-serif font-bold">聞き返す</h3>
                <p className="text-xs text-[#1A1714]/60">
                  出てきた言葉で分からんものは、その場で潰しとく
                </p>
              </div>

              {chat.length > 0 && (
                <div className="space-y-3 px-4 py-4">
                  {chat.map((m, i) => (
                    <div
                      key={i}
                      className={m.role === "user" ? "text-right" : "text-left"}
                    >
                      <span
                        className={`inline-block max-w-[85%] px-3 py-2 text-left text-sm leading-relaxed ${
                          m.role === "user"
                            ? "bg-[#1A1714] text-[#F7F1E3]"
                            : "border-2 border-[#1A1714] bg-white"
                        }`}
                      >
                        {m.content}
                      </span>
                    </div>
                  ))}
                  {chatLoading && (
                    <p className="text-sm text-[#1A1714]/50">考え中…</p>
                  )}
                </div>
              )}

              {chat.length === 0 && (
                <div className="flex flex-wrap gap-2 px-4 pt-4">
                  <Chip onClick={() => askChat("もっと簡単に言い直して")}>
                    もっと簡単に
                  </Chip>
                  <Chip onClick={() => askChat("何かに例えて説明して")}>
                    例えて
                  </Chip>
                  <Chip
                    onClick={() =>
                      askChat(
                        `メモに書いてある「${current.note || current.term}」って何のことやったっけ？`
                      )
                    }
                  >
                    メモの意味は？
                  </Chip>
                </div>
              )}

              <div className="flex gap-2 p-4">
                <MicButton
                  onText={(t) =>
                    setChatInput((c) => (c ? c.trim() + " " : "") + t)
                  }
                  onError={setError}
                  label=""
                />
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && askChat()}
                  placeholder="例：週カレンダーって何？"
                  className="min-w-0 flex-1 border-2 border-[#1A1714] bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#B83227]"
                />
                <button
                  onClick={() => askChat()}
                  disabled={chatLoading || !chatInput.trim()}
                  className="shrink-0 border-2 border-[#1A1714] px-4 py-2 text-sm font-bold hover:bg-[#1A1714]/5 disabled:text-[#1A1714]/30"
                >
                  聞く
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={startQuiz}
                disabled={due.length === 0}
                className="flex-1 border-2 border-[#1A1714] bg-[#B83227] px-4 py-3 font-bold text-[#F7F1E3] hover:bg-[#9c2a20] disabled:bg-[#1A1714]/20 disabled:text-[#1A1714]/50"
              >
                次のお題へ
              </button>
              <button
                onClick={() => setView("home")}
                className="border-2 border-[#1A1714] px-4 py-3 font-bold hover:bg-[#1A1714]/5"
              >
                やめる
              </button>
            </div>
          </div>
        )}

        {view === "add" && (
          <div className="border-2 border-[#1A1714] bg-[#F7F1E3] p-6 shadow-[6px_6px_0_0_#1A1714]">
            <h2 className="font-serif text-2xl font-bold">用語を追加する</h2>
            <label className="mt-5 block text-sm font-medium">用語</label>
            <input
              value={newTerm}
              onChange={(e) => setNewTerm(e.target.value)}
              placeholder="例：useRef"
              className="mt-2 w-full border-2 border-[#1A1714] bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#B83227]"
            />
            <label className="mt-4 block text-sm font-medium">
              どこで出てきた？
            </label>
            <input
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="例：YouTube診断ツールの入力欄で使った"
              className="mt-2 w-full border-2 border-[#1A1714] bg-white p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#B83227]"
            />
            <p className="mt-2 text-xs text-[#1A1714]/60">
              自分の作ったものと結びつくほど忘れにくい。
            </p>
            <div className="mt-5 flex gap-2">
              <button
                onClick={addTerm}
                disabled={!newTerm.trim()}
                className="flex-1 border-2 border-[#1A1714] bg-[#B83227] px-4 py-3 font-bold text-[#F7F1E3] hover:bg-[#9c2a20] disabled:bg-[#1A1714]/20 disabled:text-[#1A1714]/50"
              >
                追加する
              </button>
              <button
                onClick={() => setView("home")}
                className="border-2 border-[#1A1714] px-4 py-3 font-bold hover:bg-[#1A1714]/5"
              >
                戻る
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MicButton({ onText, onError, label = "話す" }) {
  const [rec, setRec] = useState(null);
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setSupported(false);
      return;
    }
    const r = new SR();
    r.lang = "ja-JP";
    r.continuous = true;
    r.interimResults = false;
    setRec(r);
    return () => {
      try {
        r.stop();
      } catch {}
    };
  }, []);

  const toggle = () => {
    if (!rec) return;
    if (listening) {
      rec.stop();
      setListening(false);
      return;
    }
    rec.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) text += e.results[i][0].transcript;
      }
      if (text) onText(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = (e) => {
      setListening(false);
      onError?.(
        e.error === "not-allowed"
          ? "マイクが使えへん。ブラウザの設定でマイクを許可して。"
          : "音声がうまく拾えんかった。もう一回試してみて。"
      );
    };
    try {
      rec.start();
      setListening(true);
    } catch {
      onError?.("マイクを起動できひんかった。");
    }
  };

  if (!supported) return null;

  return (
    <button
      onClick={toggle}
      aria-pressed={listening}
      className={`flex shrink-0 items-center gap-2 border-2 border-[#1A1714] px-3 py-2 text-sm font-bold ${
        listening
          ? "bg-[#B83227] text-[#F7F1E3]"
          : "bg-transparent hover:bg-[#1A1714]/5"
      }`}
    >
      <span
        className={`block h-2.5 w-2.5 rounded-full ${
          listening
            ? "animate-pulse bg-[#F7F1E3] motion-reduce:animate-none"
            : "bg-[#B83227]"
        }`}
      />
      {listening ? "とめる" : label}
    </button>
  );
}

function Chip({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="border-2 border-[#1A1714] px-3 py-1.5 text-xs font-medium hover:bg-[#1A1714] hover:text-[#F7F1E3]"
    >
      {children}
    </button>
  );
}

function Stamp({ score }) {
  const label = score >= 80 ? "花丸" : score >= 50 ? "よし" : "もう一回";
  return (
    <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full border-[3px] border-[#B83227] text-[#B83227]">
      <span className="font-serif text-base font-bold leading-none">{label}</span>
      <span className="mt-1 font-mono text-[10px]">{score}</span>
    </div>
  );
}
