// サーバー専用モジュール。クライアントコンポーネントから import すると
// ビルドエラーになる（'server-only' がその番人）。
// サービスロールキーは RLS をバイパスするため、絶対にブラウザへ出さないこと。
import 'server-only';
import { createClient } from '@supabase/supabase-js';

// 型と純粋関数は lib/types.ts へ。クライアントからはそちらを import する。
export type { Term, Review, UserSettings } from './types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseServiceKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;
