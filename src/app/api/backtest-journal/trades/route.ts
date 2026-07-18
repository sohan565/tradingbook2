import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      backtestRecordId,
      tradeName,
      pair,
      direction,
      timeframe,
      entryPrice,
      stopLoss,
      takeProfit,
      riskReward,
      pips,
      pnl,
      outcome,
      tradeDate,
      tradeTime,
      session,
      levelsPlayed = [],
      confirmations = [],
      notes,
      mistakes = [],
      lessons,
      category,
      screenshot,
      charts = [],
      replayLink,
      tvLink,
      tags = [],
      confidence,
      executionRating,
      disciplineRating,
      patienceRating,
      psychologyRating,
      emotionBefore,
      emotionAfter,
      aiReview,
    } = body;

    if (!backtestRecordId || !pair || !direction || !outcome) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields (backtestRecordId, pair, direction, outcome)' },
        { status: 400 }
      );
    }

    // Auto-calculate trade number
    const count = await prisma.backtestEntry.count({
      where: { backtestRecordId },
    });
    const tradeNumber = count + 1;

    const trade = await prisma.backtestEntry.create({
      data: {
        backtestRecordId,
        tradeNumber,
        tradeName,
        pair,
        direction,
        timeframe,
        entryPrice: entryPrice ? parseFloat(entryPrice) : null,
        stopLoss: stopLoss ? parseFloat(stopLoss) : null,
        takeProfit: takeProfit ? parseFloat(takeProfit) : null,
        riskReward: riskReward ? parseFloat(riskReward) : null,
        pips: pips ? parseFloat(pips) : null,
        pnl: pnl ? parseFloat(pnl) : null,
        outcome,
        tradeDate,
        tradeTime,
        session,
        levelsPlayed,
        confirmations,
        notes,
        mistakes,
        lessons,
        category,
        screenshot,
        charts,
        replayLink,
        tvLink,
        tags,
        confidence: confidence ? parseFloat(confidence) : null,
        executionRating: executionRating ? parseInt(executionRating) : null,
        disciplineRating: disciplineRating ? parseInt(disciplineRating) : null,
        patienceRating: patienceRating ? parseInt(patienceRating) : null,
        psychologyRating: psychologyRating ? parseInt(psychologyRating) : null,
        emotionBefore,
        emotionAfter,
        aiReview,
      },
    });

    // Update parent record updatedAt
    await prisma.backtestRecord.update({
      where: { id: backtestRecordId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ success: true, data: trade });
  } catch (error: any) {
    console.error('[Backtest Trades POST] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
