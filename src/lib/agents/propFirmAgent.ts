import { Trade, PropFirmProfile } from '@/types';

export interface PropFirmAgentOutput {
  propSafetyScore: number;
  violations: string[];
  accountHealth: 'Safe' | 'Warning' | 'Critical';
}

export function runPropFirmAgent(
  balance: number,
  trades: Trade[],
  profile: PropFirmProfile | null
): PropFirmAgentOutput {
  const closedTrades = trades.filter(t => t.status === 'CLOSED');
  const violations: string[] = [];
  let score = 100;

  // 1. Establish Ruleset based on Profile (or fallback to FundingPips default)
  const firmName = profile?.firm_name || 'FundingPips';
  let dailyLimitPct = profile?.daily_drawdown_pct || 5.0; // e.g. 5%
  let maxLimitPct = profile?.max_drawdown_pct || 10.0;    // e.g. 10%
  let checkConsistency = firmName === 'FundingPips' || firmName === 'FundedNext';

  // Customize limits by firm preset if profile is incomplete
  if (!profile) {
    if (firmName === 'FTMO') {
      dailyLimitPct = 5.0;
      maxLimitPct = 10.0;
    } else if (firmName === 'The5ers') {
      dailyLimitPct = 3.0;
      maxLimitPct = 6.0;
    } else if (firmName === 'MyFundedFX') {
      dailyLimitPct = 5.0;
      maxLimitPct = 8.0;
    }
  }

  const dailyLimitVal = balance * (dailyLimitPct / 100);
  const maxLimitVal = balance * (maxLimitPct / 100);

  if (closedTrades.length === 0) {
    return {
      propSafetyScore: 100,
      violations: [],
      accountHealth: 'Safe'
    };
  }

  // 2. Daily Drawdown Evaluation
  const pnlByDay: Record<string, number> = {};
  closedTrades.forEach(t => {
    const day = t.close_time ? t.close_time.split('T')[0] : t.open_time.split('T')[0];
    pnlByDay[day] = (pnlByDay[day] || 0) + Number(t.pnl || 0);
  });

  let maxDailyLoss = 0;
  Object.entries(pnlByDay).forEach(([_, pnl]) => {
    if (pnl < 0 && Math.abs(pnl) > maxDailyLoss) {
      maxDailyLoss = Math.abs(pnl);
    }
  });

  if (maxDailyLoss >= dailyLimitVal) {
    score -= 50;
    violations.push(`Breached daily drawdown limit for ${firmName} (Max daily loss: $${maxDailyLoss.toFixed(2)} vs Limit: $${dailyLimitVal.toFixed(2)})`);
  } else if (maxDailyLoss >= dailyLimitVal * 0.8) {
    score -= 20;
    violations.push(`Approaching daily drawdown limit (Max loss reached: $${maxDailyLoss.toFixed(2)} / limit: $${dailyLimitVal.toFixed(2)})`);
  }

  // 3. Maximum Peak-to-Valley Drawdown Check
  // Reconstruct equity curve to find peak-to-trough drawdown
  let currentEquity = balance;
  let peakEquity = balance;
  let maxDrawdown = 0;

  // Sort trades chronologically to build equity curve
  const sortedTrades = [...closedTrades].sort(
    (a, b) => new Date(a.close_time || a.open_time).getTime() - new Date(b.close_time || b.open_time).getTime()
  );

  sortedTrades.forEach(t => {
    currentEquity += Number(t.pnl || 0);
    if (currentEquity > peakEquity) {
      peakEquity = currentEquity;
    }
    const dd = peakEquity - currentEquity;
    if (dd > maxDrawdown) {
      maxDrawdown = dd;
    }
  });

  if (maxDrawdown >= maxLimitVal) {
    score -= 50;
    violations.push(`Breached maximum drawdown limit (Max drawdown reached: $${maxDrawdown.toFixed(2)} vs Limit: $${maxLimitVal.toFixed(2)})`);
  } else if (maxDrawdown >= maxLimitVal * 0.8) {
    score -= 20;
    violations.push(`Approaching maximum drawdown limit (Max drawdown reached: $${maxDrawdown.toFixed(2)} / limit: $${maxLimitVal.toFixed(2)})`);
  }

  // 4. Consistency Limit Check (No single day profit should exceed 50% of overall profit target)
  if (checkConsistency) {
    const totalProfit = sortedTrades.reduce((sum, t) => sum + Math.max(Number(t.pnl || 0), 0), 0);
    let maxSingleDayProfit = 0;
    
    Object.entries(pnlByDay).forEach(([_, pnl]) => {
      if (pnl > maxSingleDayProfit) {
        maxSingleDayProfit = pnl;
      }
    });

    if (totalProfit > 0 && maxSingleDayProfit / totalProfit > 0.5) {
      score -= 15;
      violations.push(`Consistency Rule Risk: Single day profit of $${maxSingleDayProfit.toFixed(2)} is ${( (maxSingleDayProfit / totalProfit) * 100 ).toFixed(1)}% of your total profits (Limit: 50%)`);
    }
  }

  // 5. Overtrading Trade Frequency Check
  let hasDailyOvertrade = false;
  Object.values(pnlByDay).forEach((_, idx) => {
    // If trade frequency on a single day exceeds 5 closed trades
    const day = Object.keys(pnlByDay)[idx];
    const dayTradesCount = closedTrades.filter(t => (t.close_time ? t.close_time.split('T')[0] : t.open_time.split('T')[0]) === day).length;
    if (dayTradesCount > 5) {
      hasDailyOvertrade = true;
    }
  });

  if (hasDailyOvertrade) {
    score -= 15;
    violations.push(`Overtrading detected: Exceeded 5 trades closed in a single day.`);
  }

  // Determine Health Tier
  let accountHealth: 'Safe' | 'Warning' | 'Critical' = 'Safe';
  if (score <= 50) {
    accountHealth = 'Critical';
  } else if (score < 90) {
    accountHealth = 'Warning';
  }

  return {
    propSafetyScore: Math.max(score, 0),
    violations,
    accountHealth
  };
}
