import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserFromSession } from '@/lib/auth-verify';
import { callGemini } from '@/lib/gemini';

export async function POST(request: NextRequest) {
  try {
    const { tradeId, apiKey } = await request.json();

    if (!tradeId) {
      return NextResponse.json({ error: 'Trade ID is required' }, { status: 400 });
    }

    const isMock = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
                   process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-supabase-project');
    const activeKey = apiKey || process.env.GEMINI_API_KEY;

    // 1. Handle Mock Mode or Missing API Key
    if (isMock || !activeKey) {
      const grades = ['A+', 'A', 'B', 'C', 'D', 'F'];
      const randomGrade = grades[Math.floor(Math.random() * grades.length)];
      
      const mockResult = {
        success: true,
        isMockMode: true,
        analysis: {
          grade: randomGrade,
          strengths: [
            'Followed proper session liquidity patterns.',
            'Risk-to-reward ratio is mathematically positive.',
            'Entry had confluence from H4 support structure.'
          ],
          weaknesses: [
            randomGrade === 'D' || randomGrade === 'F' ? 'Moved stop loss mid-trade in panic.' : 'Exited slightly before the target, leaving profit on the table.',
            'Executed trade during high-volatility news window.'
          ],
          suggestions: [
            'Establish a hard hands-off rule once trade is running.',
            'Focus entries exclusively during London session peak hours.',
            'Set alerts at key zones rather than staring at live ticks.'
          ]
        }
      };
      
      await new Promise(resolve => setTimeout(resolve, 1200));
      return NextResponse.json(mockResult);
    }

    // 2. Real DB Flow
    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const supabase = createAdminClient();

    const { data: trade, error: tradeError } = await supabase
      .from('trades')
      .select('*')
      .eq('id', tradeId)
      .single();

    if (tradeError || !trade) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    // 3. Invoke Google Gemini Content Generation
    const systemInstruction = 'You are an AI Trading Mentor that provides objective, JSON-structured feedback on trading process execution.';

    const prompt = `
You are an elite Prop Firm Risk Officer and Cognitive Performance Coach.
Analyze the execution quality of the following trade setup:

Pair: ${trade.pair}
Direction: ${trade.direction}
Session: ${trade.session}
Entry Price: ${trade.entry_price}
Exit Price: ${trade.exit_price || 'N/A'}
Stop Loss: ${trade.stop_loss}
Take Profit: ${trade.take_profit}
Lot Size: ${trade.lot_size}
Profit/Loss (PnL): ${trade.pnl || 0}
Duration: ${trade.duration_seconds ? Math.floor(trade.duration_seconds / 60) + ' minutes' : 'N/A'}
Setup Tags: ${trade.setup_tags ? trade.setup_tags.join(', ') : 'None'}
User Journal Notes: "${trade.notes || 'No notes entered'}"

Analyze:
1. Risk to Reward Ratio (Realistic parameters?).
2. Session timing and trade duration logic.
3. Execution quality and emotional indicators from the notes.

Respond STRICTLY with a JSON object. Ensure the format matches:
{
  "grade": "A+" | "A" | "B" | "C" | "D" | "F",
  "strengths": ["string"],
  "weaknesses": ["string"],
  "suggestions": ["string"]
}
`;

    const rawJson = await callGemini(prompt, systemInstruction, activeKey);
    const parsedAnalysis = JSON.parse(rawJson);

    // Save Analysis to DB
    const { error: insertError } = await supabase
      .from('trade_analyses')
      .upsert({
        trade_id: tradeId,
        grade: parsedAnalysis.grade,
        strengths: parsedAnalysis.strengths,
        weaknesses: parsedAnalysis.weaknesses,
        suggestions: parsedAnalysis.suggestions,
        raw_response: parsedAnalysis
      }, { onConflict: 'trade_id' });

    if (insertError) {
      console.error('Database write error for AI Analysis:', insertError);
    }

    return NextResponse.json({
      success: true,
      analysis: parsedAnalysis
    });

  } catch (err: any) {
    console.error('AI Analysis Route error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error.' }, { status: 500 });
  }
}
