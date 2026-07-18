import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const recordId = searchParams.get('recordId');

    if (!recordId) {
      return NextResponse.json({ success: false, error: 'recordId parameter is required' }, { status: 400 });
    }

    const record = await prisma.backtestRecord.findUnique({
      where: { id: recordId },
      include: {
        trades: {
          orderBy: {
            tradeNumber: 'asc',
          },
        },
      },
    });

    if (!record) {
      return NextResponse.json({ success: false, error: 'Record not found' }, { status: 404 });
    }

    // Prepare CSV Content
    const headers = [
      'Trade Number',
      'Trade Name',
      'Date',
      'Time',
      'Pair',
      'Direction',
      'Timeframe',
      'Entry Price',
      'Stop Loss',
      'Take Profit',
      'Pips',
      'PnL (R)',
      'Outcome',
      'Session',
      'Levels Played',
      'Confirmations',
      'Mistakes',
      'Execution Rating',
      'Discipline Rating',
      'Psychology Rating',
      'Emotion Before',
      'Emotion After',
      'Category',
      'Notes',
    ];

    const rows = record.trades.map(t => [
      t.tradeNumber,
      t.tradeName || `Trade #${t.tradeNumber}`,
      t.tradeDate || '',
      t.tradeTime || '',
      t.pair,
      t.direction,
      t.timeframe || '',
      t.entryPrice || '',
      t.stopLoss || '',
      t.takeProfit || '',
      t.pips || '',
      t.pnl || '',
      t.outcome,
      t.session || '',
      (t.levelsPlayed || []).join('; '),
      (t.confirmations || []).join('; '),
      (t.mistakes || []).join('; '),
      t.executionRating || '',
      t.disciplineRating || '',
      t.psychologyRating || '',
      t.emotionBefore || '',
      t.emotionAfter || '',
      t.category || '',
      (t.notes || '').replace(/"/g, '""'), // escape quotes
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(val => `"${val}"`).join(',')),
    ].join('\n');

    // Create a download response
    const filename = `${record.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_trades.csv`;
    
    return new NextResponse(csvContent, {
      headers: {
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': 'text/csv; charset=utf-8',
      },
    });
  } catch (error: any) {
    console.error('[Backtest Export GET] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
