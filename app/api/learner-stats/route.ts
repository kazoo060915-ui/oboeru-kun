import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

const DEFAULT_USER = 'default_user';

export interface LearnerStatsResponse {
  totalReviews: number;
  totalCorrect: number;
}

// 称号ランクの元になる累計復習回数。以前は端末のlocalStorageだけに
// 保存していたため、PCとスマホで別々にカウントされ、同じアカウントでも
// 表示されるランクが端末ごとにズレていた。DBに一本化することでどの
// 端末からでも同じランクが見えるようにする。
export async function GET(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ totalReviews: 0, totalCorrect: 0 } satisfies LearnerStatsResponse);
  }

  const { data, error } = await supabase
    .from('user_settings')
    .select('total_reviews, total_correct')
    .eq('user_id', DEFAULT_USER)
    .maybeSingle();

  if (error) {
    console.error('Failed to read learner stats:', error);
    return NextResponse.json({ totalReviews: 0, totalCorrect: 0 } satisfies LearnerStatsResponse);
  }

  return NextResponse.json({
    totalReviews: data?.total_reviews || 0,
    totalCorrect: data?.total_correct || 0,
  } satisfies LearnerStatsResponse);
}

export async function PATCH(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  if (!isSupabaseConfigured || !supabase) {
    return NextResponse.json({ error: 'DBが未設定のため学習実績を保存できません。' }, { status: 501 });
  }

  try {
    const { answeredCount, correctCount } = await req.json();
    const addedReviews = Number(answeredCount) || 0;
    const addedCorrect = Number(correctCount) || 0;

    const { data: current, error: readError } = await supabase
      .from('user_settings')
      .select('total_reviews, total_correct')
      .eq('user_id', DEFAULT_USER)
      .maybeSingle();

    if (readError) {
      console.error('Failed to read learner stats before update:', readError);
      return NextResponse.json({ error: '学習実績の更新に失敗しました。' }, { status: 500 });
    }

    const totalReviews = (current?.total_reviews || 0) + addedReviews;
    const totalCorrect = (current?.total_correct || 0) + addedCorrect;

    const { error: writeError } = await supabase.from('user_settings').upsert(
      {
        user_id: DEFAULT_USER,
        total_reviews: totalReviews,
        total_correct: totalCorrect,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id' }
    );

    if (writeError) {
      console.error('Failed to write learner stats:', writeError);
      return NextResponse.json({ error: '学習実績の更新に失敗しました。' }, { status: 500 });
    }

    return NextResponse.json({ totalReviews, totalCorrect } satisfies LearnerStatsResponse);
  } catch (error) {
    console.error('PATCH /api/learner-stats failed:', error);
    return NextResponse.json({ error: '学習実績の更新に失敗しました。' }, { status: 500 });
  }
}
