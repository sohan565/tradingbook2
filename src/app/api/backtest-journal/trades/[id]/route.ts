import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const trade = await prisma.backtestEntry.findUnique({
      where: { id },
    });

    if (!trade) {
      return NextResponse.json({ success: false, error: 'Trade not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: trade });
  } catch (error: any) {
    console.error('[Backtest Trade GET] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();

    const currentTrade = await prisma.backtestEntry.findUnique({
      where: { id },
    });

    if (!currentTrade) {
      return NextResponse.json({ success: false, error: 'Trade not found' }, { status: 404 });
    }

    const {
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
      confidence,
      executionRating,
      disciplineRating,
      patienceRating,
      psychologyRating,
      emotionBefore,
      emotionAfter,
      aiReview,
    } = body;

    const updated = await prisma.backtestEntry.update({
      where: { id },
      data: {
        tradeName,
        pair,
        direction,
        timeframe,
        entryPrice: entryPrice !== undefined ? (entryPrice ? parseFloat(entryPrice) : null) : undefined,
        stopLoss: stopLoss !== undefined ? (stopLoss ? parseFloat(stopLoss) : null) : undefined,
        takeProfit: takeProfit !== undefined ? (takeProfit ? parseFloat(takeProfit) : null) : undefined,
        riskReward: riskReward !== undefined ? (riskReward ? parseFloat(riskReward) : null) : undefined,
        pips: pips !== undefined ? (pips ? parseFloat(pips) : null) : undefined,
        pnl: pnl !== undefined ? (pnl ? parseFloat(pnl) : null) : undefined,
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
        confidence: confidence !== undefined ? (confidence ? parseFloat(confidence) : null) : undefined,
        executionRating: executionRating !== undefined ? (executionRating ? parseInt(executionRating) : null) : undefined,
        disciplineRating: disciplineRating !== undefined ? (disciplineRating ? parseInt(disciplineRating) : null) : undefined,
        patienceRating: patienceRating !== undefined ? (patienceRating ? parseInt(patienceRating) : null) : undefined,
        psychologyRating: psychologyRating !== undefined ? (psychologyRating ? parseInt(psychologyRating) : null) : undefined,
        emotionBefore,
        emotionAfter,
        aiReview,
      },
    });

    // Update parent record updatedAt
    await prisma.backtestRecord.update({
      where: { id: updated.backtestRecordId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('[Backtest Trade PUT] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const deleted = await prisma.backtestEntry.delete({
      where: { id },
    });

    // Update parent record updatedAt
    await prisma.backtestRecord.update({
      where: { id: deleted.backtestRecordId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ success: true, message: 'Trade deleted successfully' });
  } catch (error: any) {
    console.error('[Backtest Trade DELETE] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST to duplicate
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const sourceTrade = await prisma.backtestEntry.findUnique({
      where: { id },
    });

    if (!sourceTrade) {
      return NextResponse.json({ success: false, error: 'Source trade not found' }, { status: 404 });
    }

    const count = await prisma.backtestEntry.count({
      where: { backtestRecordId: sourceTrade.backtestRecordId },
    });
    const tradeNumber = count + 1;

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id: _, tradeNumber: __, createdAt: ___, updatedAt: ____, ...tradeData } = sourceTrade;

    const duplicatedTrade = await prisma.backtestEntry.create({
      data: {
        ...tradeData,
        tradeNumber,
      } as any,
    });

    // Update parent record updatedAt
    await prisma.backtestRecord.update({
      where: { id: sourceTrade.backtestRecordId },
      data: { updatedAt: new Date() },
    });

    return NextResponse.json({ success: true, data: duplicatedTrade });
  } catch (error: any) {
    console.error('[Backtest Trade Duplicate] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
