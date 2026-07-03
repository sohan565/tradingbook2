import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const dateStr = searchParams.get('date'); // YYYY-MM-DD

    if (!dateStr) {
      return NextResponse.json(
        { success: false, error: 'Missing date parameter' },
        { status: 400 }
      );
    }

    // Find the journal entry for the exact date, including linked trades
    const journalEntry = await prisma.journalEntry.findUnique({
      where: { date: dateStr },
      include: {
        trades: {
          orderBy: {
            entryTime: 'asc',
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: journalEntry });
  } catch (error: any) {
    console.error('Fetch journal API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    if (!payload.date) {
      return NextResponse.json(
        { success: false, error: 'Missing date parameter' },
        { status: 400 }
      );
    }

    const tradeIds = payload.tradeIds || [];

    // Create or update the journal entry
    const journalEntry = await prisma.journalEntry.upsert({
      where: { date: payload.date },
      create: {
        date: payload.date,
        title: payload.title || null,
        content: payload.content || '',
        mood: payload.mood || null,
        preSessionPlan: payload.preSessionPlan || null,
        postSessionReview: payload.postSessionReview || null,
        tags: payload.tags || [],
        screenshots: payload.screenshots || [],
        trades: {
          connect: tradeIds.map((id: string) => ({ id })),
        },
      },
      update: {
        title: payload.title || null,
        content: payload.content || '',
        mood: payload.mood || null,
        preSessionPlan: payload.preSessionPlan || null,
        postSessionReview: payload.postSessionReview || null,
        tags: payload.tags || [],
        screenshots: payload.screenshots || [],
        trades: {
          // 'set' disconnects any previous trades and connects only the ones provided
          set: tradeIds.map((id: string) => ({ id })),
        },
      },
      include: {
        trades: true,
      },
    });

    return NextResponse.json({ success: true, data: journalEntry });
  } catch (error: any) {
    console.error('Save journal API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
