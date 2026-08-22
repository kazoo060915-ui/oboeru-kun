import 'server-only';
import { supabase, isSupabaseConfigured } from './supabase';

const DEFAULT_USER = 'default_user';

export type NotificationChannel = 'line' | 'email' | 'both' | 'none';

export interface EffectiveNotificationSettings {
  channel: NotificationChannel;
  /** ユーザー設定 or env のどちらかから決まった、実際に使う宛先メールアドレス */
  emailAddress: string;
}

/**
 * /api/notify と /api/settings の両方が使う「今、実際に使う通知設定」。
 * DB のユーザー設定を優先し、無ければ env にフォールバックする。
 * 1箇所にまとめているのは、この解決順序が2つのルートでズレると
 * 「設定画面では届く表示なのに、実際のCronでは違う宛先に届く」
 * という食い違いが起きるため。
 */
export async function getEffectiveNotificationSettings(): Promise<EffectiveNotificationSettings> {
  if (!isSupabaseConfigured || !supabase) {
    return { channel: 'both', emailAddress: process.env.NOTIFICATION_TO_EMAIL || '' };
  }

  const { data, error } = await supabase
    .from('user_settings')
    .select('notification_channel, email_address')
    .eq('user_id', DEFAULT_USER)
    .maybeSingle();

  if (error) {
    console.error('Failed to read user_settings, falling back to defaults:', error);
    return { channel: 'both', emailAddress: process.env.NOTIFICATION_TO_EMAIL || '' };
  }

  return {
    channel: (data?.notification_channel as NotificationChannel) || 'both',
    emailAddress: data?.email_address || process.env.NOTIFICATION_TO_EMAIL || '',
  };
}
