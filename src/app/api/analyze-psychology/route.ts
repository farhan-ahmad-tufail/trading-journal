import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserFromSession } from '@/lib/auth-verify';
import { callGemini } from '@/lib/gemini';

export async function POST(request: NextRequest) {
  try {
    const { accountId, apiKey } = await request.json();

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    const isMock = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
                   process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-supabase-project');
    const activeKey = apiKey || process.env.GEMINI_API_KEY;

    // 1. Check Mock Mode or Missing API Key
    if (isMock || !activeKey) {
      const mockResult = {
        success: true,
        isMockMode: true,
        snapshot: {
          psychology_score: 78,
          discipline_score: 82,
          confidence_score: 85,
          revenge_trading_prob: 15.0,
          overtrading_prob: 20.0,
          fomo_prob: 30.0,
          rule_violations: ['Position Leverage Volatility'],
          assessment_notes: 'Your psychological control is stable. You have shown restraint following your recent winning trades. However, there is a minor variance in lot sizes (0.5 to 1.5 lots) which indicates slight risk inconsistency. Focus on uniform positioning.'
        }
      };

      await new Promise(resolve => setTimeout(resolve, 1500));
      return NextResponse.json(mockResult);
    }

    // 2. Real Database Flow
    const user = await getUserFromSession(request);

    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Fetch last 15 trades
    const { data: trades, error: tradesError } = await supabase
      .from('trades')
      .select('*')
      .eq('account_id', accountId)
      .order('open_time', { ascending: false })
      .limit(15);

    if (tradesError) {
      return NextResponse.json({ error: 'Failed to retrieve recent trades' }, { status: 500 });
    }

    // Fetch last 5 daily reflections
    const { data: reflections, error: reflectionsError } = await supabase
      .from('daily_reflections')
      .select('*')
      .eq('user_id', user.id)
      .order('reflection_date', { ascending: false })
      .limit(5);

    if (reflectionsError) {
      return NextResponse.json({ error: 'Failed to retrieve reflections' }, { status: 500 });
    }

    // 3. Compute Heuristic Indicators
    const tradesByDay: Record<string, number> = {};
    trades.forEach((t: any) => {
      const day = t.open_time.split('T')[0];
      tradesByDay[day] = (tradesByDay[day] || 0) + 1;
    });
    const highFrequencyDays = Object.values(tradesByDay).filter(c => c > 4).length;
    
    let revengeCount = 0;
    const sortedTrades = [...trades]
      .filter((t: any) => t.status === 'CLOSED' && t.close_time)
      .sort((a, b) => new Date(a.open_time).getTime() - new Date(b.open_time).getTime());

    for (let i = 1; i < sortedTrades.length; i++) {
      const prev = sortedTrades[i - 1];
      const curr = sortedTrades[i];
      if (Number(prev.pnl || 0) < 0) {
        const prevClose = new Date(prev.close_time!).getTime();
        const currOpen = new Date(curr.open_time).getTime();
        const minDiff = (currOpen - prevClose) / 60000;
        if (minDiff > 0 && minDiff <= 60) revengeCount++;
      }
    }

    let riskVarianceDetected = false;
    if (trades.length >= 3) {
      const lots = trades.map((t: any) => Number(t.lot_size));
      const maxL = Math.max(...lots);
      const minL = Math.min(...lots);
      if (minL > 0 && maxL / minL >= 2.5) riskVarianceDetected = true;
    }

    // 4. Invoke Google Gemini API
    const systemInstruction = 'You are an AI Trading Mentor that provides objective, JSON-structured feedback on trader psychology and rules adherence.';

    const prompt = `
You are a trading psychology expert and behavioral coach.
Analyze the following user trading log summary and daily reflections to generate psychological, discipline, and confidence scores (from 0 to 100).

Heuristics Detected:
- Revenge trades (entered within 60 mins of a loss): ${revengeCount}
- High-frequency overtrading days (exceeding 4 trades/day): ${highFrequencyDays}
- Sizing variance anomaly (overleveraged risk volatility): ${riskVarianceDetected ? 'YES' : 'NO'}

Last 15 Trades details:
${trades.map((t: any) => `- Pair: ${t.pair}, Dir: ${t.direction}, Lots: ${t.lot_size}, PnL: ${t.pnl || 0}, State: ${t.pre_trade_state}, Note: ${t.notes || 'N/A'}`).join('\n')}

Last 5 Daily reflections:
${reflections.map((r: any) => `- Date: ${r.reflection_date}, Plan Followed: ${r.followed_plan}, Revenge logged: ${r.did_revenge_trade}, Moved SL: ${r.did_move_stop_loss}, Emotion: ${r.emotional_state}, Note: ${r.notes || 'N/A'}`).join('\n')}

Formulate objective metrics and a brief overview.
Respond ONLY with a JSON object:
{
  "psychology_score": number,
  "discipline_score": number,
  "confidence_score": number,
  "revenge_trading_prob": number,
  "overtrading_prob": number,
  "fomo_prob": number,
  "rule_violations": ["string"],
  "assessment_notes": "string"
}
`;

    const rawJson = await callGemini(prompt, systemInstruction, activeKey);
    const parsedSnapshot = JSON.parse(rawJson);

    // Save Snapshot to DB
    const { error: insertError } = await supabase
      .from('psychology_snapshots')
      .insert([{
        user_id: user.id,
        account_id: accountId,
        psychology_score: parsedSnapshot.psychology_score,
        discipline_score: parsedSnapshot.discipline_score,
        confidence_score: parsedSnapshot.confidence_score,
        revenge_trading_prob: parsedSnapshot.revenge_trading_prob,
        overtrading_prob: parsedSnapshot.overtrading_prob,
        fomo_prob: parsedSnapshot.fomo_prob,
        rule_violations: parsedSnapshot.rule_violations,
        assessment_notes: parsedSnapshot.assessment_notes
      }]);

    if (insertError) {
      console.error('Database write error for Psychology Snapshot:', insertError);
    }

    return NextResponse.json({
      success: true,
      snapshot: parsedSnapshot
    });

  } catch (err: any) {
    console.error('AI Psychology Route error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error.' }, { status: 500 });
  }
}
