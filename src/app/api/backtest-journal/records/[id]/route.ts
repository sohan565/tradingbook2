import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const record = await prisma.backtestRecord.findUnique({
      where: { id },
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

    return NextResponse.json({ success: true, data: record });
  } catch (error: any) {
    console.error('[Backtest Record GET] Error:', error);
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
    const { name, description } = body;

    if (!name) {
      return NextResponse.json({ success: false, error: 'Record name is required' }, { status: 400 });
    }

    const updated = await prisma.backtestRecord.update({
      where: { id },
      data: {
        name,
        description,
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error: any) {
    console.error('[Backtest Record PUT] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await prisma.backtestRecord.delete({
      where: { id },
    });

    return NextResponse.json({ success: true, message: 'Record deleted successfully' });
  } catch (error: any) {
    console.error('[Backtest Record DELETE] Error:', error);
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

    const sourceRecord = await prisma.backtestRecord.findUnique({
      where: { id },
      include: { trades: true },
    });

    if (!sourceRecord) {
      return NextResponse.json({ success: false, error: 'Source record not found' }, { status: 404 });
    }

    // Create duplicated record
    const duplicatedRecord = await prisma.backtestRecord.create({
      data: {
        name: `Copy of ${sourceRecord.name}`,
        description: sourceRecord.description,
      },
    });

    // Copy all trades
    if (sourceRecord.trades.length > 0) {
      const tradeCreates = sourceRecord.trades.map(t => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { id: _, backtestRecordId: __, createdAt: ___, updatedAt: ____, ...tradeData } = t;
        return {
          ...tradeData,
          backtestRecordId: duplicatedRecord.id,
        };
      });

      await prisma.backtestEntry.createMany({
        data: tradeCreates as any,
      });
    }

    return NextResponse.json({ success: true, data: duplicatedRecord });
  } catch (error: any) {
    console.error('[Backtest Record Duplicate] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
