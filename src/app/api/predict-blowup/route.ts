import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserFromSession } from '@/lib/auth-verify';
import { predictBlowUpRisk } from '@/lib/coach';
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

    // 1. Database Queries for Context
    let trades: any[] = [];
    let reflections: any[] = [];
    let userId = 'demo-user';

    if (!isMock) {
      const user = await getUserFromSession(request);
      if (!user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      userId = user.id;
      const supabase = createAdminClient();
        
        // Fetch last 15 trades
        const { data: tradesData } = await supabase
          .from('trades')
          .select('*')
          .eq('account_id', accountId)
          .order('open_time', { ascending: false })
          .limit(15);
        trades = tradesData || [];

        // Fetch last 5 reflections
        const { data: reflectionsData } = await supabase
          .from('daily_reflections')
          .select('*')
          .eq('user_id', user.id)
          .order('reflection_date', { ascending: false })
          .limit(5);
        reflections = reflectionsData || [];
    }

    // 2. Mock Fallback or Missing API Key Flow
    if (isMock || !activeKey) {
      const result = predictBlowUpRisk(trades, reflections);
      return NextResponse.json({
        success: true,
        isMockMode: true,
        prediction: {
          failure_probability: result.probability,
          risk_level: result.level,
          reasons: result.reasons,
          suggested_actions: result.actions
        }
      });
    }

    // 3. Real Google Gemini Blow-Up Prediction Flow
    const closedLosses = trades.filter((t: any) => t.status === 'CLOSED' && Number(t.pnl || 0) < 0);
    const totalLots = trades.map((t: any) => Number(t.lot_size));
    const lotVariance = totalLots.length > 0 ? (Math.max(...totalLots) / Math.min(...totalLots || 1)).toFixed(1) : '1.0';

    const systemInstruction = 'You are an AI Trading Risk Officer that outputs JSON-structured account failure risk predictions.';

    const prompt = `
You are a Principal Risk Officer at a multi-million dollar proprietary trading firm.
Your job is to analyze this trader's recent telemetry and warn them if they are showing signs of an impending emotional "Account Blow-Up" (losing > 10% of equity or violating prop firm rules) in the next 7 days.

Metrics Profile:
- Recent closed losses count: ${closedLosses.length} / last 15 trades
- Lot sizing variance ratio (Max lot / Min lot): ${lotVariance}x
- Emotional pre-trade states logged: ${trades.map((t: any) => t.pre_trade_state).filter(s => s && s !== 'Calm' && s !== 'Focused').join(', ')}

Recent reflections:
${reflections.map((r: any) => `- Date: ${r.reflection_date}, Revenge trade? ${r.did_revenge_trade}, Moved SL? ${r.did_move_stop_loss}, Emotional State: ${r.emotional_state}, Note: ${r.notes || 'N/A'}`).join('\n')}

Analyze:
1. Sizing Volatility: Are they increasing lot sizes after losses to recover funds?
2. Rules Bypass: Did they move stop losses or engage in revenge trading?
3. Cumulative Stress: Do reflections show frustration, greed, or exhaustion?

Rate the probability of account failure in the next 7 days (0% to 100%).
Categorize risk_level: LOW (0-30%), MEDIUM (31-60%), HIGH (61-100%).

Respond ONLY with a JSON object matching this structure:
{
  "failure_probability": number,
  "risk_level": "LOW" | "MEDIUM" | "HIGH",
  "reasons": ["string"],
  "suggested_actions": ["string"]
}
`;

    const rawJson = await callGemini(prompt, systemInstruction, activeKey);
    const parsedPrediction = JSON.parse(rawJson);

    // Save Prediction to DB
    if (!isMock) {
      const supabase = createAdminClient();
      const { error: insertError } = await supabase
        .from('blowup_predictions')
        .insert([{
          user_id: userId,
          account_id: accountId,
          failure_probability: parsedPrediction.failure_probability,
          risk_level: parsedPrediction.risk_level,
          reasons: parsedPrediction.reasons,
          suggested_actions: parsedPrediction.suggested_actions
        }]);

      if (insertError) {
        console.error('Database write error for Blow-Up Prediction:', insertError);
      }
    }

    return NextResponse.json({
      success: true,
      prediction: parsedPrediction
    });

  } catch (err: any) {
    console.error('AI Blow-up Predictor Route error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error.' }, { status: 500 });
  }
}
