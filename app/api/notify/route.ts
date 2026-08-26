import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';
import { todayStr } from '@/lib/date';
import { getEffectiveNotificationSettings } from '@/lib/notificationSettings';

export async function GET(req: NextRequest) {
  return handleNotification(req);
}

export async function POST(req: NextRequest) {
  return handleNotification(req);
}

async function handleNotification(req: NextRequest) {
  try {
    // 通り道は2つだけ:
    //   1. Vercel Cron → Authorization: Bearer $CRON_SECRET を自動付与してくる
    //   2. ログイン済みユーザーの手動テスト送信 → 認証Cookie
    //
    // 以前は secret をクエリパラメータでも受けていたが、URLに載る値は
    // アクセスログ・Referer・ブラウザ履歴に平文で残るため廃止した。
    // また expectedSecret が未設定だと条件式ごと skip されて
    // 誰でも通知を送れる状態だったので、未設定は設定ミスとして落とす。
    const expectedSecret = process.env.CRON_SECRET;
    if (!expectedSecret) {
      console.error('CRON_SECRET is not configured');
      return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    const isCron = req.headers.get('authorization') === `Bearer ${expectedSecret}`;
    if (!isCron && !isAuthenticated(req)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const settings = await getEffectiveNotificationSettings();

    // ユーザーが「通知しない」を選んでいる場合、これは失敗ではなく意図した
    // 状態なので、以下の「1通も届かなければ502」というガードには乗せない。
    if (settings.channel === 'none') {
      return NextResponse.json({
        success: true,
        dueCount: 0,
        message: '',
        results: { line: 'skipped (通知チャネルが「なし」に設定されています)', email: 'skipped (通知チャネルが「なし」に設定されています)' },
      });
    }

    // 日本時間の「今日」。UTC基準だと Cron 実行時（07:00 JST = 22:00 UTC）に
    // 前日の日付になり、今日ぶんの用語を丸ごと取りこぼしていた。
    const today = todayStr();
    let dueTerms: { term: string }[] = [];

    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('terms')
        .select('term')
        .eq('user_id', 'default_user')
        .lte('next_review_at', today);
      dueTerms = data || [];
    } else {
      dueTerms = [{ term: 'useState' }, { term: 'useEffect' }, { term: 'props' }];
    }

    const count = dueTerms.length;
    let messageText = '';

    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.VERCEL_PROJECT_PRODUCTION_URL
        ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
        : 'https://oboeru-kun.vercel.app');

    if (count === 0) {
      messageText = `【覚える君】今日の復習用語はあらへんよ！全勝中や、素晴らしい！\n\n▼ アプリを開く\n${appUrl}`;
    } else {
      const samples = dueTerms.slice(0, 2).map((t) => `「${t.term}」`).join('と');
      const extra = count > 2 ? ` ほか計${count}件` : '';
      messageText = `【覚える君】おつかれさま！今日は${count}件の復習があるで。${samples}${extra}、覚えてる？隙間時間にパパッと答えてみよう！\n\n▼ 今すぐ復習する\n${appUrl}`;
    }

    const results: Record<string, string> = {};

    // 1. LINE 通知送信（Messaging API の push）
    //
    // 旧実装は LINE Notify（notify-api.line.me）を叩いていたが、
    // LINE Notify は 2025-03-31 でサービス終了しており、あのエンドポイントは
    // もう通らない。通知はこのアプリの心臓部なのに、失敗は results に
    // 記録されるだけで誰の目にも触れず、静かに死んでいた。
    //
    // 移行先は Messaging API。LINE Developers でチャネルを作り、
    //   LINE_CHANNEL_ACCESS_TOKEN … チャネルアクセストークン（長期）
    //   LINE_USER_ID              … 送信先のユーザーID（自分のID）
    // を設定する。どちらか欠けていれば skip。
    const lineToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const lineUserId = process.env.LINE_USER_ID;
    const lineWanted = settings.channel === 'line' || settings.channel === 'both';
    if (!lineWanted) {
      results.line = 'skipped (通知設定でLINEが無効になっています)';
    } else if (lineToken && lineUserId) {
      try {
        const lineRes = await fetch('https://api.line.me/v2/bot/message/push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${lineToken}`,
          },
          body: JSON.stringify({
            to: lineUserId,
            messages: [{ type: 'text', text: messageText }],
          }),
        });

        if (lineRes.ok) {
          results.line = 'sent';
        } else {
          // 原因（トークン失効・ID間違い・無料枠切れ）が本文に入るのでログに残す
          const detail = await lineRes.text().catch(() => '');
          console.error('LINE push failed:', lineRes.status, detail);
          results.line = `failed (${lineRes.status})`;
        }
      } catch (err: any) {
        console.error('LINE push error:', err);
        results.line = `error: ${err.message}`;
      }
    } else {
      results.line = 'skipped (LINE_CHANNEL_ACCESS_TOKEN / LINE_USER_ID not set)';
    }

    // 2. Email 通知送信 (Resend API 等)
    const resendApiKey = process.env.RESEND_API_KEY;
    // 宛先は「通知設定で登録したメールアドレス」を優先し、無ければ
    // 環境変数の NOTIFICATION_TO_EMAIL にフォールバックする
    // （lib/notificationSettings.ts の解決順序と揃える）。
    const toEmail = settings.emailAddress;
    const emailWanted = settings.channel === 'email' || settings.channel === 'both';
    if (!emailWanted) {
      results.email = 'skipped (通知設定でメールが無効になっています)';
    } else if (resendApiKey && toEmail) {
      try {
        console.log(`Sending email notification via Resend to ${toEmail}...`);
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: process.env.NOTIFICATION_FROM_EMAIL || 'onboarding@resend.dev',
            to: [toEmail],
            subject: `【覚える君】今日の復習(${count}件)`,
            text: messageText,
          }),
        });
        if (emailRes.ok) {
          console.log(`Email notification sent successfully to ${toEmail}`);
          results.email = 'sent';
        } else {
          const detail = await emailRes.text().catch(() => '');
          console.error('Resend send failed:', emailRes.status, detail);
          results.email = `failed (${emailRes.status})`;
        }
      } catch (err: any) {
        console.error('Resend send error:', err);
        results.email = `error: ${err.message}`;
      }
    } else {
      results.email = 'skipped (RESEND_API_KEY が未設定か、宛先メールアドレスが未登録です)';
    }

    // 1通も届いていないなら、それは成功ではない。
    // 以前は常に success: true を返していたため、Vercel の Cron ログは
    // ずっと緑のまま、実際には何ヶ月も通知が届いていない状態に気づけなかった。
    const delivered = Object.values(results).some((r) => r === 'sent');
    if (!delivered) {
      console.error('Notification delivered to no channel:', results);
      return NextResponse.json(
        {
          success: false,
          error: '通知をどのチャネルにも送信できませんでした。環境変数を確認してください。',
          dueCount: count,
          message: messageText,
          results,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      dueCount: count,
      message: messageText,
      results,
    });
  } catch (error: any) {
    console.error('Notification API Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to send notification' },
      { status: 500 }
    );
  }
}
