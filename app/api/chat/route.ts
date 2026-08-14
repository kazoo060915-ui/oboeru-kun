import { NextRequest, NextResponse } from 'next/server';
import { askCoachChat, ChatMessage, CoachType } from '@/lib/anthropic';

export async function POST(req: NextRequest) {
  try {
    const { term, note, answer, correct, mission, chatHistory, coach = 'osaka' } = await req.json();

    if (!term) {
      return NextResponse.json({ error: 'Term is required' }, { status: 400 });
    }

    const reply = await askCoachChat(
      term,
      note || '',
      answer || '',
      correct || '',
      mission || '',
      (chatHistory as ChatMessage[]) || [],
      coach as CoachType
    );

    return NextResponse.json({ reply });
  } catch (error: any) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to process chat message' },
      { status: 500 }
    );
  }
}
