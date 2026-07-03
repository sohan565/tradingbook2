import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();

    // Convert seconds timestamps to JavaScript Date objects
    const entryTime = new Date(payload.entryTime * 1000);
    const exitTime = payload.exitTime ? new Date(payload.exitTime * 1000) : null;

    const trade = await prisma.tradeRecord.create({
      data: {
        id: payload.id || undefined, // use custom ID if provided (from backtester)
        symbol: payload.symbol,
        type: payload.type,
        lotSize: parseFloat(payload.lotSize) || 0.01,
        entryPrice: parseFloat(payload.entryPrice),
        entryTime,
        exitPrice: payload.exitPrice ? parseFloat(payload.exitPrice) : null,
        exitTime,
        stopLoss: payload.stopLoss ? parseFloat(payload.stopLoss) : null,
        takeProfit: payload.takeProfit ? parseFloat(payload.takeProfit) : null,
        pnl: payload.pnl !== undefined ? parseFloat(payload.pnl) : null,
        pnlPips: payload.pnlPips !== undefined ? parseFloat(payload.pnlPips) : null,
        commission: payload.commission !== undefined ? parseFloat(payload.commission) : 0,
        swap: payload.swap !== undefined ? parseFloat(payload.swap) : 0,
        status: payload.status || 'closed',
        source: payload.source || 'backtest',
        ticket: payload.ticket ? parseInt(payload.ticket) : null,
        magicNumber: payload.magicNumber ? parseInt(payload.magicNumber) : null,
        comment: payload.comment || null,
        notes: payload.notes || null,
        tags: payload.tags || [],
        screenshot: payload.screenshot || null,
      },
    });

    return NextResponse.json({ success: true, data: trade });
  } catch (error: any) {
    console.error('Create trade API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const dateStr = searchParams.get('date'); // YYYY-MM-DD
    const unlinkedOnly = searchParams.get('unlinked') === 'true';

    const where: any = {};
    
    if (status) {
      where.status = status;
    }

    if (unlinkedOnly) {
      where.journalEntryId = null;
    }

    if (dateStr) {
      const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);
      const endOfDay = new Date(`${dateStr}T23:59:59.999Z`);
      
      // Filter trades that either opened or closed on this calendar date
      where.OR = [
        {
          entryTime: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        {
          exitTime: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
      ];
    }

    const trades = await prisma.tradeRecord.findMany({
      where,
      include: {
        journalEntry: {
          select: {
            mood: true,
          },
        },
      },
      orderBy: {
        entryTime: 'desc',
      },
    });

    return NextResponse.json({ success: true, data: trades });
  } catch (error: any) {
    console.error('Fetch trades API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
