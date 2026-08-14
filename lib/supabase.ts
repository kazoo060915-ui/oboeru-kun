import { createClient } from '@supabase/supabase-js';

export interface Term {
  id: string;
  user_id: string;
  term: string;
  note: string;
  tag?: string; // 講義回や分野（例: '第9回講義', 'React', 'Git'）
  level: number; // 0 to 4
  next_review_at: string; // YYYY-MM-DD
  last_score: number | null;
  created_at?: string;
}

// AI Driven School の各回講義テーマ定義
export const LECTURE_TITLES: Record<string, string> = {
  '1': '第1回 (ワールドツアー)',
  '2': '第2回 (動かす側の壁)',
  '3': '第3回 (報告自動化)',
  '4': '第4回 (ツール選定)',
  '5': '第5回 (画面・UI設計)',
  '6': '第6回 (アプリ公開・中身)',
  '7': '第7回 (ツールに記憶/DB)',
  '8': '第8回 (自分の武器作成)',
  '9': '第9回 (ライティング)',
  '10': '第10回 (ストーリー制作)',
  '11': '第11回 (AIの裏側)',
};

// 用語の note や tag から代表的な講義・分野タグをスマートに抽出する関数
export function getTermTag(t: Term): string {
  if (t.tag && t.tag.trim()) {
    const rawTag = t.tag.trim();
    const m = rawTag.match(/第\s*(\d+)\s*回/);
    if (m && LECTURE_TITLES[m[1]]) {
      return LECTURE_TITLES[m[1]];
    }
    return rawTag;
  }

  const text = (t.note || '') + ' ' + (t.term || '');
  
  // 第X回講義 または 第X回
  const matchLecture = text.match(/第\s*(\d+)\s*回(?:講義)?/);
  if (matchLecture) {
    const num = matchLecture[1];
    return LECTURE_TITLES[num] || `第${num}回講義`;
  }

  // キーワードパターン
  if (/react|jsx|hook|usestate|useeffect|props/i.test(text)) return 'React';
  if (/next\.js|nextjs|ssr|ssg|isr/i.test(text)) return 'Next.js';
  if (/git|github|commit|push|pull/i.test(text)) return 'Git';
  if (/ai|llm|claude|gemini|gpt|context/i.test(text)) return 'AI・LLM';

  return '一般';
}


export interface Review {
  id: string;
  term_id: string;
  score: number;
  answer_text: string;
  tsukkomi: string;
  correct: string;
  missed_keywords: string[];
  mission: string;
  created_at?: string;
}

export interface UserSettings {
  user_id: string;
  notification_channel: 'line' | 'email' | 'both' | 'none';
  line_token?: string;
  email_address?: string;
  updated_at?: string;
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
