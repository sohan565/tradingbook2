import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const records = await prisma.backtestRecord.findMany({
      include: {
        trades: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    const formattedRecords = records.map(record => {
      const trades = record.trades;
      const totalTrades = trades.length;

      let wins = 0;
      let losses = 0;
      let breakevens = 0;
      let netR = 0;
      let netPips = 0;
      let totalRR = 0;
      let winningR = 0;
      let losingR = 0;

      trades.forEach(t => {
        const outcome = t.outcome.toUpperCase();
        if (outcome === 'WIN') {
          wins++;
          winningR += t.pnl || 0;
        } else if (outcome === 'LOSS') {
          losses++;
          losingR += Math.abs(t.pnl || 0);
        } else {
          breakevens++;
        }

        netR += t.pnl || 0;
        netPips += t.pips || 0;
        totalRR += t.riskReward || 0;
      });

      const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
      const avgRR = totalTrades > 0 ? totalRR / totalTrades : 0;
      const profitFactor = losingR > 0 ? winningR / losingR : winningR > 0 ? 999 : 0;

      return {
        id: record.id,
        name: record.name,
        description: record.description,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
        totalTrades,
        winRate: parseFloat(winRate.toFixed(1)),
        netR: parseFloat(netR.toFixed(2)),
        netPips: parseFloat(netPips.toFixed(1)),
        avgRR: parseFloat(avgRR.toFixed(2)),
        profitFactor: parseFloat(profitFactor.toFixed(2)),
      };
    });

    return NextResponse.json({ success: true, data: formattedRecords });
  } catch (error: any) {
    console.error('[Backtest Records GET] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: 'Record name is required' }, { status: 400 });
    }

    const record = await prisma.backtestRecord.create({
      data: {
        name,
        description,
      },
    });

    return NextResponse.json({ success: true, data: record });
  } catch (error: any) {
    console.error('[Backtest Records POST] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
