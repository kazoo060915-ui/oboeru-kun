import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  return handleNotification(req);
}

export async function POST(req: NextRequest) {
  return handleNotification(req);
}

async function handleNotification(req: NextRequest) {
  try {
    // 簡易セキュリティ: CRON_SECRET の検証
    const authHeader = req.headers.get('authorization');
    const secretParam = req.nextUrl.searchParams.get('secret');
    const expectedSecret = process.env.CRON_SECRET;

    if (
      expectedSecret &&
      authHeader !== `Bearer ${expectedSecret}` &&
      secretParam !== expectedSecret
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    let dueTerms: { term: string }[] = [];

    if (isSupabaseConfigured && supabase) {
      const { data } = await supabase
        .from('terms')
        .select('term')
        .lte('next_review_at', todayStr);
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
