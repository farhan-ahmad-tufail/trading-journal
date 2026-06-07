import { RiskAgentOutput } from './riskAgent';
import { PsychologyAgentOutput } from './psychologyAgent';
import { StrategyAgentOutput } from './strategyAgent';
import { PerformanceAgentOutput } from './performanceAgent';
import { PropFirmAgentOutput } from './propFirmAgent';
import { BlowUpPredictorOutput } from './blowupPredictorAgent';
import { callGemini } from '@/lib/gemini';

export interface CoachAgentOutput {
  executiveSummary: string;
  biggestMistake: string;
  biggestStrength: string;
  whatToImproveNext: string;
  actionPlan: string[];
  fullReportMarkdown: string;
}

export async function runCoachAgent(
  reportType: 'DAILY' | 'WEEKLY' | 'MONTHLY',
  risk: RiskAgentOutput,
  psychology: PsychologyAgentOutput,
  strategy: StrategyAgentOutput,
  performance: PerformanceAgentOutput,
  propFirm: PropFirmAgentOutput,
  blowup: BlowUpPredictorOutput,
  userApiKey?: string
): Promise<CoachAgentOutput> {
  const isMock = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
                 process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-supabase-project');
  const apiKey = userApiKey || process.env.GEMINI_API_KEY;

  // 1. Local Heuristic Mock Fallback
  if (isMock || !apiKey) {
    const executiveSummary = `During this ${reportType.toLowerCase()} tracking period, your performance score is **${performance.performanceScore}/100** and risk metrics stand at **${risk.riskScore}/100**. The Blow-up Risk is rated as **${blowup.risk_level} (${blowup.failure_probability}%)**. While you have locked in some high-quality setups on **${performance.bestMarket}**, your primary leak is **${risk.violations[0] || 'risk parameter variance'}** and emotional flags including **${psychology.emotionalTriggers[0] || 'FOMO'}**.`;

    const biggestMistake = risk.violations.length > 0 
      ? `Allowing **${risk.violations[0]}** to bypass your risk rules, causing unnecessary drawdown.`
      : psychology.psychologyScore < 80 
        ? 'Trading while feeling impatient or tilting after taking consecutive losses.'
        : 'Exiting winning trades too early, leaving money on the table due to minor price fluctuations.';

    const biggestStrength = performance.profitFactor >= 1.2
      ? `Strong statistical edge execution on **${performance.bestMarket}** during **${performance.bestSession.replace('_', ' ')}** session.`
      : 'Solid risk discipline on high-grade setups (Grades A/A+) when keeping emotions out of decisions.';

    const whatToImproveNext = risk.violations.includes('Excessive Risk per Trade')
      ? 'Calculate and size positions strictly based on a hard stop-loss risk of 1.0% per setup.'
      : 'Eliminate trading during low-volume sessions and restrict setup entries to the London/New York overlap.';

    const actionPlan = [
      `1. Size all upcoming trades on **${performance.bestMarket}** at exactly 1% risk maximum.`,
      '2. Implement a strict "2 losses and out" rule for daily trading activity.',
      '3. Log your mindset state before every trade entry. If not calm, do not trade.'
    ];

    const markdown = `
# Multi-Agent Executive Coaching Report (${reportType})

## Executive Summary
${executiveSummary}

---

## 🛡️ Risk Analysis
*   **Risk Score**: ${risk.riskScore}/100
*   **Violations**: ${risk.violations.join(', ') || 'None detected'}
*   *Coach Recommendation*: ${risk.recommendations[0] || 'Keep up standard parameters.'}

---

## 🧠 Psychology Analysis
*   **Mindset Score**: ${psychology.psychologyScore}/100
*   **Triggers Detected**: ${psychology.emotionalTriggers.join(', ') || 'None'}
*   *Discipline Audit*: ${psychology.disciplineAssessment}

---

## 📈 Performance & Strategy Telemetry
*   **Win Rate**: ${performance.winRate.toFixed(1)}% | **Profit Factor**: ${performance.profitFactor.toFixed(2)}
*   **Trading DNA**: ${performance.tradingDnaSummary}
*   **Setup Focus**: Win edge is highest on \`${strategy.bestSetup}\`. Weakest setup is \`${strategy.weakestSetup}\`.

---

## 🏢 Prop Desk Compliance
*   **Compliance Score**: ${propFirm.propSafetyScore}/100
*   **Warnings**: ${propFirm.violations.join('; ') || 'All parameters fully compliant.'}
*   **Status**: **${propFirm.accountHealth}**

---

## 🔮 7-Day Blow-Up Prediction
*   **Failure Probability**: **${blowup.failure_probability}%**
*   **Risk Level**: **${blowup.risk_level}**
*   *Reasons*:
${blowup.reasons.map(r => `    - ${r}`).join('\n')}

---

## 📋 Action Plan
${actionPlan.map(a => `- ${a}`).join('\n')}
`;

    await new Promise(resolve => setTimeout(resolve, 1000));

    return {
      executiveSummary,
      biggestMistake,
      biggestStrength,
      whatToImproveNext,
      actionPlan,
      fullReportMarkdown: markdown.trim()
    };
  }

  // 2. Google Gemini API Call
  try {
    const systemInstruction = 'You are an AI Performance Coach and Chief Risk Officer that outputs JSON-structured performance summaries and full markdown coaching reports.';

    const prompt = `
You are the Lead Performance Coach and Chief Risk Officer at a prestigious proprietary trading firm.
Your job is to synthesize all metrics and assessments compiled by your specialist risk, psychology, strategy, performance, and prop firm agents into a single, high-impact, elite mentoring report.

Agent Report Data Inputs:
- Report Type: ${reportType}
- Risk Agent Output: Score ${risk.riskScore}/100, Violations [${risk.violations.join(', ')}], Recs [${risk.recommendations.join(', ')}]
- Psychology Agent Output: Score ${psychology.psychologyScore}/100, Triggers [${psychology.emotionalTriggers.join(', ')}], Discipline: "${psychology.disciplineAssessment}"
- Strategy Agent Output: Score ${strategy.strategyScore}/100, Best Setup: "${strategy.bestSetup}", Weakest Setup: "${strategy.weakestSetup}", Consistency: ${strategy.consistencyPct}%
- Performance Agent Output: Score ${performance.performanceScore}/100, WinRate ${performance.winRate.toFixed(1)}%, ProfitFactor ${performance.profitFactor.toFixed(2)}, DNA: "${performance.tradingDnaSummary}"
- Prop Firm Agent Output: Compliance Score ${propFirm.propSafetyScore}/100, Violations [${propFirm.violations.join(', ')}], Health: "${propFirm.accountHealth}"
- Blow-Up Predictor Output: Probability ${blowup.failure_probability}%, Level "${blowup.risk_level}", Reasons [${blowup.reasons.join(', ')}]

Summarize:
1. Executive summary context.
2. Biggest mistake (be direct, cut through excuses).
3. Biggest strength.
4. Exactly what parameter or behavior to focus on improving next.
5. Create a 3-step action plan.
6. Generate a full, professional mentoring report formatted in beautiful markdown, including individual subheadings for Executive Summary, Risk, Psychology, Performance & Strategy, Prop Desk, Blow-Up, and Action Plan. Do not use generic placeholders.

Return ONLY a JSON response matching:
{
  "executiveSummary": "string",
  "biggestMistake": "string",
  "biggestStrength": "string",
  "whatToImproveNext": "string",
  "actionPlan": ["string"],
  "fullReportMarkdown": "string"
}
`;

    const rawJson = await callGemini(prompt, systemInstruction, apiKey);
    const parsed = JSON.parse(rawJson);

    return {
      executiveSummary: parsed.executiveSummary || 'Audit summary completed.',
      biggestMistake: parsed.biggestMistake || 'No severe rules broken.',
      biggestStrength: parsed.biggestStrength || 'Consistent risk parameters.',
      whatToImproveNext: parsed.whatToImproveNext || 'Standard setups validation.',
      actionPlan: parsed.actionPlan || ['Maintain plan compliance.'],
      fullReportMarkdown: parsed.fullReportMarkdown || '# Report completed'
    };

  } catch (err: any) {
    console.error('Coach Agent Gemini failure:', err);
    return runCoachAgent(reportType, risk, psychology, strategy, performance, propFirm, blowup, apiKey);
  }
}
