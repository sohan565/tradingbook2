import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET() {
  try {
    const sessions = await prisma.backtestSession.findMany({
      select: {
        id: true,
        name: true,
        symbol: true,
        timeframe: true,
        dataSource: true,
        startDate: true,
        endDate: true,
        initialBalance: true,
        currentBalance: true,
        leverage: true,
        currentIndex: true,
        closedTrades: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
    return NextResponse.json({ success: true, data: sessions });
  } catch (error: any) {
    console.error('Fetch backtest sessions API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      name,
      symbol,
      timeframe,
      dataSource,
      startDate,
      endDate,
      initialBalance,
      leverage,
      allCandles,
      currentIndex,
    } = body;

    if (!name || !symbol || !timeframe || !dataSource || initialBalance === undefined || !leverage) {
      return NextResponse.json(
        { success: false, error: 'Missing required session parameters' },
        { status: 400 }
      );
    }

    const session = await prisma.backtestSession.create({
      data: {
        name,
        symbol,
        timeframe,
        dataSource,
        startDate: startDate || null,
        endDate: endDate || null,
        initialBalance: parseFloat(initialBalance),
        currentBalance: parseFloat(initialBalance),
        leverage,
        currentIndex: Math.max(
          0,
          Math.floor(Number.isFinite(Number(currentIndex)) ? Number(currentIndex) : 49)
        ),
        allCandles: allCandles || [],
        openPositions: [],
        closedTrades: [],
        markers: [],
      },
    });

    return NextResponse.json({ success: true, data: session });
  } catch (error: any) {
    console.error('Create backtest session API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
