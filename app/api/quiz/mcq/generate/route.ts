import { NextRequest, NextResponse } from 'next/server';
import { generateMultipleChoiceQuiz } from '@/lib/anthropic';
import { normalizeCoach } from '@/lib/coach';
import { requireAuth } from '@/lib/auth';

export async function POST(req: NextRequest) {
  const denied = requireAuth(req);
  if (denied) return denied;

  try {
    const { term, note = '', coach = 'osaka', userName = 'あなた' } = await req.json();

    if (!term || typeof term !== 'string') {
      return NextResponse.json({ error: 'Term is required' }, { status: 400 });
    }

    const quiz = await generateMultipleChoiceQuiz(
      term.trim(),
      typeof note === 'string' ? note.trim() : '',
      normalizeCoach(coach),
      typeof userName === 'string' ? userName.trim() || 'あなた' : 'あなた'
    );

    return NextResponse.json({ quiz });
  } catch (error: unknown) {
    console.error('API /api/quiz/mcq/generate error:', error);
    return NextResponse.json(
      { error: '4択クイズの生成に失敗しました。' },
      { status: 500 }
    );
  }
}
