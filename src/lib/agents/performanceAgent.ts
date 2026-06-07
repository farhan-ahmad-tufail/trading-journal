import { Trade } from '@/types';

export interface PerformanceAgentOutput {
  performanceScore: number;
  winRate: number;
  profitFactor: number;
  expectancy: number;
  averageRR: number;
  bestSession: string;
  worstSession: string;
  bestMarket: string;
  tradingDnaSummary: string;
}

export function runPerformanceAgent(balance: number, trades: Trade[]): PerformanceAgentOutput {
  const closedTrades = trades.filter(t => t.status === 'CLOSED');
  
  if (closedTrades.length === 0) {
    return {
      performanceScore: 100,
      winRate: 0,
      profitFactor: 0,
      expectancy: 0,
      averageRR: 0,
      bestSession: 'N/A',
      worstSession: 'N/A',
      bestMarket: 'N/A',
      tradingDnaSummary: 'No closed trades logged. Start journaling closed positions to generate your Trading DNA profile.'
    };
  }

  const wins = closedTrades.filter(t => Number(t.pnl || 0) > 0);
  const losses = closedTrades.filter(t => Number(t.pnl || 0) < 0);
  
  const totalTrades = closedTrades.length;
  const winRate = (wins.length / totalTrades) * 100;

  const grossProfit = wins.reduce((sum, t) => sum + Number(t.pnl || 0), 0);
  const grossLoss = losses.reduce((sum, t) => sum + Math.abs(Number(t.pnl || 0)), 0);
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 99.9 : 0.0);

  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLoss = losses.length > 0 ? grossLoss / losses.length : 0;
  
  // Expectancy = (Probability of Win * Average Win) - (Probability of Loss * Average Loss)
  const expectancy = (wins.length / totalTrades) * avgWin - (losses.length / totalTrades) * avgLoss;

  // Average Risk Reward
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
  const averageRR = rrCount > 0 ? rrSum / rrCount : 0;

  // Session stats
  const sessionPnL: Record<string, number> = {};
  // Market stats
  const marketPnL: Record<string, number> = {};

  closedTrades.forEach(t => {
    const session = t.session;
    sessionPnL[session] = (sessionPnL[session] || 0) + (t.pnl || 0);

    const pair = t.pair.toUpperCase().trim();
    marketPnL[pair] = (marketPnL[pair] || 0) + (t.pnl || 0);
  });

  let bestSession = 'N/A';
  let bestSessionPnL = -Infinity;
  let worstSession = 'N/A';
  let worstSessionPnL = Infinity;

  Object.entries(sessionPnL).forEach(([sess, pnl]) => {
    if (pnl > bestSessionPnL) {
      bestSessionPnL = pnl;
      bestSession = sess;
    }
    if (pnl < worstSessionPnL) {
      worstSessionPnL = pnl;
      worstSession = sess;
    }
  });

  let bestMarket = 'N/A';
  let bestMarketPnL = -Infinity;

  Object.entries(marketPnL).forEach(([mkt, pnl]) => {
    if (pnl > bestMarketPnL) {
      bestMarketPnL = pnl;
      bestMarket = mkt;
    }
  });

  // Calculate score based on win rate, profit factor, and expectancy
  // Performance Score: winRate component (40 points), profitFactor component (40 points), expectancy component (20 points)
  const winRateScore = (winRate / 100) * 40;
  const pfScore = Math.min(profitFactor / 2.0, 1.0) * 40; // Max profit factor caps at 2.0 for scoring
  const expectancyScore = expectancy > 0 ? 20 : Math.max(20 + (expectancy / (balance || 1000)) * 20, 0);

  const performanceScore = Math.round(winRateScore + pfScore + expectancyScore);

  // Generate DNA Summary
  let summary = `Your trading profile is strongest on **${bestMarket}** during the **${bestSession.replace('_', ' ')}** session. `;
  if (profitFactor >= 1.5) {
    summary += `With a healthy Profit Factor of **${profitFactor.toFixed(2)}** and expectancy of **$${expectancy.toFixed(2)}** per trade, your statistical edge is robust. `;
  } else if (profitFactor >= 1.0) {
    summary += `Your edge is slightly positive (Profit Factor: **${profitFactor.toFixed(2)}**), but could be improved by cutting losses faster or letting winners run. `;
  } else {
    summary += `Your edge is currently negative. Your average loss (**$${avgLoss.toFixed(2)}**) exceeds your average win (**$${avgWin.toFixed(2)}**), yielding a negative expectancy. `;
  }

  if (worstSession !== 'N/A' && worstSession !== bestSession) {
    summary += `Consider avoiding entries during the **${worstSession.replace('_', ' ')}** session to minimize drawdown.`;
  }

  return {
    performanceScore: Math.min(Math.max(performanceScore, 0), 100),
    winRate,
    profitFactor,
    expectancy,
    averageRR,
    bestSession,
    worstSession,
    bestMarket,
    tradingDnaSummary: summary
  };
}
