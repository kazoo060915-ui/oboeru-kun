// コーチキャラクターの「見た目」の定義。
// クライアント（セレクターUI）とサーバー（プロンプト生成）の双方から使う。
//
// 人格プロンプト本文（getCoachPersona）は lib/anthropic.ts のサーバー側に
// 置いたまま。ここに持ってくるとプロンプト全文がブラウザに配信される。

export type CoachType = 'osaka' | 'praise' | 'mentor' | 'hotblood' | 'sage';

export const COACH_LIST: { id: CoachType; icon: string; name: string; description: string }[] = [
  { id: 'osaka',    icon: '👦', name: '大阪の兄ちゃん',   description: '笑いながら背中を押すツッコミ系' },
  { id: 'praise',   icon: '🌸', name: '褒め上手な先輩',   description: '全肯定で優しく応援してくれる' },
  { id: 'mentor',   icon: '👔', name: 'スマートメンター', description: 'ロジカル＆知的な標準語解説' },
  { id: 'hotblood', icon: '🔥', name: '熱血コーチ',       description: 'ガツンと喝！燃え上がるやる気' },
  { id: 'sage',     icon: '🧙', name: '知識の賢者',       description: '穏やかで深みのある哲学的解説' },
];

export const DEFAULT_COACH: CoachType = 'osaka';

// 不正な値が API に飛んできた場合に既定へ丸める
export function normalizeCoach(value: unknown): CoachType {
  return COACH_LIST.some((c) => c.id === value) ? (value as CoachType) : DEFAULT_COACH;
}
