import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const { backtestRecordId, message, history = [], googleApiKey } = await req.json();

    if (!backtestRecordId || !message) {
      return NextResponse.json({ success: false, error: 'Missing backtestRecordId or message' }, { status: 400 });
    }

    const apiKey = googleApiKey || process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'Google AI Pro API Key is required.'
      }, { status: 400 });
    }

    // Fetch the backtest record and trades
    const record = await prisma.backtestRecord.findUnique({
      where: { id: backtestRecordId },
      include: { trades: true },
    });

    if (!record) {
      return NextResponse.json({ success: false, error: 'Backtest record not found' }, { status: 404 });
    }

    // Format trade statistics context for the AI Coach
    const trades = record.trades;
    const totalTrades = trades.length;

    let wins = 0;
    let losses = 0;
    let breakevens = 0;
    let netR = 0;
    let netPips = 0;
    let winningR = 0;
    let losingR = 0;
    const pairStats: Record<string, { count: number; wins: number; pnl: number }> = {};
    const confirmationStats: Record<string, { count: number; wins: number; pnl: number }> = {};
    const levelStats: Record<string, { count: number; wins: number; pnl: number }> = {};
    const sessionStats: Record<string, { count: number; wins: number; pnl: number }> = {};
    const mistakeFrequencies: Record<string, number> = {};

    trades.forEach(t => {
      const outcome = t.outcome.toUpperCase();
      const isWin = outcome === 'WIN';
      const isLoss = outcome === 'LOSS';
      const pnlR = t.pnl || 0;
      const pips = t.pips || 0;

      if (isWin) {
        wins++;
        winningR += pnlR;
      } else if (isLoss) {
        losses++;
        losingR += Math.abs(pnlR);
      } else {
        breakevens++;
      }

      netR += pnlR;
      netPips += pips;

      // Pair performance
      const p = t.pair.toUpperCase();
      if (!pairStats[p]) pairStats[p] = { count: 0, wins: 0, pnl: 0 };
      pairStats[p].count++;
      if (isWin) pairStats[p].wins++;
      pairStats[p].pnl += pnlR;

      // Session performance
      const s = t.session || 'Unknown';
      if (!sessionStats[s]) sessionStats[s] = { count: 0, wins: 0, pnl: 0 };
      sessionStats[s].count++;
      if (isWin) sessionStats[s].wins++;
      sessionStats[s].pnl += pnlR;

      // Confirmations
      t.confirmations.forEach(c => {
        if (!confirmationStats[c]) confirmationStats[c] = { count: 0, wins: 0, pnl: 0 };
        confirmationStats[c].count++;
        if (isWin) confirmationStats[c].wins++;
        confirmationStats[c].pnl += pnlR;
      });

      // Levels
      t.levelsPlayed.forEach(l => {
        if (!levelStats[l]) levelStats[l] = { count: 0, wins: 0, pnl: 0 };
        levelStats[l].count++;
        if (isWin) levelStats[l].wins++;
        levelStats[l].pnl += pnlR;
      });

      // Mistakes
      t.mistakes.forEach(m => {
        mistakeFrequencies[m] = (mistakeFrequencies[m] || 0) + 1;
      });
    });

    // Format metrics summaries
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const profitFactor = losingR > 0 ? winningR / losingR : winningR > 0 ? 999 : 0;

    const formattedTrades = trades.map(t => (
      `Trade #${t.tradeNumber}: [${t.outcome}] ${t.direction} ${t.pair} on ${t.tradeDate || 'Unknown'} | PnL: ${t.pnl || 0}R | Pips: ${t.pips || 0} | Session: ${t.session || 'N/A'} | Levels: ${t.levelsPlayed.join(', ') || 'None'} | Confirmations: ${t.confirmations.join(', ') || 'None'} | Mistakes: ${t.mistakes.join(', ') || 'None'}`
    )).join('\n');

    const contextText = `
You are a professional Trading Performance Coach. You have full access to the user's trade entries and performance metrics for the backtest project: "${record.name}" (${record.description || 'No description'}).
Your goal is to provide data-driven feedback, identify cognitive biases, critique execution quality, point out rule violations, and suggest custom adjustments based strictly on the user's data.

### Backtest Summary:
- Project Name: ${record.name}
- Total Trades: ${totalTrades}
- Wins: ${wins} | Losses: ${losses} | Breakevens: ${breakevens}
- Win Rate: ${winRate.toFixed(1)}%
- Profit Factor: ${profitFactor.toFixed(2)}
- Net PnL (R-multiple): ${netR.toFixed(2)}R
- Net Pips: ${netPips.toFixed(1)}

### Performance Breakdown by Pair:
${Object.entries(pairStats).map(([p, s]) => `- ${p}: ${s.count} trades, ${(s.wins / s.count * 100).toFixed(1)}% WR, Net PnL: ${s.pnl.toFixed(2)}R`).join('\n')}

### Performance Breakdown by Session:
${Object.entries(sessionStats).map(([sess, s]) => `- ${sess}: ${s.count} trades, ${(s.wins / s.count * 100).toFixed(1)}% WR, Net PnL: ${s.pnl.toFixed(2)}R`).join('\n')}

### Top Confirmations:
${Object.entries(confirmationStats).map(([c, s]) => `- ${c}: ${s.count} trades, ${(s.wins / s.count * 100).toFixed(1)}% WR, Net PnL: ${s.pnl.toFixed(2)}R`).join('\n')}

### Top Levels Played:
${Object.entries(levelStats).map(([l, s]) => `- ${l}: ${s.count} trades, ${(s.wins / s.count * 100).toFixed(1)}% WR, Net PnL: ${s.pnl.toFixed(2)}R`).join('\n')}

### Frequent Mistakes:
${Object.entries(mistakeFrequencies).map(([m, f]) => `- ${m}: occurred ${f} times`).join('\n')}

### Detailed Trade Entries:
${formattedTrades || 'No trade entries have been added to this backtest record yet.'}
`;

    const systemInstruction = `You are the AI Performance Coach for the trading backtest project: "${record.name}".
Use the provided statistical breakdowns, trade entries list, and performance metrics to answer the user's questions. 
Be highly specific, direct, and data-driven. Do not give generic trading advice. Instead, quote specific statistics, tell the user exactly which confirmations/levels/sessions perform best or worst for them, highlight their most frequent mistakes, and calculate their real strengths and weaknesses based on the provided trade history.

Tone: Analytical, constructive, motivating, and professional.
`;

    // Map history to Gemini format
    const formattedContents = history.map((msg: any) => ({
      role: msg.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: msg.content }]
    }));

    // Add current user prompt
    formattedContents.push({
      role: 'user',
      parts: [{ text: `${contextText}\n\nUser Question: ${message}` }]
    });

    const GEMINI_MODELS = [
      'gemini-2.0-flash',
      'gemini-2.0-flash-thinking-exp',
      'gemini-2.0-pro-exp',
      'gemini-1.5-flash'
    ];

    let response: Response | null = null;
    let lastErrText = '';

    for (const modelName of GEMINI_MODELS) {
      try {
        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
        const res = await fetch(geminiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemInstruction }]
            },
            contents: formattedContents,
          }),
        });

        if (res.ok) {
          response = res;
          console.log(`[Backtest Coach] Model ${modelName} response successful!`);
          break;
        } else {
          lastErrText = await res.text();
          console.warn(`[Backtest Coach] Model ${modelName} failed with status ${res.status}: ${lastErrText}`);
        }
      } catch (err: any) {
        console.warn(`[Backtest Coach] Fetch error on ${modelName}:`, err);
        lastErrText = err.message || String(err);
      }
    }

    if (!response) {
      console.error('[Gemini Coach API Error]:', lastErrText);
      return NextResponse.json({ success: false, error: `Gemini API Error: ${lastErrText}` }, { status: 500 });
    }

    const resultJson = await response.json();
    const reply = resultJson.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!reply) {
      return NextResponse.json({ success: false, error: 'Gemini did not return any reply' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: reply });
  } catch (error: any) {
    console.error('[Backtest Coach POST] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
