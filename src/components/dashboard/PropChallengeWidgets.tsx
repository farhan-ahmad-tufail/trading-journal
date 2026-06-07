'use client';

import React from 'react';
import { Account, PropFirmProfile, Trade } from '@/types';
import { Target, AlertTriangle, ShieldCheck, Calendar, Activity, Flame } from 'lucide-react';

interface PropChallengeWidgetsProps {
  account: Account;
  profile: PropFirmProfile;
  trades: Trade[];
}

// Helper PnL Calculator
function calculatePnlEstimate(entry: number, exit: number, size: number, dir: 'LONG' | 'SHORT', symbol: string): number {
  const cleanSym = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const priceDiff = dir === 'LONG' ? (exit - entry) : (entry - exit);

  if (cleanSym.includes('XAU') || cleanSym.includes('GOLD')) return priceDiff * size * 100;
  if (cleanSym.includes('XAG') || cleanSym.includes('SILVER')) return priceDiff * size * 5000;
  if (cleanSym.includes('US30') || cleanSym.includes('DJ30') || cleanSym.includes('DOW')) return priceDiff * size * 1;
  if (cleanSym.includes('NAS100') || cleanSym.includes('NAS') || cleanSym.includes('USTEC') || cleanSym.includes('US100') || cleanSym.includes('NDX')) return priceDiff * size * 1;
  if (cleanSym.includes('SPX500') || cleanSym.includes('SPX') || cleanSym.includes('US500') || cleanSym.includes('SP500')) return priceDiff * size * 10;
  if (cleanSym.includes('GER30') || cleanSym.includes('GER40') || cleanSym.includes('DE30') || cleanSym.includes('DE40') || cleanSym.includes('DAX')) return priceDiff * size * 1;
  if (cleanSym.endsWith('JPY')) return priceDiff * size * 1000;
  if (cleanSym.length === 6) return priceDiff * size * 100000;
  return priceDiff * size;
}

