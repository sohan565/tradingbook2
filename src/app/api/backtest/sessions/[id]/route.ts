import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await prisma.backtestSession.findUnique({
      where: { id },
    });

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'Session not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: session });
  } catch (error: any) {
    console.error('Fetch backtest session detail API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    
    const {
      currentBalance,
      currentIndex,
      allCandles,
      openPositions,
      closedTrades,
      markers,
      drawings,
      activeIndicators,
      timeframe,
    } = body;

    let session;
    try {
      session = await prisma.backtestSession.update({
        where: { id },
        data: {
          currentBalance: currentBalance !== undefined ? parseFloat(currentBalance) : undefined,
          currentIndex: currentIndex !== undefined ? parseInt(currentIndex) : undefined,
          allCandles: allCandles !== undefined ? allCandles : undefined,
          openPositions: openPositions !== undefined ? openPositions : undefined,
          closedTrades: closedTrades !== undefined ? closedTrades : undefined,
          markers: markers !== undefined ? markers : undefined,
          drawings: drawings !== undefined ? drawings : undefined,
          activeIndicators: activeIndicators !== undefined ? activeIndicators : undefined,
          timeframe: timeframe !== undefined ? timeframe : undefined,
        },
      });
    } catch (updateErr: any) {
      // P2025 = record not found (session may have been deleted before auto-save fired)
      if (updateErr.code === 'P2025') {
        return NextResponse.json(
          { success: false, error: 'Session no longer exists (was deleted).' },
          { status: 404 }
        );
      }
      throw updateErr; // re-throw any other error
    }

    return NextResponse.json({ success: true, data: session });
  } catch (error: any) {
    console.error('Update backtest session API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await prisma.backtestSession.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Session deleted successfully' });
  } catch (error: any) {
    console.error('Delete backtest session API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
