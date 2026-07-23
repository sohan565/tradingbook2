import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { stats, recentTrades = [], sourceName = 'All Sources', history = [] } = body;

    if (!stats) {
      return NextResponse.json(
        { success: false, error: 'Stats payload is required' },
        { status: 400 }
      );
    }

    // 1. Resolve OpenRouter API Key
    const apiKey = process.env.OPENROUTER_API_KEY || '';

    // 2. Format trades summary safely
    const fmt = (val: any, decimals: number = 2) => {
      if (val === null || val === undefined || isNaN(Number(val))) return '0.00';
      return Number(val).toFixed(decimals);
    };

    const fmtPct = (val: any, decimals: number = 1) => {
      if (val === null || val === undefined || isNaN(Number(val))) return '0.0';
      return (Number(val) * 100).toFixed(decimals);
    };

    const formatDate = (ts: any) => {
      if (!ts) return 'N/A';
      try {
        const numTs = Number(ts);
        if (isNaN(numTs)) return 'N/A';
        const dateObj = new Date(numTs > 10000000000 ? numTs : numTs * 1000);
        return dateObj.toISOString().replace('T', ' ').substring(0, 16) + ' UTC';
      } catch (e) {
        return 'N/A';
      }
    };

    const tradesSummary = recentTrades.slice(0, 10).map((t: any) => {
      const typeLabel = t.type || 'TRADE';
      const pnlFormatted = t.pnl !== undefined && t.pnl !== null ? `$${fmt(t.pnl)}` : 'N/A';
      const pipsFormatted = t.pnlPips !== undefined && t.pnlPips !== null ? `${fmt(t.pnlPips, 1)} pips` : 'N/A';
      const openedStr = formatDate(t.entryTime);
      const closedStr = formatDate(t.exitTime);
      return `- [${typeLabel}] ${t.lotSize || 0.01} Lots of ${t.symbol} | PnL: ${pnlFormatted} | Pips: ${pipsFormatted} | Opened: ${openedStr} | Closed: ${closedStr} | Tags: ${t.tags?.join(', ') || 'None'}`;
    }).join('\n');

    // Resolve profit factor (Infinity maps to null in JSON stringify)
    const pfStr = (stats.profitFactor === null || stats.profitFactor === undefined)
      ? (stats.grossLoss === 0 && stats.grossProfit > 0 ? 'Infinity' : 'N/A')
      : Number(stats.profitFactor).toFixed(2);

    // 3. Construct system prompt containing context
    const systemPrompt = `You are a world-class Trading Coach and Performance Analyst. You analyze mathematical trading records to identify leaks, behavioral strengths, and mathematical trade advice. You format your output in clean, professional markdown.

Here is the user's trading profile and data that you are coaching:
### SOURCE PROFILE: ${sourceName}
### STATISTICS SUMMARY:
- Total Trades Executed: ${stats.totalTrades || 0}
- Win Rate: ${fmtPct(stats.winRate)}%
- Total Net Profit: $${fmt(stats.netPnl)}
- Profit Factor: ${pfStr}
- Gross Profit: $${fmt(stats.grossProfit)}
- Gross Loss: $${fmt(stats.grossLoss)}
- Average Win: $${fmt(stats.avgWin)}
- Average Loss: $${fmt(stats.avgLoss)}
- Largest Win: $${fmt(stats.bestTrade)}
- Largest Loss: $${fmt(stats.worstTrade)}
- Max Drawdown: $${fmt(stats.maxDrawdown)} (${fmtPct(stats.maxDrawdownPercent)}%)

### RECENT TRADES DETAIL:
${tradesSummary || 'No recent trades history available.'}

Keep this performance profile in mind when responding to all questions. Make your tone direct, professional, and performance-oriented. Avoid fluff.`;

    const messages = [
      {
        role: 'system',
        content: systemPrompt
      }
    ];

    if (history.length === 0) {
      messages.push({
        role: 'user',
        content: `Analyze this performance thoroughly as a senior trading coach. Provide a detailed markdown response containing:
1. **📊 Strengths**: Highlight what is working well (e.g. win rate, risk-reward ratio, hold execution, specific asset performance).
2. **⚠️ Weaknesses & Leaks**: Point out potential risks (e.g. oversized losses, high drawdown, overtrading, poor risk-to-reward ratio).
3. **🎯 Actionable Coaching Steps**: Provide 3-4 specific, mathematically backed suggestions to improve this performance. Keep suggestions practical and direct.`
      });
    } else {
      history.forEach((h: any) => {
        messages.push({
          role: h.role === 'assistant' ? 'assistant' : 'user',
          content: h.content
        });
      });
    }

    let response: Response | null = null;
    let lastErrorMsg = '';

    const MODELS_TO_TRY = [
      "google/gemini-2.0-flash-thinking-exp:free",
      "google/gemini-2.0-flash-001",
      "google/gemini-2.0-pro-exp-02-05:free",
      "google/gemini-2.5-flash:free",
      "qwen/qwen3-coder:free",
      "meta-llama/llama-3.3-70b-instruct:free"
    ];

    // 1. Try Gemini models & OpenRouter first for maximum efficiency and speed
    for (const modelName of MODELS_TO_TRY) {
      try {
        console.log(`[AI Coach] Trying primary model: ${modelName}`);
        const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            "model": modelName,
            "messages": messages,
            reasoning: modelName.includes('thinking') || modelName.includes('qwen') ? { enabled: true } : undefined
          })
        });

        if (res.ok) {
          response = res;
          console.log(`[AI Coach] Model ${modelName} response successful!`);
          break;
        } else {
          const errText = await res.text();
          console.warn(`[AI Coach] Model ${modelName} failed with status ${res.status}: ${errText}`);
          lastErrorMsg = errText;
        }
      } catch (err: any) {
        console.warn(`[AI Coach] Fetch error on model ${modelName}:`, err);
        lastErrorMsg = err.message || err;
      }
    }

    // 2. If Gemini/OpenRouter fails, try NVIDIA NIM as high-capacity fallback
    if (!response && process.env.NVIDIA_API_KEY) {
      try {
        console.log(`[AI Coach] Trying NVIDIA NIM API fallback with nemotron-3-super-120b-a12b`);
        const nvResponse = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.NVIDIA_API_KEY || ''}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            model: "nvidia/nemotron-3-super-120b-a12b",
            messages: messages,
            temperature: 1,
            top_p: 0.95,
            chat_template_kwargs: { enable_thinking: true },
            reasoning_budget: 16384
          })
        });

        if (nvResponse.ok) {
          response = nvResponse;
          console.log(`[AI Coach] NVIDIA NIM response successful!`);
        } else {
          const nvErrText = await nvResponse.text();
          console.warn(`[AI Coach] NVIDIA API failed: ${nvErrText}`);
          lastErrorMsg = `NVIDIA API failed (${nvResponse.status}): ${nvErrText}`;
        }
      } catch (nvErr: any) {
        console.warn(`[AI Coach] NVIDIA API fetch error:`, nvErr);
        lastErrorMsg = `NVIDIA API fetch error: ${nvErr.message || nvErr}`;
      }
    }

    if (!response) {
      throw new Error(lastErrorMsg || 'All models failed to resolve.');
    }

    const result = await response.json();
    const answer = result.choices[0].message.content;

    return NextResponse.json({ success: true, data: answer });
  } catch (error: any) {
    console.error('AI Analytics API error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
