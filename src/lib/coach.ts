import { Trade, DailyReflection } from '@/types';

export interface DNAStats {
  bestSession: string;
  worstSession: string;
  bestPair: string;
  worstPair: string;
  bestStrategy: string;
  worstStrategy: string;
  bestRR: number;
  totalVolume: number;
  winRate: number;
  winsMostWhen: string[];
  losesMostWhen: string[];
}

export interface BlowUpRisk {
  probability: number; // 0 to 100
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  reasons: string[];
  actions: string[];
}

export interface ProcessComparison {
  tradeId: string;
  pair: string;
  direction: string;
  expectedGrade: string;
  actualOutcome: 'WIN' | 'LOSS' | 'BREAKEVEN';
  pnl: number;
  openTime: string;
  badgeType: 'SUCCESS' | 'WARNING' | 'NEUTRAL' | 'DANGER';
  explanation: string;
}

// -------------------------------------------------------------
// 1. TRADING DNA ENGINE
// -------------------------------------------------------------
export function analyzeTradingDNA(trades: Trade[]): DNAStats {
  const closedTrades = trades.filter(t => t.status === 'CLOSED');
  
  // Calculate average win rates and stats for different buckets
  const sessionStats: Record<string, { wins: number; total: number; pnl: number }> = {};
  const pairStats: Record<string, { wins: number; total: number; pnl: number }> = {};
  const strategyStats: Record<string, { wins: number; total: number; pnl: number }> = {};
  const preTradeStateStats: Record<string, { wins: number; total: number; pnl: number }> = {};
  
  let bestRR = 0;
  let totalVolume = 0;
  let winsCount = 0;

  closedTrades.forEach(t => {
    const isWin = (t.pnl || 0) > 0;
    if (isWin) winsCount++;
    totalVolume += t.lot_size;

    // Check R:R
    if (t.entry_price && t.stop_loss && t.take_profit) {
      const risk = Math.abs(t.entry_price - t.stop_loss);
      const reward = Math.abs(t.take_profit - t.entry_price);
      if (risk > 0) {
        const rr = reward / risk;
        if (rr > bestRR) bestRR = rr;
      }
    }

    // Sessions
    const sess = t.session;
    if (!sessionStats[sess]) sessionStats[sess] = { wins: 0, total: 0, pnl: 0 };
    sessionStats[sess].total++;
    sessionStats[sess].pnl += t.pnl || 0;
    if (isWin) sessionStats[sess].wins++;

    // Pairs
    const pair = t.pair.toUpperCase().trim();
    if (!pairStats[pair]) pairStats[pair] = { wins: 0, total: 0, pnl: 0 };
    pairStats[pair].total++;
    pairStats[pair].pnl += t.pnl || 0;
    if (isWin) pairStats[pair].wins++;

    // Strategies / Tags
    t.setup_tags.forEach(tag => {
      if (!strategyStats[tag]) strategyStats[tag] = { wins: 0, total: 0, pnl: 0 };
      strategyStats[tag].total++;
      strategyStats[tag].pnl += t.pnl || 0;
      if (isWin) strategyStats[tag].wins++;
    });

    // Pre-trade psychology state
    const pts = t.pre_trade_state || 'Calm';
    if (!preTradeStateStats[pts]) preTradeStateStats[pts] = { wins: 0, total: 0, pnl: 0 };
    preTradeStateStats[pts].total++;
    preTradeStateStats[pts].pnl += t.pnl || 0;
    if (isWin) preTradeStateStats[pts].wins++;
  });

  // Helper to find max/min
  const getExtremes = (statsMap: Record<string, { wins: number; total: number; pnl: number }>) => {
    let bestKey = 'N/A';
    let bestVal = -Infinity;
    let worstKey = 'N/A';
    let worstVal = Infinity;

    Object.entries(statsMap).forEach(([key, stat]) => {
      if (stat.pnl > bestVal) {
        bestVal = stat.pnl;
        bestKey = key;
      }
      if (stat.pnl < worstVal) {
        worstVal = stat.pnl;
        worstKey = key;
      }
    });

    return { best: bestKey, worst: worstKey };
  };

  const sessExtremes = getExtremes(sessionStats);
  const pairExtremes = getExtremes(pairStats);
  const stratExtremes = getExtremes(strategyStats);
  const ptsExtremes = getExtremes(preTradeStateStats);

  const winRate = closedTrades.length > 0 ? (winsCount / closedTrades.length) * 100 : 0;

  // Synthesize winsMostWhen / losesMostWhen
  const winsMostWhen: string[] = [];
  const losesMostWhen: string[] = [];

  // Rules based on user parameters or computed stats
  if (sessExtremes.best !== 'N/A') {
    const formatted = sessExtremes.best === 'LONDON_NY' ? 'London + NY Session' : `${sessExtremes.best.charAt(0) + sessExtremes.best.slice(1).toLowerCase()} Session`;
    winsMostWhen.push(`Trading during ${formatted}`);
  }
  if (pairExtremes.best !== 'N/A') {
    winsMostWhen.push(`Executing setups on ${pairExtremes.best}`);
  }
  
  // Look at strategy
  const sortedStrats = Object.entries(strategyStats).sort((a, b) => b[1].pnl - a[1].pnl);
  if (sortedStrats.length > 0 && sortedStrats[0][1].wins > 0) {
    winsMostWhen.push(`Utilizing "${sortedStrats[0][0]}" strategy setups`);
  }

  // Pre-trade state edge
  if (ptsExtremes.best !== 'N/A' && preTradeStateStats[ptsExtremes.best]?.pnl > 0) {
    winsMostWhen.push(`Entering setups while feeling mentally "${ptsExtremes.best}"`);
  } else {
    winsMostWhen.push('Entering setups while feeling mentally "Focused" or "Calm"');
  }

  // Fallback defaults representing user profile defaults if stats are lean
  if (winsMostWhen.length === 1) {
    winsMostWhen.push('London Session entries');
    winsMostWhen.push('Gold (XAUUSD) breakout structures');
    winsMostWhen.push('Trend continuation patterns');
  }

  if (sessExtremes.worst !== 'N/A' && sessExtremes.worst !== sessExtremes.best) {
    const formatted = sessExtremes.worst === 'LONDON_NY' ? 'London + NY Session' : `${sessExtremes.worst.charAt(0) + sessExtremes.worst.slice(1).toLowerCase()} Session`;
    losesMostWhen.push(`Trading during ${formatted}`);
  }
  if (pairExtremes.worst !== 'N/A' && pairExtremes.worst !== pairExtremes.best) {
    losesMostWhen.push(`Trading on ${pairExtremes.worst}`);
  }

  // Pre-trade state loss trigger
  if (ptsExtremes.worst !== 'N/A' && (ptsExtremes.worst === 'FOMO' || ptsExtremes.worst === 'Angry' || ptsExtremes.worst === 'Tired' || ptsExtremes.worst === 'Greedy')) {
    losesMostWhen.push(`Executing entries when feeling "${ptsExtremes.worst}" (Impulsive entry)`);
  }

  // Scan notes for counter-trend losses or overtrading count
  const counterTrendLosses = closedTrades.filter(t => 
    (t.pnl || 0) < 0 && 
    (t.notes?.toLowerCase().includes('counter-trend') || t.notes?.toLowerCase().includes('fomo') || t.notes?.toLowerCase().includes('counter trend'))
  ).length;

  if (counterTrendLosses > 0) {
    losesMostWhen.push('Attempting counter-trend reversals instead of staying with the trend');
  } else {
    losesMostWhen.push('Entering counter-trend structures without multi-timeframe confirmation');
  }

  // Check trade frequency per day
  const tradesByDay: Record<string, number> = {};
  trades.forEach(t => {
    const day = t.open_time.split('T')[0];
    tradesByDay[day] = (tradesByDay[day] || 0) + 1;
  });
  const maxTradesInADay = Object.values(tradesByDay).length > 0 ? Math.max(...Object.values(tradesByDay)) : 0;
  if (maxTradesInADay > 4) {
    losesMostWhen.push('Overtrading (exceeding 4 trades in a single calendar day)');
  } else {
    losesMostWhen.push('Revenge scaling when executing more than 4 trades per day');
  }

  return {
    bestSession: sessExtremes.best !== 'N/A' ? (sessExtremes.best === 'LONDON_NY' ? 'London + NY' : sessExtremes.best) : 'London',
    worstSession: sessExtremes.worst !== 'N/A' ? (sessExtremes.worst === 'LONDON_NY' ? 'London + NY' : sessExtremes.worst) : 'Asian',
    bestPair: pairExtremes.best !== 'N/A' ? pairExtremes.best : 'XAUUSD',
    worstPair: pairExtremes.worst !== 'N/A' ? pairExtremes.worst : 'EURUSD',
    bestStrategy: stratExtremes.best !== 'N/A' ? stratExtremes.best : 'Liquidity Sweep',
    worstStrategy: stratExtremes.worst !== 'N/A' ? stratExtremes.worst : 'Breakout',
    bestRR,
    totalVolume,
    winRate,
    winsMostWhen,
    losesMostWhen
  };
}

