import { Trade, DailyReflection, PropFirmProfile } from '@/types';
import { runRiskAgent, RiskAgentOutput } from './riskAgent';
import { runPerformanceAgent, PerformanceAgentOutput } from './performanceAgent';
import { runStrategyAgent, StrategyAgentOutput } from './strategyAgent';
import { runPropFirmAgent, PropFirmAgentOutput } from './propFirmAgent';
import { runPsychologyAgent, PsychologyAgentOutput } from './psychologyAgent';
import { runBlowUpPredictorAgent, BlowUpPredictorOutput } from './blowupPredictorAgent';
import { runCoachAgent, CoachAgentOutput } from './coachAgent';

export interface MultiAgentReport {
  success: boolean;
  timestamp: string;
  reportType: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  isMockMode: boolean;
  risk: RiskAgentOutput;
  performance: PerformanceAgentOutput;
  strategy: StrategyAgentOutput;
  propFirm: PropFirmAgentOutput;
  psychology: PsychologyAgentOutput;
  blowup: BlowUpPredictorOutput;
  coachReport: CoachAgentOutput;
}

export async function runMultiAgentOrchestrator(
  balance: number,
  trades: Trade[],
  reflections: DailyReflection[],
  profile: PropFirmProfile | null,
  reportType: 'DAILY' | 'WEEKLY' | 'MONTHLY' = 'DAILY',
  userApiKey?: string
): Promise<MultiAgentReport> {
  
  // 1. Run Deterministic Agents (in parallel)
  const risk = runRiskAgent(balance, trades);
  const performance = runPerformanceAgent(balance, trades);
  const strategy = runStrategyAgent(trades);
  const propFirm = runPropFirmAgent(balance, trades, profile);

  // 2. Run Psychology Agent (async, potentially Gemini-based)
  const psychology = await runPsychologyAgent(trades, reflections, userApiKey);

  // 3. Run Blow-Up Predictor Agent (async, potentially Gemini-based)
  const blowup = await runBlowUpPredictorAgent(trades, reflections, risk, psychology, userApiKey);

  // 4. Run Coach Agent Synthesizer (async, potentially Gemini-based)
  const coachReport = await runCoachAgent(
    reportType,
    risk,
    psychology,
    strategy,
    performance,
    propFirm,
    blowup,
    userApiKey
  );

  const isMockMode = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
                     process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-supabase-project') ||
                     !(userApiKey || process.env.GEMINI_API_KEY);

  return {
    success: true,
    timestamp: new Date().toISOString(),
    reportType,
    isMockMode,
    risk,
    performance,
    strategy,
    propFirm,
    psychology,
    blowup,
    coachReport
  };
}