export default function PropChallengeWidgets({ account, profile, trades }: PropChallengeWidgetsProps) {
  const initialSize = account.balance;
  const closedTrades = trades.filter(t => t.status === 'CLOSED');
  
  // 1. Calculate Net Profit
  const totalPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const currentBalance = initialSize + totalPnL;

  // 2. Profit Target
  const targetPct = profile.profit_target_pct || profile.phase_1_target_pct || 8;
  const targetAmount = initialSize * (targetPct / 100);
  const targetProgressPct = Math.min(Math.max((totalPnL / targetAmount) * 100, 0), 100);
  const isTargetAchieved = totalPnL >= targetAmount;

  // 3. Daily Drawdown Reset Time Bounds
  const getResetBounds = (tz?: 'Local' | 'UTC' | 'EST') => {
    const now = new Date();
    if (tz === 'UTC') {
      const start = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      return { start, end: start + 24 * 60 * 60 * 1000 };
    }
    
    if (tz === 'EST') {
      const getNYOffset = () => {
        const formatter = new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York',
          hour12: false,
          year: 'numeric',
          month: 'numeric',
          day: 'numeric',
          hour: 'numeric',
          minute: 'numeric',
          second: 'numeric'
        });
        const parts = formatter.formatToParts(now);
        const val = (name: string) => parseInt(parts.find(p => p.type === name)!.value, 10);
        const utcNY = Date.UTC(val('year'), val('month') - 1, val('day'), val('hour'), val('minute'), val('second'));
        return Math.round((utcNY - now.getTime()) / (60 * 60 * 1000));
      };
      
      const offset = getNYOffset();
      const resetHourUTC = 17 - offset;
      const todayResetUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), resetHourUTC, 0, 0);
      
      if (now.getTime() >= todayResetUTC) {
        return { start: todayResetUTC, end: todayResetUTC + 24 * 60 * 60 * 1000 };
      } else {
        return { start: todayResetUTC - 24 * 60 * 60 * 1000, end: todayResetUTC };
      }
    }
    
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    return { start, end: start + 24 * 60 * 60 * 1000 };
  };

  const { start: todayStart, end: todayEnd } = getResetBounds(profile.daily_reset_timezone);
  const todayTrades = closedTrades.filter(t => {
    if (!t.close_time) return false;
    const closeTime = new Date(t.close_time).getTime();
    return closeTime >= todayStart && closeTime < todayEnd;
  });
  
  const todayPnL = todayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
  const dailyDrawdownPct = profile.daily_drawdown_pct || 5;
  const dailyLimitAmount = initialSize * (dailyDrawdownPct / 100);
  
  const todayNetLoss = todayPnL < 0 ? Math.abs(todayPnL) : 0;
  const dailyDrawdownRemaining = Math.max(dailyLimitAmount - todayNetLoss, 0);
  const dailyDrawdownUsedPct = (todayNetLoss / dailyLimitAmount) * 100;
  const isDailyLimitBreached = todayNetLoss >= dailyLimitAmount;

  // 4. Max Drawdown
  const maxDrawdownPct = profile.max_drawdown_pct || 10;
  const maxLimitAmount = initialSize * (maxDrawdownPct / 100);
  
  const totalNetLoss = totalPnL < 0 ? Math.abs(totalPnL) : 0;
  const maxDrawdownRemaining = Math.max(maxLimitAmount - totalNetLoss, 0);
  const maxDrawdownUsedPct = (totalNetLoss / maxLimitAmount) * 100;
  const isMaxLimitBreached = totalNetLoss >= maxLimitAmount;

  // 5. Trading Days
  const openDates = new Set(
    trades
      .filter(t => t.open_time)
      .map(t => t.open_time.split('T')[0])
  );
  const tradingDaysCompleted = openDates.size;
  const minTradingDays = profile.min_trading_days || 0;
  const isTradingDaysAchieved = tradingDaysCompleted >= minTradingDays;

  // 6. Advanced Analytics & Alerts (Overtrading, Sizing Risk, Consistency)
  const tradesByDayMap: Record<string, number> = {};
  closedTrades.forEach(t => {
    const day = t.open_time.split('T')[0];
    tradesByDayMap[day] = (tradesByDayMap[day] || 0) + 1;
  });
  const totalDaysTraded = Object.keys(tradesByDayMap).length;
  const avgTradesPerDay = totalDaysTraded > 0 ? (closedTrades.length / totalDaysTraded) : 0;

  let highRiskTradeCount = 0;
  trades.forEach(t => {
    if (t.entry_price && t.stop_loss && t.lot_size) {
      const slPnl = calculatePnlEstimate(t.entry_price, t.stop_loss, t.lot_size, t.direction, t.pair);
      const riskAmount = Math.abs(slPnl);
      if (riskAmount > initialSize * 0.02) {
        highRiskTradeCount++;
      }
    }
  });

  const dailyPnLMap: Record<string, number> = {};
  closedTrades.forEach(t => {
    if (!t.close_time) return;
    const day = t.close_time.split('T')[0];
    dailyPnLMap[day] = (dailyPnLMap[day] || 0) + (t.pnl || 0);
  });
  const maxDayProfit = Math.max(...Object.values(dailyPnLMap).filter(val => val > 0), 0);
  const isConsistencyViolated = maxDayProfit > targetAmount * 0.5 && targetAmount > 0;
  const consistencyPct = targetAmount > 0 ? (maxDayProfit / targetAmount) * 100 : 0;

  const alerts: string[] = [];
  if (todayTrades.length >= 5) {
    alerts.push(`Warning: You have taken ${todayTrades.length} trades today (historical average: ${avgTradesPerDay.toFixed(1)}). Revenge trading risk is extremely high. Step away.`);
  } else if (todayTrades.length >= 3 && todayTrades.length > avgTradesPerDay * 1.5) {
    alerts.push(`Notice: Today's trade count (${todayTrades.length}) has exceeded your daily average of ${avgTradesPerDay.toFixed(1)}. Focus on quality, not volume.`);
  }

  if (highRiskTradeCount > 0) {
    alerts.push(`Risk Alarm: Detected ${highRiskTradeCount} setups risking > 2.0% of starting capital in stop-loss parameters. Reduce lot sizes immediately to preserve your evaluation desk.`);
  }

  if (isConsistencyViolated) {
    alerts.push(`Consistency Alert: Single-day profit ($${maxDayProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}) represents ${consistencyPct.toFixed(0)}% of your target (FTMO/5ers rules mandate consistency limits). Try to distribute earnings uniformly.`);
  }

  // 7. Account Health State
  let health: 'Green' | 'Yellow' | 'Red' = 'Green';
  let healthMessage = 'Account Healthy';

  if (isDailyLimitBreached || isMaxLimitBreached) {
    health = 'Red';
    healthMessage = 'Limit Breached!';
  } else if (
    dailyDrawdownRemaining < dailyLimitAmount * 0.4 ||
    maxDrawdownRemaining < maxLimitAmount * 0.4 ||
    alerts.length > 0
  ) {
    health = 'Yellow';
    healthMessage = 'Drawdown / Risk Warning';
  }

  const getHealthBadgeClass = (status: 'Green' | 'Yellow' | 'Red') => {
    switch (status) {
      case 'Red': return 'bg-red-500/10 text-red-500 border border-red-500/20';
      case 'Yellow': return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
      default: return 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/20';
    }
  };

  return (
    <div className="flex flex-col gap-4 bg-zinc-900/10 border border-zinc-900/60 p-5 rounded-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-zinc-900 pb-3">
        <div className="flex items-center gap-2">
          <Activity size={16} className="text-indigo-400" />
          <h3 className="text-sm font-bold text-zinc-200">Prop Firm Challenge Status</h3>
          <span className="text-[10px] text-zinc-500 font-medium">({profile.firm_name} - {profile.challenge_type})</span>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right hidden sm:block">
            <span className="text-[10px] text-zinc-500 font-semibold block uppercase">Current Balance</span>
            <span className="text-xs font-bold text-zinc-300">${currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Health:</span>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wide flex items-center gap-1 ${getHealthBadgeClass(health)}`}>
              {health === 'Red' && <AlertTriangle size={10} />}
              {health === 'Green' && <ShieldCheck size={10} />}
              {health === 'Yellow' && <AlertTriangle size={10} />}
              {healthMessage}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-1">
        <div className="bg-zinc-950/40 border border-zinc-900/60 p-4 rounded-lg flex flex-col justify-between h-28 relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide">Profit Target</span>
              <span className="text-lg font-bold text-white">${totalPnL >= 0 ? '+' : ''}{totalPnL.toLocaleString(undefined, { maximumFractionDigits: 0 })} / ${targetAmount.toLocaleString()}</span>
            </div>
            <Target size={14} className={isTargetAchieved ? 'text-emerald-400' : 'text-zinc-500'} />
          </div>
          <div className="flex flex-col gap-1.5 mt-2">
            <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-500">
              <span>{targetProgressPct.toFixed(0)}% Completed</span>
              <span className={isTargetAchieved ? 'text-emerald-400 font-bold' : ''}>
                {isTargetAchieved ? 'Goal Passed' : `Need $${Math.max(targetAmount - totalPnL, 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              </span>
            </div>
            <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${isTargetAchieved ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                style={{ width: `${targetProgressPct}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-zinc-950/40 border border-zinc-900/60 p-4 rounded-lg flex flex-col justify-between h-28 relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide">Daily Limit ({dailyDrawdownPct}% - {profile.daily_reset_timezone || 'Local'})</span>
              <span className={`text-lg font-bold ${isDailyLimitBreached ? 'text-red-500' : 'text-white'}`}>
                -${todayNetLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })} / -${dailyLimitAmount.toLocaleString()}
              </span>
            </div>
            <AlertTriangle size={14} className={isDailyLimitBreached ? 'text-red-500 animate-pulse' : 'text-zinc-500'} />
          </div>
          <div className="flex flex-col gap-1.5 mt-2">
            <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-500">
              <span>{dailyDrawdownUsedPct.toFixed(0)}% Used</span>
              <span className={isDailyLimitBreached ? 'text-red-400 font-bold' : dailyDrawdownRemaining < dailyLimitAmount * 0.4 ? 'text-amber-500' : 'text-zinc-450'}>
                {isDailyLimitBreached ? 'Failed' : `$${dailyDrawdownRemaining.toLocaleString(undefined, { maximumFractionDigits: 0 })} Left`}
              </span>
            </div>
            <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  isDailyLimitBreached ? 'bg-red-500' : dailyDrawdownUsedPct > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(dailyDrawdownUsedPct, 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-zinc-950/40 border border-zinc-900/60 p-4 rounded-lg flex flex-col justify-between h-28 relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide">Max Drawdown ({maxDrawdownPct}%)</span>
              <span className={`text-lg font-bold ${isMaxLimitBreached ? 'text-red-500' : 'text-white'}`}>
                -${totalNetLoss.toLocaleString(undefined, { maximumFractionDigits: 0 })} / -${maxLimitAmount.toLocaleString()}
              </span>
            </div>
            <AlertTriangle size={14} className={isMaxLimitBreached ? 'text-red-500 animate-pulse' : 'text-zinc-500'} />
          </div>
          <div className="flex flex-col gap-1.5 mt-2">
            <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-500">
              <span>{maxDrawdownUsedPct.toFixed(0)}% Used</span>
              <span className={isMaxLimitBreached ? 'text-red-400 font-bold' : maxDrawdownRemaining < maxLimitAmount * 0.4 ? 'text-amber-500' : 'text-zinc-450'}>
                {isMaxLimitBreached ? 'Failed' : `$${maxDrawdownRemaining.toLocaleString(undefined, { maximumFractionDigits: 0 })} Left`}
              </span>
            </div>
            <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-300 ${
                  isMaxLimitBreached ? 'bg-red-500' : maxDrawdownUsedPct > 60 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${Math.min(maxDrawdownUsedPct, 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-zinc-950/40 border border-zinc-900/60 p-4 rounded-lg flex flex-col justify-between h-28 relative overflow-hidden">
          <div className="flex items-start justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide">Min Trading Days</span>
              <span className="text-lg font-bold text-white">
                {tradingDaysCompleted} / {minTradingDays} Days
              </span>
            </div>
            <Calendar size={14} className={isTradingDaysAchieved ? 'text-emerald-400' : 'text-zinc-500'} />
          </div>
          <div className="flex flex-col gap-1.5 mt-2">
            <div className="flex items-center justify-between text-[10px] font-semibold text-zinc-500">
              <span>{minTradingDays > 0 ? `${Math.min((tradingDaysCompleted / minTradingDays) * 100, 100).toFixed(0)}%` : '100%'} Completed</span>
              <span className={isTradingDaysAchieved ? 'text-emerald-400 font-bold' : ''}>
                {isTradingDaysAchieved ? 'Met requirement' : `${minTradingDays - tradingDaysCompleted} Days Left`}
              </span>
            </div>
            <div className="w-full h-1.5 bg-zinc-900 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-300 bg-emerald-500`}
                style={{ width: `${minTradingDays > 0 ? Math.min((tradingDaysCompleted / minTradingDays) * 100, 100) : 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="flex flex-col gap-2 mt-2 border-t border-zinc-900 pt-3">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Prop Desk Warnings</span>
          <div className="flex flex-col gap-2">
            {alerts.map((alertMsg, idx) => (
              <div key={idx} className="flex items-start gap-2.5 bg-amber-500/5 border border-amber-500/10 p-3 rounded-lg text-amber-500 text-xs">
                <AlertTriangle size={15} className="shrink-0 mt-0.5 animate-pulse" />
                <span>{alertMsg}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
