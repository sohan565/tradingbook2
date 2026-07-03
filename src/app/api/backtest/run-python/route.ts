import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { csvPath, symbol, timeframe, initialBalance, leverage, sessionId, tzOffset } = body;

    if (!csvPath) {
      return NextResponse.json(
        { success: false, error: 'Missing parameter: csvPath' },
        { status: 400 }
      );
    }

    // Resolve CSV path
    let absoluteCsvPath = csvPath;
    if (!path.isAbsolute(csvPath)) {
      absoluteCsvPath = path.resolve(process.cwd(), '..', csvPath);
    }

    // Fallback search in working dir if not found relative to next app
    if (!fs.existsSync(absoluteCsvPath)) {
      absoluteCsvPath = path.resolve(process.cwd(), csvPath);
    }

    if (!fs.existsSync(absoluteCsvPath)) {
      return NextResponse.json(
        { success: false, error: `CSV file not found at: ${csvPath}` },
        { status: 400 }
      );
    }

    // Resolve backtester.py path
    const scriptPath = path.resolve(process.cwd(), '..', 'backtester.py');

    // Command arguments for headless python aggregator
    const pyArgs = [
      scriptPath,
      '--csv', absoluteCsvPath,
      '--symbol', symbol || 'XAUUSD',
      '--tf', timeframe || '15m',
      '--balance', (initialBalance || 10000).toString(),
      '--leverage', leverage || '1:100',
      '--headless'
    ];
    
    if (sessionId) {
      pyArgs.push('--session-id', sessionId);
    }

    if (tzOffset !== undefined && tzOffset !== null) {
      pyArgs.push('--tz-offset', tzOffset.toString());
    }

    console.log(`[Next.js API] Spawning Python aggregator: python ${pyArgs.join(' ')}`);

    // Spawn python process
    const pyProcess = spawn('python', pyArgs);

    let stderr = '';
    pyProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    let stdout = '';
    pyProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    const exitCode = await new Promise<number>((resolve) => {
      pyProcess.on('close', (code) => {
        resolve(code ?? 0);
      });
    });

    if (exitCode !== 0) {
      console.error(`Python aggregation failed with code ${exitCode}. Stderr: ${stderr}`);
      return NextResponse.json(
        { success: false, error: `Python aggregation failed: ${stderr || 'Unknown error'}` },
        { status: 500 }
      );
    }

    console.log('[Next.js API] Python aggregation succeeded:', stdout);

    return NextResponse.json({ 
      success: true, 
      message: 'Python aggregation and database sync completed successfully.' 
    });
  } catch (error: any) {
    console.error('Run python backtester API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