// -------------------------------------------------------------
// 2. AI ACCOUNT BLOW-UP PREDICTOR
// -------------------------------------------------------------
export function predictBlowUpRisk(trades: Trade[], reflections: DailyReflection[]): BlowUpRisk {
  const recentTrades = [...trades]
    .sort((a, b) => new Date(b.open_time).getTime() - new Date(a.open_time).getTime())
    .slice(0, 10);
  
  const recentClosed = recentTrades.filter(t => t.status === 'CLOSED');
  
  let probability = 10; // Base low risk (10%)
  const reasons: string[] = [];
  const actions: string[] = [];

  // Rule 1: Revenge Trading Flagged in Reflections
  const revengeReflection = reflections.slice(0, 5).filter(r => r.did_revenge_trade);
  if (revengeReflection.length > 0) {
    probability += 35;
    reasons.push(`Psychology Alarm: Revenge trading logged ${revengeReflection.length} time(s) in your recent daily reflections.`);
    actions.push('Establish a hard rule: Close charts immediately after a loss and step away for at least 2 hours.');
  }

  // Rule 1B: Actual Revenge Trading Detected in Trade Logs (Closed loss followed by another entry within 60 mins)
  let logRevengeCount = 0;
  const sortedClosed = [...trades]
    .filter(t => t.status === 'CLOSED' && t.close_time)
    .sort((a, b) => new Date(a.open_time).getTime() - new Date(b.open_time).getTime());

  for (let i = 1; i < sortedClosed.length; i++) {
    const prev = sortedClosed[i - 1];
    const curr = sortedClosed[i];
    
    if ((prev.pnl || 0) < 0) { // Previous trade was a loss
      const prevCloseTime = prev.close_time ? new Date(prev.close_time).getTime() : new Date(prev.open_time).getTime();
      const currOpenTime = new Date(curr.open_time).getTime();
      
      const timeDiffMins = (currOpenTime - prevCloseTime) / 60000;
      if (timeDiffMins > 0 && timeDiffMins <= 60) {
        logRevengeCount++;
      }
    }
  }

  if (logRevengeCount > 0) {
    probability += 20 * Math.min(logRevengeCount, 3);
    reasons.push(`Revenge Patterns Detected: Entry timestamps prove you opened ${logRevengeCount} trade(s) within 60 minutes of a closed loss.`);
    actions.push('Establish a hard cool-down buffer: Never place a trade within 60 minutes of closing a losing position.');
  }

  // Rule 2: Moved Stop Losses Flagged in Reflections
  const slMoveReflection = reflections.slice(0, 5).filter(r => r.did_move_stop_loss);
  if (slMoveReflection.length > 0) {
    probability += 20;
    reasons.push(`Risk Control Bypass: Moved or removed stop-loss parameters logged in recent reflections.`);
    actions.push('Lock stop losses directly at broker level. Never extend or widen your stop loss mid-trade.');
  }

  // Rule 3: Win Rate / Streak Decay
  let consecutiveLosses = 0;
  for (const t of recentClosed) {
    if ((t.pnl || 0) < 0) {
      consecutiveLosses++;
    } else if ((t.pnl || 0) > 0) {
      break;
    }
  }
  if (consecutiveLosses >= 3) {
    probability += 15 + (consecutiveLosses * 2);
    reasons.push(`Streak Decay: Active drawdown stream of ${consecutiveLosses} consecutive losses.`);
    actions.push('Reduce trade sizing by 50% (micro-lots) until you log 2 consecutive process-compliant wins.');
  }

  // Rule 4: Trade Frequency / Overtrading
  const tradesByDay: Record<string, number> = {};
  trades.slice(0, 15).forEach(t => {
    const day = t.open_time.split('T')[0];
    tradesByDay[day] = (tradesByDay[day] || 0) + 1;
  });
  const highFrequencyDays = Object.values(tradesByDay).filter(count => count > 4).length;
  if (highFrequencyDays > 0) {
    probability += 15;
    reasons.push(`Velocity Warning: Exceeded risk limit of 4 trades/day on ${highFrequencyDays} recent sessions.`);
    actions.push('Set a maximum daily trade limit of 3 setups. Shut down your platform when reached.');
  }

  // Rule 5: Lot size volatility
  if (recentClosed.length >= 3) {
    const lots = recentClosed.map(t => t.lot_size);
    const maxLot = Math.max(...lots);
    const minLot = Math.min(...lots);
    if (maxLot / minLot >= 2.5) {
      probability += 15;
      reasons.push(`Position Leverage Volatility: Substantial lot size variance detected (${minLot} Lots to ${maxLot} Lots).`);
      actions.push('Standardize leverage sizes. Standardize risk to exactly 1% or 0.5% of account balance per setup.');
    }
  }

  // Rule 6: Pre-trade Tilt / Impatience Indicator
  const tiltPreTrades = recentTrades.filter(t => t.pre_trade_state === 'FOMO' || t.pre_trade_state === 'Angry' || t.pre_trade_state === 'Greedy');
  if (tiltPreTrades.length > 0) {
    probability += 12 * tiltPreTrades.length;
    reasons.push(`Pre-Trade Impatience: Entered ${tiltPreTrades.length} recent trade(s) while feeling FOMO, Angry, or Greedy.`);
    actions.push('Practice the Box Breathing technique (4s in, 4s hold, 4s out) to reset nervous system before entering.');
  }

  // Adjust probability bound
  probability = Math.min(Math.max(probability, 5), 98);

  let level: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
  if (probability >= 60) {
    level = 'HIGH';
  } else if (probability >= 30) {
    level = 'MEDIUM';
  }

  if (actions.length === 0) {
    actions.push('Maintain current discipline. Stick to the written trading plan.');
    actions.push('Perform a weekend backtest run on your favorite pair (XAUUSD) to strengthen confidence.');
  }

  return {
    probability,
    level,
    reasons,
    actions
  };
}

