import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const apiKey = req.headers.get('X-Api-Key');
    const payload = await req.json();

    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: 'Missing API Key in headers (X-Api-Key)' },
        { status: 401 }
      );
    }

    const {
      accountNumber,
      ticket,
      symbol,
      type,
      lotSize,
      entryPrice,
      entryTime,
      exitPrice,
      exitTime,
      stopLoss,
      takeProfit,
      pnl,
      pnlPips,
      commission,
      swap,
      status,
      comment,
      magicNumber,
    } = payload;

    if (!accountNumber || !ticket || !symbol) {
      return NextResponse.json(
        { success: false, error: 'Missing required payload parameters' },
        { status: 400 }
      );
    }

    // 1. Verify that the MTAccount exists, matches the API key, and is active
    const account = await prisma.mTAccount.findFirst({
      where: {
        accountNumber: String(accountNumber),
        apiKey: apiKey,
        isActive: true,
      },
    });

    if (!account) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized or inactive MT5 Account link' },
        { status: 403 }
      );
    }

    // Convert Unix timestamp seconds to JS Date objects
    const entryDate = new Date(entryTime * 1000);
    const exitDate = exitTime ? new Date(exitTime * 1000) : null;

    // 2. Look for an existing trade with this ticket under mt5 source
    const existingTrade = await prisma.tradeRecord.findFirst({
      where: {
        ticket: parseInt(ticket),
        source: 'mt5',
        symbol: symbol,
      },
    });

    let trade;
    if (existingTrade) {
      // Update existing position (e.g. updating entry to closed status with P&L)
      trade = await prisma.tradeRecord.update({
        where: { id: existingTrade.id },
        data: {
          exitPrice: exitPrice ? parseFloat(exitPrice) : null,
          exitTime: exitDate,
          stopLoss: stopLoss ? parseFloat(stopLoss) : null,
          takeProfit: takeProfit ? parseFloat(takeProfit) : null,
          pnl: pnl !== undefined ? parseFloat(pnl) : null,
          pnlPips: pnlPips !== undefined ? parseFloat(pnlPips) : null,
          commission: commission !== undefined ? parseFloat(commission) : 0,
          swap: swap !== undefined ? parseFloat(swap) : 0,
          status: status || 'closed',
          comment: comment || null,
        },
      });
    } else {
      // Create new trade log
      trade = await prisma.tradeRecord.create({
        data: {
          symbol: symbol,
          type: type,
          lotSize: parseFloat(lotSize) || 0.01,
          entryPrice: parseFloat(entryPrice),
          entryTime: entryDate,
          exitPrice: exitPrice ? parseFloat(exitPrice) : null,
          exitTime: exitDate,
          stopLoss: stopLoss ? parseFloat(stopLoss) : null,
          takeProfit: takeProfit ? parseFloat(takeProfit) : null,
          pnl: pnl !== undefined ? parseFloat(pnl) : null,
          pnlPips: pnlPips !== undefined ? parseFloat(pnlPips) : null,
          commission: commission !== undefined ? parseFloat(commission) : 0,
          swap: swap !== undefined ? parseFloat(swap) : 0,
          status: status || 'closed',
          source: 'mt5',
          ticket: parseInt(ticket),
          magicNumber: magicNumber ? parseInt(magicNumber) : null,
          comment: comment || null,
          tags: [],
        },
      });
    }

    // 3. Update the account's last sync time
    await prisma.mTAccount.update({
      where: { id: account.id },
      data: { lastSyncAt: new Date() },
    });

    return NextResponse.json({ success: true, data: trade });
  } catch (error: any) {
    console.error('MT5 Webhook endpoint error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
