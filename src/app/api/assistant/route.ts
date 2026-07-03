import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message, history = [] } = body;

    if (!message) {
      return NextResponse.json(
        { success: false, error: 'Message query is required' },
        { status: 400 }
      );
    }

    // 1. Resolve OpenRouter API Key (Server Env or fallback to user key)
    const apiKey = process.env.OPENROUTER_API_KEY || '';

    // 2. Fetch all journal entries from database
    const entries = await prisma.journalEntry.findMany({
      include: {
        trades: {
          orderBy: {
            entryTime: 'asc',
          },
        },
      },
      orderBy: {
        date: 'asc',
      },
    });

    // 3. Format entries into a unified text context
    const formattedContext = entries.map(entry => {
      const moodLabel = entry.mood ? entry.mood.toUpperCase() : 'NONE';
      const tradesStr = entry.trades.length > 0 
        ? entry.trades.map(t => `- [${t.type}] ${t.lotSize} Lots of ${t.symbol} @ ${t.entryPrice}${t.exitPrice ? ` (Exit: ${t.exitPrice})` : ''} | PnL: $${t.pnl ?? 0} | Pips: ${t.pnlPips ?? 0}`).join('\n')
        : 'No trades linked.';
      
      return `### Date: ${entry.date}
Title: ${entry.title || 'Untitled'}
Mood: ${moodLabel}
Pre-Session Plan:
${entry.preSessionPlan || 'No plan logged.'}
Daily Notes:
${entry.content || 'No notes logged.'}
Post-Session Review:
${entry.postSessionReview || 'No review logged.'}
Tags: ${entry.tags && entry.tags.length > 0 ? entry.tags.map(t => `#${t}`).join(' ') : 'None'}
Trades Executed:
${tradesStr}
----------------------------------------`;
    }).join('\n\n');

    // 4. Construct System Instruction block
    const systemInstructionText = `You are an expert Trading Performance Coach and Journal Analyzer.
You are provided with a complete history of the user's trading journal entries, including their moods, pre-session plans, notes, post-session reviews, linked trades, and performance tags.
Your goal is to help the trader review their performance, identify cognitive biases (such as revenge trading, overleveraging, anxiety, or cutting winners short), extract key learnings, find historical references, and answer questions based strictly on their journal context.

Use a professional, encouraging, and analytical tone. Refer to specific dates, trades, and notes when answering questions. If the user asks about something not in their journal, politely explain that you can only answer questions based on their trading journal entries.

Here is the trader's complete journal history:
========================================
${formattedContext || 'No journal entries have been created yet. Explain to the user how they can create their first daily entry.'}
========================================`;

    // 5. Build OpenRouter Messages Payload
    const openRouterMessages = [
      {
        role: 'system',
        content: systemInstructionText
      },
      ...history.map((msg: any) => ({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
        ...(msg.reasoning_details ? { reasoning_details: msg.reasoning_details } : {})
      })),
      {
        role: 'user',
        content: message
      }
    ];

    const targetUrl = 'https://openrouter.ai/api/v1/chat/completions';

    let response: Response | null = null;
    let lastErrorMsg = '';

    try {
      console.log(`[Journal Assistant] Trying NVIDIA API with nemotron-3-super-120b-a12b`);
      const nvResponse = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.NVIDIA_API_KEY || ''}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "nvidia/nemotron-3-super-120b-a12b",
          messages: openRouterMessages,
          temperature: 1,
          top_p: 0.95,
          chat_template_kwargs: { enable_thinking: true },
          reasoning_budget: 16384
        })
      });

      if (nvResponse.ok) {
        response = nvResponse;
        console.log(`[Journal Assistant] NVIDIA NIM response successful!`);
      } else {
        const nvErrText = await nvResponse.text();
        console.warn(`[Journal Assistant] NVIDIA API failed: ${nvErrText}`);
        lastErrorMsg = `NVIDIA API failed (${nvResponse.status}): ${nvErrText}`;
      }
    } catch (nvErr: any) {
      console.warn(`[Journal Assistant] NVIDIA API fetch error:`, nvErr);
      lastErrorMsg = `NVIDIA API fetch error: ${nvErr.message || nvErr}`;
    }

    if (!response) {
      console.log(`[Journal Assistant] Falling back to OpenRouter free models...`);
      const MODELS_TO_TRY = [
        "qwen/qwen3-coder:free",
        "google/gemini-2.5-flash:free",
        "meta-llama/llama-3.3-70b-instruct:free"
      ];

      for (const modelName of MODELS_TO_TRY) {
        try {
          console.log(`[Journal Assistant] Trying OpenRouter model: ${modelName}`);
          const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: modelName,
              messages: openRouterMessages,
              reasoning: modelName.includes('qwen') ? { enabled: true } : undefined
            }),
          });

          if (res.ok) {
            response = res;
            break;
          } else {
            const errText = await res.text();
            console.warn(`[Journal Assistant] Model ${modelName} failed with status ${res.status}: ${errText}`);
            lastErrorMsg = errText;
          }
        } catch (err: any) {
          console.warn(`[Journal Assistant] Fetch error on model ${modelName}:`, err);
          lastErrorMsg = err.message || err;
        }
      }
    }

    if (!response) {
      let parsedErr;
      try {
        parsedErr = JSON.parse(lastErrorMsg);
      } catch (e) {}

      const errMsg = parsedErr?.error?.message || lastErrorMsg || 'API dispatch failed';
      return NextResponse.json(
        { success: false, error: errMsg },
        { status: 500 }
      );
    }

    const resJson = await response.json();
    const replyText = resJson.choices?.[0]?.message?.content;
    const reasoningText = resJson.choices?.[0]?.message?.reasoning_details || resJson.choices?.[0]?.message?.reasoning;

    if (!replyText) {
      return NextResponse.json(
        { success: false, error: 'OpenRouter returned an empty response. Please verify prompt formatting.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      reply: replyText,
      reasoning_details: reasoningText || undefined
    });

  } catch (err: any) {
    console.error('[Assistant API Error]:', err);
    return NextResponse.json(
      { success: false, error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    hasKeyOnServer: true
  });
}