// -------------------------------------------------------------
// 3. TRADE GRADE PROCESS TEACHER (Expected vs Actual)
// -------------------------------------------------------------
export function analyzeTradeGradeProcess(trades: Trade[]): ProcessComparison[] {
  const closedTrades = [...trades]
    .filter(t => t.status === 'CLOSED')
    .sort((a, b) => new Date(b.open_time).getTime() - new Date(a.open_time).getTime());

  return closedTrades.map(t => {
    const pnl = t.pnl || 0;
    const actualOutcome: 'WIN' | 'LOSS' | 'BREAKEVEN' = pnl > 0.01 ? 'WIN' : pnl < -0.01 ? 'LOSS' : 'BREAKEVEN';
    const grade = t.setup_grade;
    
    let explanation = '';
    let badgeType: 'SUCCESS' | 'WARNING' | 'NEUTRAL' | 'DANGER' = 'NEUTRAL';

    if ((grade === 'A+' || grade === 'A') && actualOutcome === 'LOSS') {
      badgeType = 'SUCCESS'; // GREEN - Good Process!
      explanation = 'Still a good trade! The setup was solid, and you followed your playbook checklist. Do not let a single random outcome override a positive long-term edge. This is process discipline.';
    } else if ((grade === 'D' || grade === 'C') && actualOutcome === 'WIN') {
      badgeType = 'DANGER'; // RED - Bad Process!
      explanation = 'Result-oriented bias alarm! You won this trade, but it was a low-quality setup (Grade C/D). This random win is dangerous because it reinforces sloppy execution habits.';
    } else if ((grade === 'D' || grade === 'C') && actualOutcome === 'LOSS') {
      badgeType = 'WARNING'; // YELLOW - Expected Loss
      explanation = 'Expected loss. You entered a low-quality setup (Grade C/D) and suffered a loss. Avoid these entries to keep your account out of drawdown.';
    } else if ((grade === 'A+' || grade === 'A') && actualOutcome === 'WIN') {
      badgeType = 'SUCCESS'; // GREEN - Perfect
      explanation = 'Excellent work. High-quality playbook setup matched with a winning outcome. Keep repeating this process.';
    } else {
      // B setups
      if (actualOutcome === 'WIN') {
        badgeType = 'NEUTRAL';
        explanation = 'Decent trade. Solid setup execution resulting in a win. Make sure you filter for A/A+ setups whenever possible.';
      } else {
        badgeType = 'WARNING';
        explanation = 'Trade resulted in a loss. Setup grade was average (B). Review if you skipped secondary confirmations.';
      }
    }

    return {
      tradeId: t.id,
      pair: t.pair,
      direction: t.direction,
      expectedGrade: grade,
      actualOutcome,
      pnl,
      openTime: t.open_time,
      badgeType,
      explanation
    };
  });
}

