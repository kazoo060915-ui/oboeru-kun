import { createClient } from '@supabase/supabase-js';

export interface Term {
  id: string;
  user_id: string;
  term: string;
  note: string;
  level: number; // 0 to 4
  next_review_at: string; // YYYY-MM-DD
  last_score: number | null;
  created_at?: string;
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
