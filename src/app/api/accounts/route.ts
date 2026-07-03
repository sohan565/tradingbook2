import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import crypto from 'crypto';

export async function GET() {
  try {
    const accounts = await prisma.mTAccount.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
    return NextResponse.json({ success: true, data: accounts });
  } catch (error: any) {
    console.error('Fetch accounts API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const { accountNumber, broker, serverName } = payload;

    if (!accountNumber || !broker) {
      return NextResponse.json(
        { success: false, error: 'Account number and broker name are required' },
        { status: 400 }
      );
    }

    // Generate a secure API Key
    const apiKey = crypto.randomUUID();

    const account = await prisma.mTAccount.create({
      data: {
        accountNumber: String(accountNumber),
        broker,
        serverName: serverName || null,
        apiKey,
        isActive: true,
      },
    });

    return NextResponse.json({ success: true, data: account });
  } catch (error: any) {
    console.error('Create account API error:', error);
    
    // Prisma Unique Constraint Violation code
    if (error.code === 'P2002') {
      return NextResponse.json(
        { success: false, error: 'This account number is already registered' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing account ID parameter' },
        { status: 400 }
      );
    }

    await prisma.mTAccount.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete account API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
export async function PUT(req: NextRequest) {
  try {
    const payload = await req.json();
    const { id, isActive } = payload;

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Missing account ID parameter' },
        { status: 400 }
      );
    }

    const updatedAccount = await prisma.mTAccount.update({
      where: { id },
      data: {
        isActive: isActive,
      },
    });

    return NextResponse.json({ success: true, data: updatedAccount });
  } catch (error: any) {
    console.error('Update account API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
