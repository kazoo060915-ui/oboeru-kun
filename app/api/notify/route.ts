import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { isAuthenticated } from '@/lib/auth';
import { todayStr } from '@/lib/date';

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

    // 日本時間の「今日」。UTC基準だと Cron 実行時（07:00 JST = 22:00 UTC）に
    // 前日の日付になり、今日ぶんの用語を丸ごと取りこぼしていた。
    const today = todayStr();
    let dueTerms: { term: string }[] = [];

    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('terms')
        .select('term')
        .lte('next_review_at', today);
      dueTerms = data || [];
    } else {
      dueTerms = [{ term: 'useState' }, { term: 'useEffect' }, { term: 'props' }];
    }

    const count = dueTerms.length;
    let messageText = '';

    if (count === 0) {
      messageText = '【覚える君】今日の復習用語はあらへんよ！全勝中や、素晴らしい！';
    } else {
      const samples = dueTerms.slice(0, 2).map((t) => `「${t.term}」`).join('と');
      const extra = count > 2 ? ` ほか計${count}件` : '';
      messageText = `【覚える君】おつかれさま！今日は${count}件の復習があるで。${samples}${extra}、覚えてる？隙間時間にパパッと答えてみよう！`;
    }

    const results: Record<string, string> = {};

    // 1. LINE Notify 通知送信
    const lineToken = process.env.LINE_NOTIFY_TOKEN;
    if (lineToken) {
      try {
        const lineRes = await fetch('https://notify-api.line.me/api/notify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Authorization: `Bearer ${lineToken}`,
          },
          body: new URLSearchParams({ message: messageText }),
        });
        results.line = lineRes.ok ? 'sent' : `failed (${lineRes.status})`;
      } catch (err: any) {
        results.line = `error: ${err.message}`;
      }
    } else {
      results.line = 'skipped (LINE_NOTIFY_TOKEN not set)';
    }

    // 2. Email 通知送信 (Resend API 等)
    const resendApiKey = process.env.RESEND_API_KEY;
    const toEmail = process.env.NOTIFICATION_TO_EMAIL;
    if (resendApiKey && toEmail) {
      try {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: process.env.NOTIFICATION_FROM_EMAIL || 'oboeru@resend.dev',
            to: [toEmail],
            subject: `【覚える君】今日の復習(${count}件)`,
            text: messageText,
          }),
        });
        results.email = emailRes.ok ? 'sent' : `failed (${emailRes.status})`;
      } catch (err: any) {
        results.email = `error: ${err.message}`;
      }
    } else {
      results.email = 'skipped (RESEND_API_KEY / NOTIFICATION_TO_EMAIL not set)';
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
