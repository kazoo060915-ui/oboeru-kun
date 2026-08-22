import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';
import { getEffectiveNotificationSettings, NotificationChannel } from '@/lib/notificationSettings';

const DEFAULT_USER = 'default_user';
const VALID_CHANNELS: NotificationChannel[] = ['line', 'email', 'both', 'none'];

// ざっくりしたメールアドレス形式チェック。厳密なRFC準拠までは要らない
// （実際に届くかどうかは Resend 側のドメイン検証で決まるので、ここでは
// 明らかに壊れた入力だけ弾ければ十分）。
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface SettingsResponse {
  notificationChannel: NotificationChannel;
  emailAddress: string;
  // 値そのものではなく「使える状態か」だけをクライアントに返す。
  // env の実値（トークン等）は絶対にブラウザへ出さない。
  lineEnvConfigured: boolean;
  emailEnvConfigured: boolean;
  canSave: boolean;
}

export async function GET(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  const settings = await getEffectiveNotificationSettings();
  const body: SettingsResponse = {
    notificationChannel: settings.channel,
    emailAddress: settings.emailAddress,
    lineEnvConfigured: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_USER_ID),
    emailEnvConfigured: Boolean(process.env.RESEND_API_KEY),
    canSave: Boolean(isSupabaseConfigured && supabase),
  };
  return NextResponse.json(body);
}

export async function PATCH(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json(
      { error: 'DBが未設定のため通知設定を保存できません（環境変数由来の設定のみ有効です）。' },
      { status: 501 }
    );
  }

  try {
    const { notificationChannel, emailAddress } = await req.json();

    if (notificationChannel !== undefined && !VALID_CHANNELS.includes(notificationChannel)) {
      return NextResponse.json({ error: '通知チャネルの値が不正です。' }, { status: 400 });
    }
    const trimmedEmail = typeof emailAddress === 'string' ? emailAddress.trim() : undefined;
    if (trimmedEmail && !EMAIL_RE.test(trimmedEmail)) {
      return NextResponse.json({ error: 'メールアドレスの形式が正しくありません。' }, { status: 400 });
    }

    const updates: Record<string, string> = { user_id: DEFAULT_USER, updated_at: new Date().toISOString() };
    if (notificationChannel !== undefined) updates.notification_channel = notificationChannel;
    if (trimmedEmail !== undefined) updates.email_address = trimmedEmail;

    const { error } = await supabase.from('user_settings').upsert(updates, { onConflict: 'user_id' });

    if (error) {
      console.error('Supabase upsert user_settings error:', error);
      return NextResponse.json({ error: '通知設定の保存に失敗しました。' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('PATCH /api/settings failed:', error);
    return NextResponse.json({ error: '通知設定の保存に失敗しました。' }, { status: 500 });
  }
}
