import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { image, googleApiKey } = await req.json();

    if (!image) {
      return NextResponse.json({ success: false, error: 'Image base64 data is required' }, { status: 400 });
    }

    const apiKey = googleApiKey || process.env.GEMINI_API_KEY || '';
    if (!apiKey) {
      return NextResponse.json({
        success: false,
        error: 'Google AI Pro API Key is required. Please add it in settings or provide it in the request.'
      }, { status: 400 });
    }

    // Parse base64
    const matches = image.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return NextResponse.json({ success: false, error: 'Invalid base64 image format' }, { status: 400 });
    }

    const mimeType = matches[1];
    const base64Data = matches[2];

    const prompt = `Analyze this TradingView chart screenshot containing a Long or Short Position tool.
Extract the following parameters and return them in structured JSON format. 
If any field is not visible, obscured, or cannot be determined with high confidence, set it to null instead of guessing.

Required JSON Structure:
{
  "tradeDirection": "LONG" | "SHORT" | null,
  "pair": string | null, // e.g. "XAUUSD", "EURUSD", "BTCUSD" (look for the symbol name at the top-left of the chart)
  "timeframe": string | null, // e.g. "15m", "5m", "1h", "4h" (look at the timeframe selector at the top-left)
  "entryPrice": number | null, // The entry price (the middle line price of the position tool)
  "stopLoss": number | null, // The stop loss price
  "takeProfit": number | null, // The take profit price
  "riskReward": number | null, // Risk to reward ratio (e.g. 2.18, usually written inside the center bubble)
  "tradeDate": string | null, // Format YYYY-MM-DD (check x-axis timestamp labels for the candles or active trade time)
  "tradeTime": string | null, // Format HH:MM (check x-axis timestamps)
  "pips": number | null, // Number of pips won or lost (e.g. 46.73, check the target/stop bubbles or labels)
  "outcome": "WIN" | "LOSS" | "BREAKEVEN" | null, // WIN if target was hit (green/profit bubble), LOSS if stopped out (red/loss bubble)
  "session": "Asian" | "London" | "New York" | null, // Determine based on tradeTime if UTC+5:30 or NY time is shown, else null
  "notes": string | null, // Any OCR text annotations or indicator names visible on chart
  "confidenceScore": number // Overall confidence score for the extraction between 0.0 and 1.0
}`;

    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(geminiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              {
                inlineData: {
                  mimeType,
                  data: base64Data,
                },
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
        },
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[Gemini Vision API Error]:', errText);
      return NextResponse.json({ success: false, error: `Gemini API Error: ${response.statusText}` }, { status: response.status });
    }

    const resultJson = await response.json();
    const candidateText = resultJson.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!candidateText) {
      return NextResponse.json({ success: false, error: 'Gemini did not return any parseable content.' }, { status: 500 });
    }

    try {
      const extractedData = JSON.parse(candidateText.trim());
      return NextResponse.json({ success: true, data: extractedData });
    } catch (e: any) {
      console.error('[Gemini JSON Parse Error]:', candidateText);
      return NextResponse.json({ success: false, error: 'Failed to parse Gemini output as structured JSON' }, { status: 500 });
    }
  } catch (error: any) {
    console.error('[Backtest Analyze POST] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
