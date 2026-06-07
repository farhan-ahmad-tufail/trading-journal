import { Trade, DailyReflection } from '@/types';
import { callGemini } from '@/lib/gemini';

export interface PsychologyAgentOutput {
  psychologyScore: number;
  emotionalTriggers: string[];
  confidenceLevel: 'Low' | 'Medium' | 'High';
  disciplineAssessment: string;
}

export async function runPsychologyAgent(
  trades: Trade[],
  reflections: DailyReflection[],
  userApiKey?: string
): Promise<PsychologyAgentOutput> {
  const isMock = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
                 process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-supabase-project');
  const apiKey = userApiKey || process.env.GEMINI_API_KEY;

  // 1. Local Heuristic Fallback (Offline Mode or missing Key)
  if (isMock || !apiKey) {
    let score = 85;
    const triggers = new Set<string>();
    
    const revengeCount = reflections.filter(r => r.did_revenge_trade).length;
    if (revengeCount > 0) {
      score -= 20 * Math.min(revengeCount, 2);
      triggers.add('Revenge Urges (trading after losses)');
    }

    const slMoves = reflections.filter(r => r.did_move_stop_loss).length;
    if (slMoves > 0) {
      score -= 15 * Math.min(slMoves, 2);
      triggers.add('Loss Aversion (moving SL parameters)');
    }

    const emotions = reflections.map(r => r.emotional_state.toLowerCase());
    const negativeEmotions = emotions.filter(e => e.includes('angry') || e.includes('fomo') || e.includes('greedy') || e.includes('anxious'));
    
    if (negativeEmotions.length > 0) {
      score -= 10;
      negativeEmotions.forEach(e => {
        if (e.includes('fomo')) triggers.add('FOMO / Impatience');
        if (e.includes('angry')) triggers.add('Anger / Tilt');
        if (e.includes('greedy')) triggers.add('Greed / Over-leveraging');
      });
    }

    let confidenceLevel: 'Low' | 'Medium' | 'High' = 'High';
    if (score < 55) confidenceLevel = 'Low';
    else if (score < 80) confidenceLevel = 'Medium';

    let assessment = '';
    if (score >= 80) {
      assessment = 'Your emotional control is solid. You respect your stop losses and plan parameters. Keep maintaining this mindset to sustain profitability.';
    } else if (score >= 60) {
      assessment = 'You are experiencing moderate psychological triggers, particularly after losses. You have a tendency to move stop losses or force setups. Focus on taking a break after a loss to reset.';
    } else {
      assessment = 'Your psychological discipline is heavily compromised. Multiple revenge trades and stop-loss removals have been detected. You are trading on high tilt. We recommend a mandatory 48-hour cool-off period.';
    }

    await new Promise(resolve => setTimeout(resolve, 800));

    return {
      psychologyScore: Math.max(score, 5),
      emotionalTriggers: Array.from(triggers).length > 0 ? Array.from(triggers) : ['None detected'],
      confidenceLevel,
      disciplineAssessment: assessment
    };
  }

  // 2. Google Gemini API Call
  try {
    const systemInstruction = 'You are an AI Trading Psychology Coach that outputs JSON-structured behavioral audits.';
    
    const prompt = `
You are an expert Cognitive Performance Coach specializing in trading psychology.
Analyze the following trader logs (pre-trade emotional states) and daily reflections (revenge actions, plan adherence, emotional state) to evaluate their discipline and psychological stability.

Recent Trades Mindset Profiles:
${trades.slice(0, 10).map((t: any) => `- Pair: ${t.pair}, PnL: ${t.pnl || 0}, State: ${t.pre_trade_state}, Note: ${t.notes || 'N/A'}`).join('\n')}

Recent Daily Reflections:
${reflections.slice(0, 5).map((r: any) => `- Date: ${r.reflection_date}, Plan Followed? ${r.followed_plan}, Revenge trade? ${r.did_revenge_trade}, Moved SL? ${r.did_move_stop_loss}, Emotion: ${r.emotional_state}, Note: ${r.notes || 'N/A'}`).join('\n')}

Detect:
1. Revenge Trading patterns (entering positions directly after a loss to recover capital).
2. FOMO, greed, or anger triggers.
3. Loss aversion (moving or removing stop loss mid-trade).

Generate a structured JSON output exactly matching the format below. Respond ONLY with this JSON block:
{
  "psychologyScore": number,
  "emotionalTriggers": ["string"],
  "confidenceLevel": "Low" | "Medium" | "High",
  "disciplineAssessment": "A professional, constructive analysis paragraph summarizing their emotional status and rules compliance."
}
`;

    const rawJson = await callGemini(prompt, systemInstruction, apiKey);
    const parsed = JSON.parse(rawJson);
    
    return {
      psychologyScore: Number(parsed.psychologyScore || 80),
      emotionalTriggers: parsed.emotionalTriggers || ['None detected'],
      confidenceLevel: parsed.confidenceLevel || 'Medium',
      disciplineAssessment: parsed.disciplineAssessment || 'Stable behavioral telemetry.'
    };

  } catch (err: any) {
    console.error('Psychology Agent Gemini failure:', err);
    // Silent fallback to local heuristics
    return runPsychologyAgent(trades, reflections);
  }
}