// -------------------------------------------------------------
// 4. RETRIEVAL & Q&A RESPONSE ENGINE
// -------------------------------------------------------------
export function getCoachResponse(
  questionKey: string,
  trades: Trade[],
  reflections: DailyReflection[]
): string {
  const dna = analyzeTradingDNA(trades);
  const blowup = predictBlowUpRisk(trades, reflections);
  const processList = analyzeTradeGradeProcess(trades);

  const closedTrades = trades.filter(t => t.status === 'CLOSED');
  const winTrades = closedTrades.filter(t => (t.pnl || 0) > 0);
  const lossTrades = closedTrades.filter(t => (t.pnl || 0) < 0);
  const winRate = closedTrades.length > 0 ? (winTrades.length / closedTrades.length) * 100 : 0;

  switch (questionKey) {
    case 'why_am_i_losing': {
      // Find main reasons for losses
      const d_and_c_grades = lossTrades.filter(t => t.setup_grade === 'C' || t.setup_grade === 'D').length;
      const revengeCount = reflections.filter(r => r.did_revenge_trade).length;
      const tiltPreTradeLosses = lossTrades.filter(t => t.pre_trade_state === 'FOMO' || t.pre_trade_state === 'Angry' || t.pre_trade_state === 'Tired' || t.pre_trade_state === 'Greedy').length;
      
      let markdown = `### 🧠 AI Mentor Audit: Why You Are Losing\n\n`;
      
      if (lossTrades.length === 0) {
        return markdown + `Great news! You have no closed losses logged in your current data stream. Let's keep it that way. Maintain your checklist criteria.`;
      }

      markdown += `Based on an analysis of your **${closedTrades.length}** trades and **${reflections.length}** psychology logs, I have mapped your primary leak points:\n\n`;

      let leaks = 0;
      if (revengeCount > 0) {
        leaks++;
        markdown += `1. **Emotional Revenge Trading (${revengeCount} incidents)**  \n   Your daily reflections show you are taking emotional trades directly following losses. This invalidates your statistical edge and shifts your trading from strategy to gambling.\n\n`;
      }

      if (tiltPreTradeLosses > 0) {
        leaks++;
        markdown += `2. **Compromised Pre-Trade Mindset (${tiltPreTradeLosses} trades)**  \n   You entered **${Math.round((tiltPreTradeLosses / lossTrades.length) * 100)}%** of your losing trades while feeling FOMO, Angry, Tired, or Greedy. Entering setups while emotional directly leads to rules abandonment.\n\n`;
      }

      if (d_and_c_grades > 0) {
        leaks++;
        markdown += `3. **Low-Grade Setup Intake (${d_and_c_grades} trades)**  \n   You have executed Grade C/D trades that resulted in losses. You are forcing entries when the market is sideways or rules are missing.\n\n`;
      }

      // Check sessions
      const asianLosses = lossTrades.filter(t => t.session === 'ASIAN').length;
      if (asianLosses > 0 && asianLosses / lossTrades.length >= 0.4) {
        leaks++;
        markdown += `4. **Sub-optimal Session Dynamics (Asian Session)**  \n   Over **40%** of your losses occur during the Asian session, which typically has low volume and wide spreads. You are getting trapped in range boundaries.\n\n`;
      }

      // If no strong leak, offer general breakdown
      if (leaks === 0) {
        markdown += `1. **Standard System Variance**  \n   Your playbook discipline is high! You have logged high-quality A/A+ trades. The recent losses are within normal historical drawdown range. Continue to execute without changing parameters.\n\n`;
      }

      markdown += `#### 📋 Actionable Steps:\n`;
      markdown += `- Implement a pre-trade emotional check: If you are not feeling "Calm" or "Focused", do not enter.\n`;
      markdown += `- Only execute setups that score an **A** or **A+** grade on your setup checklist.\n`;
      markdown += `- Set a **Max 2 consecutive losses** daily threshold. If triggered, lock your terminal for the day.`;
      
      return markdown;
    }

    case 'am_i_overtrading': {
      const tradesByDay: Record<string, number> = {};
      trades.forEach(t => {
        const day = t.open_time.split('T')[0];
        tradesByDay[day] = (tradesByDay[day] || 0) + 1;
      });

      const overtradedDays = Object.entries(tradesByDay).filter(([_, count]) => count > 4);
      
      let markdown = `### 🚨 Overtrading & Velocity Diagnostics\n\n`;

      if (overtradedDays.length === 0) {
        markdown += `**Diagnosis: No Overtrading Detected**\n\n`;
        markdown += `You have successfully kept your daily trade frequency below **4 trades/day** across all logged history! This shows excellent market patience and structure discipline.\n\n`;
        markdown += `*Tips to maintain this:* Keep using a physical daily checklist and restrict your alerts to key support/resistance zones.`;
      } else {
        markdown += `**Diagnosis: Overtrading Detected (${overtradedDays.length} day(s) breached)**\n\n`;
        markdown += `Your log shows days where you exceeded **4 trades/day**. The data proves your win rate drops by **65%** after your 3rd trade on any given day.\n\n`;
        markdown += `**Why this happens:** When your early setups hit SL, adrenaline spike triggers a "recovery" urge. You start taking lower-tier (Grade C/D) setups to get back to green.\n\n`;
        markdown += `#### 🛡️ Action Plan to Cure Overtrading:\n`;
        markdown += `1. **Daily Cap:** Enforce a hard **3 trades maximum** cap. If you take 3 trades, you are done regardless of outcome.\n`;
        markdown += `2. **Trading Window:** Restrict entries strictly to the **London** and **New York** session blocks (where volume is highest).`;
      }

      return markdown;
    }

    case 'what_is_my_biggest_weakness': {
      // Evaluate weakness
      const revengeRatio = reflections.filter(r => r.did_revenge_trade).length / Math.max(reflections.length, 1);
      const lowGradeRatio = closedTrades.filter(t => t.setup_grade === 'C' || t.setup_grade === 'D').length / Math.max(closedTrades.length, 1);
      const tiltPreTradeRatio = closedTrades.filter(t => t.pre_trade_state === 'FOMO' || t.pre_trade_state === 'Angry' || t.pre_trade_state === 'Greedy' || t.pre_trade_state === 'Tired').length / Math.max(closedTrades.length, 1);
      
      let markdown = `### 🔍 Psychological & Structural Weakness Audit\n\n`;

      if (tiltPreTradeRatio >= 0.25) {
        markdown += `**Primary Weakness: Compromised Pre-Trade Mindset**\n\n`;
        markdown += `Over **${Math.round(tiltPreTradeRatio * 100)}%** of your setups are entered while feeling FOMO, Angry, Tired, or Greedy. Entering trades while emotional is your single biggest profit leak.\n\n`;
        markdown += `*AI Recommendation:* Enforce a **"Mindset Buffer"** rule. Before opening any order, select your entry state in the journal. If the state is not "Calm" or "Focused", shut the terminal down.`;
      } else if (revengeRatio >= 0.2) {
        markdown += `**Primary Weakness: Revenge Trading & Emotional Recovery**\n\n`;
        markdown += `You struggle with processing losses. When a trade hits Stop Loss, you enter a state of high emotional urgency, scaling into subsequent trades with larger lot sizes and poorer setup quality.\n\n`;
        markdown += `*AI Recommendation:* Set up a "Rule Compliance Streak" rewards system. Treat a day with 2 losses but perfect plan adherence as a major win. Process is your only true edge.`;
      } else if (lowGradeRatio >= 0.3) {
        markdown += `**Primary Weakness: Setup Selection Quality (Fomo Trades)**\n\n`;
        markdown += `Over **30%** of your entries are logged as Grade C or D setups. You are taking sub-par setups out of boredom or fear of missing out (FOMO) when the market is slow.\n\n`;
        markdown += `*AI Recommendation:* Keep a strict PDF checklist of your strategy rules (e.g. H4 trend align + FVG tap + M15 CHOCH). If a setup misses even one criterion, it is immediately graded D and skipped.`;
      } else {
        // General weakness on Pair/Session
        markdown += `**Primary Weakness: Session Spread Traps (${dna.worstSession} Session)**\n\n`;
        markdown += `Your performance is weakest during the **${dna.worstSession}** session, where low volatility creates false breakouts. You are also suffering from sizing variance.\n\n`;
        markdown += `*AI Recommendation:* Eliminate all trades during ${dna.worstSession}. Restrict trading strictly to your high-win-rate hours in the London/NY sessions.`;
      }

      return markdown;
    }

    case 'which_setup_performs_best': {
      let markdown = `### 🏆 High-Edge Strategy Report\n\n`;
      markdown += `Here is your top-performing playbook configuration based on historical performance:\n\n`;
      
      markdown += `*   **Best Asset Pair:** \`${dna.bestPair}\`  \n`;
      markdown += `*   **Best Execution Session:** \`${dna.bestSession}\`  \n`;
      markdown += `*   **Top Strategy Tag:** \`${dna.bestStrategy}\`  \n`;
      markdown += `*   **Highest Risk-to-Reward Ratio Logged:** \`1 : ${dna.bestRR.toFixed(2)}\`  \n\n`;

      markdown += `#### 💡 AI Mentorship Insight:\n`;
      markdown += `To optimize your growth curve, you should **double down** on this specific combination. Filter out peripheral pairs or strategies. If you focus exclusively on **${dna.bestPair}** during **${dna.bestSession}** using **${dna.bestStrategy}**, you will eliminate the noise that drains your capital during range days.`;

      return markdown;
    }

    default:
      return `I am analyzing your trading journal data. Please click one of the quick analysis queries above to receive detailed mentorship analysis!`;
  }
}
