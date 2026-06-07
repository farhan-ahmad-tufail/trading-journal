import { Trade } from '@/types';

export interface StrategyAgentOutput {
  strategyScore: number;
  bestSetup: string;
  weakestSetup: string;
  consistencyPct: number;
}

export function runStrategyAgent(trades: Trade[]): StrategyAgentOutput {
  const closedTrades = trades.filter(t => t.status === 'CLOSED');
  
  if (closedTrades.length === 0) {
    return {
      strategyScore: 100,
      bestSetup: 'N/A',
      weakestSetup: 'N/A',
      consistencyPct: 0
    };
  }

  // 1. Group PnL and count by strategy setup tags
  const setupStats: Record<string, { totalPnL: number; wins: number; total: number }> = {};
  
  closedTrades.forEach(t => {
    const tags = t.setup_tags && t.setup_tags.length > 0 ? t.setup_tags : ['Untagged'];
    tags.forEach(tag => {
      const cleanTag = tag.trim();
      if (!setupStats[cleanTag]) {
        setupStats[cleanTag] = { totalPnL: 0, wins: 0, total: 0 };
      }
      setupStats[cleanTag].totalPnL += t.pnl || 0;
      setupStats[cleanTag].total++;
      if (Number(t.pnl || 0) > 0) {
        setupStats[cleanTag].wins++;
      }
    });
  });

  let bestSetup = 'N/A';
  let bestPnL = -Infinity;
  let weakestSetup = 'N/A';
  let worstPnL = Infinity;

  Object.entries(setupStats).forEach(([tag, stat]) => {
    if (stat.totalPnL > bestPnL) {
      bestPnL = stat.totalPnL;
      bestSetup = tag;
    }
    if (stat.totalPnL < worstPnL) {
      worstPnL = stat.totalPnL;
      weakestSetup = tag;
    }
  });

  // 2. Evaluate Setup Grade Consistency (Entry Quality)
  // Entry consistency = ratio of High Setup Grade trades (A or A+) to total trades
  const highGradeCount = closedTrades.filter(t => t.setup_grade === 'A+' || t.setup_grade === 'A').length;
  const entryConsistency = (highGradeCount / closedTrades.length) * 100;

  // 3. Evaluate Exit Quality
  // Check if wins are clean (e.g. exit_price close to take_profit) or if losses were kept tight (closed at stop_loss or breakeven, not extended)
  let exitScoreSum = 0;
  closedTrades.forEach(t => {
    const pnl = t.pnl || 0;
    if (pnl > 0) {
      // If win, check if we hit TP or exited near it
      if (t.take_profit && t.entry_price) {
        const potentialReward = Math.abs(t.take_profit - t.entry_price);
        const actualReward = Math.abs((t.exit_price || t.entry_price) - t.entry_price);
        if (potentialReward > 0) {
          const ratio = actualReward / potentialReward;
          // Exit score is high if they let it run close to TP, lower if cut very early
          exitScoreSum += ratio >= 0.85 ? 100 : (ratio * 100);
        } else {
          exitScoreSum += 70; // baseline
        }
      } else {
        exitScoreSum += 80;
      }
    } else {
      // If loss, check if we stayed within SL bounds
      if (t.stop_loss && t.entry_price) {
        const plannedRisk = Math.abs(t.entry_price - t.stop_loss);
        const actualLoss = Math.abs((t.exit_price || t.entry_price) - t.entry_price);
        if (plannedRisk > 0) {
          // If actual loss exceeds planned risk (widened SL), bad exit quality
          const ratio = actualLoss / plannedRisk;
          if (ratio <= 1.05) exitScoreSum += 100; // respected SL
          else if (ratio <= 1.5) exitScoreSum += 50; // slightly extended
          else exitScoreSum += 0; // blew past SL / removed SL
        } else {
          exitScoreSum += 80;
        }
      } else {
        exitScoreSum += 60; // loss with no SL defined is a negative indicator
      }
    }
  });
  const avgExitQuality = exitScoreSum / closedTrades.length;

  // Consistency Percentage combines entry consistency and exit quality
  const consistencyPct = Math.round((entryConsistency * 0.4) + (avgExitQuality * 0.6));

  // Strategy Score (0-100) combining setup grades and consistency
  // Deduct points for high ratio of low-grade setups
  const lowGradeCount = closedTrades.filter(t => t.setup_grade === 'C' || t.setup_grade === 'D').length;
  const lowGradeRatio = lowGradeCount / closedTrades.length;
  
  let score = 100;
  score -= (lowGradeRatio * 40); // up to -40 points for bad setup selection
  score -= ((100 - avgExitQuality) * 0.4); // up to -40 points for poor exit execution
  
  return {
    strategyScore: Math.round(Math.min(Math.max(score, 0), 100)),
    bestSetup: bestPnL > 0 ? bestSetup : 'N/A',
    weakestSetup: worstPnL < 0 ? weakestSetup : 'N/A',
    consistencyPct
  };
}
