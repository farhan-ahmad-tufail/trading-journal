import { Trade } from '@/types';

export interface RiskAgentOutput {
  riskScore: number;
  violations: string[];
  recommendations: string[];
}

function getContractSize(symbol: string): number {
  const s = symbol.toUpperCase();
  if (s.includes('XAU') || s.includes('GOLD')) return 100;
  if (s.includes('BTC') || s.includes('ETH') || s.includes('CRYPTO')) return 1;
  return 100000; // default Forex standard
}

export function runRiskAgent(balance: number, trades: Trade[]): RiskAgentOutput {
  const closedTrades = trades.filter(t => t.status === 'CLOSED');
  const violations: string[] = [];
  const recommendations: string[] = [];
  let score = 100;

  if (trades.length === 0) {
    return {
      riskScore: 100,
      violations: [],
      recommendations: ['No trade history logged yet. Maintain proper safety rules when opening setups.']
    };
  }

  // 1. Excessive Risk Check (> 2% of account balance)
  let hasExcessiveRisk = false;
  closedTrades.forEach(t => {
    const loss = Number(t.pnl || 0);
    if (loss < 0 && Math.abs(loss) > balance * 0.02) {
      hasExcessiveRisk = true;
    }
    // Also check potential risk from entry vs stop loss
    if (t.entry_price && t.stop_loss && t.lot_size) {
      const pLoss = Math.abs(t.entry_price - t.stop_loss) * t.lot_size * getContractSize(t.pair);
      if (pLoss > balance * 0.02) {
        hasExcessiveRisk = true;
      }
    }
  });

  if (hasExcessiveRisk) {
    score -= 20;
    violations.push('Excessive Risk per Trade');
    recommendations.push('Limit your risk per trade to a maximum of 1% of your account balance.');
  }

  // 2. Overleveraging Check (Lot size too large for balance)
  let hasOverleveraging = false;
  trades.forEach(t => {
    // Standard rule: > 1 lot per $5,000 is high risk. Let's say > 0.0002 lots per dollar is overleveraged
    if (t.lot_size > balance * 0.0002) {
      hasOverleveraging = true;
    }
  });

  if (hasOverleveraging) {
    score -= 20;
    violations.push('Overleveraging');
    recommendations.push('Reduce your average position size to match your margin boundaries. Do not exceed 0.1 lots per $1,000 of equity.');
  }

  // 3. Inconsistent Risk Check (Max vs Min Lot Size Ratio > 2.5)
  if (closedTrades.length >= 3) {
    const lots = closedTrades.map(t => t.lot_size);
    const maxL = Math.max(...lots);
    const minL = Math.min(...lots);
    if (minL > 0 && maxL / minL >= 2.5) {
      score -= 15;
      violations.push('Inconsistent Sizing');
      recommendations.push('Standardize your lot sizes. Use a position size calculator to risk the exact same dollar amount per setup.');
    }
  }

  // 4. Drawdown Acceleration (Increasing losses on last 3 trades)
  if (closedTrades.length >= 3) {
    const sortedRecent = [...closedTrades]
      .sort((a, b) => new Date(b.open_time).getTime() - new Date(a.open_time).getTime())
      .slice(0, 3);

    const losses = sortedRecent.map(t => Number(t.pnl || 0));
    // Check if all are losses and losses are accelerating (getting more negative)
    if (losses[0] < 0 && losses[1] < 0 && losses[2] < 0 && losses[0] < losses[1] && losses[1] < losses[2]) {
      score -= 25;
      violations.push('Drawdown Acceleration');
      recommendations.push('Active risk escalation detected. Halt trading or reduce sizing to micro-lots (0.01) immediately to stop the bleed.');
    }
  }

  // 5. Poor Risk-to-Reward Ratio (Average RR < 1.0)
  let rrSum = 0;
  let rrCount = 0;
  closedTrades.forEach(t => {
    if (t.entry_price && t.stop_loss && t.take_profit) {
      const risk = Math.abs(t.entry_price - t.stop_loss);
      const reward = Math.abs(t.take_profit - t.entry_price);
      if (risk > 0) {
        rrSum += reward / risk;
        rrCount++;
      }
    }
  });
  const avgRR = rrCount > 0 ? rrSum / rrCount : 0;
  if (rrCount > 0 && avgRR < 1.0) {
    score -= 20;
    violations.push('Poor Risk-to-Reward Ratio');
    recommendations.push('Aim for setups with a minimum of 1:1.5 or 1:2 Risk-to-Reward ratio. Let your winners run to target instead of cutting them early.');
  }

  // Fallback default recommendation
  if (recommendations.length === 0) {
    recommendations.push('Maintain current risk metrics. Your risk parameters show excellent compliance.');
  }

  return {
    riskScore: Math.max(score, 0),
    violations,
    recommendations
  };
}
