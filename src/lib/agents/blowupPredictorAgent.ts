import { Trade, DailyReflection } from '@/types';
import { RiskAgentOutput } from './riskAgent';
import { PsychologyAgentOutput } from './psychologyAgent';
import { callGemini } from '@/lib/gemini';

export interface BlowUpPredictorOutput {
  failure_probability: number; // 0-100
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
  reasons: string[];
  recommendations: string[];
}

export async function runBlowUpPredictorAgent(
  trades: Trade[],
  reflections: DailyReflection[],
  risk: RiskAgentOutput,
  psychology: PsychologyAgentOutput,
  userApiKey?: string
): Promise<BlowUpPredictorOutput> {
  const isMock = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
                 process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-supabase-project');
  const apiKey = userApiKey || process.env.GEMINI_API_KEY;

  // 1. Local Heuristic Mock Fallback
  if (isMock || !apiKey) {
    const combinedDicipline = (risk.riskScore * 0.6) + (psychology.psychologyScore * 0.4);
    let probability = Math.round(100 - combinedDicipline);
    probability = Math.min(Math.max(probability, 5), 98);

    let risk_level: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    if (probability >= 60) risk_level = 'HIGH';
    else if (probability >= 30) risk_level = 'MEDIUM';

    const reasons: string[] = [];
    const recommendations: string[] = [];

    risk.violations.forEach(v => reasons.push(`Risk Agent Alert: ${v}`));
    psychology.emotionalTriggers.forEach(t => {
      if (t !== 'None detected') reasons.push(`Psychology Trigger: ${t}`);
    });

    if (reasons.length === 0) {
      if (probability > 40) {
        reasons.push('Elevated risk due to general position sizing inconsistency.');
      } else {
        reasons.push('No critical risk indicators active. Account parameters are clean.');
      }
    }

    risk.recommendations.forEach(r => recommendations.push(r));
    if (psychology.psychologyScore < 70) {
      recommendations.push('Introduce a mandatory cool-down period of 2 hours after any trade closed in drawdown.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Maintain your current checklist. Your account health is stable.');
    }

    await new Promise(resolve => setTimeout(resolve, 800));

    return {
      failure_probability: probability,
      risk_level,
      reasons: reasons.slice(0, 4),
      recommendations: recommendations.slice(0, 4)
    };
  }

  // 2. Google Gemini API Call
  try {
    const systemInstruction = 'You are an AI Trading Risk Assessor that outputs JSON predictions.';

    const prompt = `
You are a Principal Risk Officer at a proprietary trading desk.
Evaluate the 7-day probability (0% to 100%) that this trader will experience an emotional "Account Blow-Up" (defined as losing > 10% equity, hitting daily drawdown limits, or breaching prop firm compliance).

Recent Metrics Profile:
- Risk Score: ${risk.riskScore}/100
- Risk Violations Detected: ${risk.violations.join(', ') || 'None'}
- Psychology Score: ${psychology.psychologyScore}/100
- Psychology Triggers: ${psychology.emotionalTriggers.join(', ') || 'None'}

Recent Trade Telemetry:
${trades.slice(0, 10).map((t: any) => `- Pair: ${t.pair}, Lots: ${t.lot_size}, PnL: ${t.pnl || 0}, Duration: ${t.duration_seconds || 'N/A'}s`).join('\n')}

Recent daily reflections details:
${reflections.slice(0, 5).map((r: any) => `- Plan Followed: ${r.followed_plan}, Revenge: ${r.did_revenge_trade}, Moved SL: ${r.did_move_stop_loss}`).join('\n')}

Rate:
1. Probability of failure in next 7 days (0 to 100).
2. risk_level: LOW (0-30%), MEDIUM (31-60%), HIGH (61-100%).

Return ONLY a JSON object:
{
  "failure_probability": number,
  "risk_level": "LOW" | "MEDIUM" | "HIGH",
  "reasons": ["string"],
  "recommendations": ["string"]
}
`;

    const rawJson = await callGemini(prompt, systemInstruction, apiKey);
    const parsed = JSON.parse(rawJson);

    return {
      failure_probability: Number(parsed.failure_probability || 10),
      risk_level: parsed.risk_level || 'LOW',
      reasons: parsed.reasons || ['General account variance.'],
      recommendations: parsed.recommendations || ['Maintain standard parameters.']
    };

  } catch (err: any) {
    console.error('Blow-Up Predictor Gemini failure:', err);
    return runBlowUpPredictorAgent(trades, reflections, risk, psychology);
  }
}
