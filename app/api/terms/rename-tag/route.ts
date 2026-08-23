import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { requireAuth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  try {
    const { oldTag, newTag } = await req.json();

    if (!oldTag || typeof oldTag !== 'string' || !oldTag.trim()) {
      return NextResponse.json({ error: '変更前のタグ名は必須です。' }, { status: 400 });
    }
    if (!newTag || typeof newTag !== 'string' || !newTag.trim()) {
      return NextResponse.json({ error: '新しいタグ名は必須です。' }, { status: 400 });
    }

    const trimmedOld = oldTag.trim();
    const trimmedNew = newTag.trim();

    if (!isSupabaseConfigured || !supabase) {
      return NextResponse.json({
        success: true,
        updatedCount: 0,
        message: 'ローカルデモモードのためDB更新はスキップされました。',
      });
    }

    // 1. 指定タグを持つ用語を一括更新
    const { data: updatedTerms, error: updateErr } = await supabase
      .from('terms')
      .update({ tag: trimmedNew })
      .eq('tag', trimmedOld)
      .eq('user_id', 'default_user')
      .select('id');

    if (updateErr) {
      console.error('Supabase rename-tag error:', updateErr);
      return NextResponse.json({ error: 'タグ名の更新に失敗しました。' }, { status: 500 });
    }

    const count = updatedTerms ? updatedTerms.length : 0;

    return NextResponse.json({
      success: true,
      updatedCount: count,
      oldTag: trimmedOld,
      newTag: trimmedNew,
      message: `タグ「${trimmedOld}」の用語 ${count} 件を「${trimmedNew}」に変更しました。`,
    });
  } catch (error: any) {
    console.error('API /api/terms/rename-tag error:', error);
    return NextResponse.json(
      { error: error?.message || 'タグの更新処理に失敗しました。' },
      { status: 500 }
    );
  }
}
