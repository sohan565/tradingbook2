import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    const { category, level, message } = await req.json();
    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const logCategory = category || 'REQUEST';
    const logLevel = (level || 'INFO').toUpperCase();

    if (logLevel === 'WARN') {
      logger.warn(logCategory, message);
    } else if (logLevel === 'ERROR') {
      logger.error(logCategory, message);
    } else {
      logger.info(logCategory, message);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
