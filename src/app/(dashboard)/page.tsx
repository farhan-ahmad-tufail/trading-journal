'use client';

import React, { useState, useEffect } from 'react';
import { fetchTrades, fetchReflections } from '@/lib/db';
import { Trade, DailyReflection } from '@/types';
import { predictBlowUpRisk } from '@/lib/coach';
import { useAccount } from '@/components/AccountProvider';
import PropChallengeWidgets from '@/components/dashboard/PropChallengeWidgets';
import { 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  Percent, 
  DollarSign, 
  Award, 
  AlertCircle,
  Brain,
  ChevronRight,
  Plus,
  ArrowRight
} from 'lucide-react';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isStart = data.name === 'Start';
    return (
      <div className="bg-zinc-950 border border-zinc-800/80 p-3 rounded-lg shadow-xl text-xs font-sans">
        <p className="text-zinc-550 mb-1 font-semibold">{data.date}</p>
        <p className="text-sm font-bold text-zinc-100 mb-1">
          Balance: ${data.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        {!isStart && (
          <div className="flex flex-col gap-0.5 mt-1 pt-1 border-t border-zinc-900">
            <p className="text-zinc-400">
              PnL: <span className={data.pnl >= 0 ? 'text-emerald-500' : 'text-red-500'}>
                {data.pnl >= 0 ? '+' : ''}${data.pnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </p>
            <p className="text-zinc-400">
              Setup: <span className="text-zinc-200">{data.pair} ({data.direction})</span>
            </p>
          </div>
        )}
      </div>
    );
  }
  return null;
};

export default function DashboardPage() {
  const { activeAccount, activeProfile, loading: accountLoading } = useAccount();

  const [trades, setTrades] = useState<Trade[]>([]);
  const [reflections, setReflections] = useState<DailyReflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalTrades: 0,
    winRate: 0,
    netProfit: 0,
    avgRR: 0,
  });
  const [hasReflectedToday, setHasReflectedToday] = useState(false);
  const [blowUpProbability, setBlowUpProbability] = useState<number | null>(null);
  const [blowUpLevel, setBlowUpLevel] = useState<'LOW' | 'MEDIUM' | 'HIGH' | null>(null);

  useEffect(() => {
    if (accountLoading) return;
    if (!activeAccount) {
      setLoading(false);
      return;
    }

    async function loadDashboardData() {
      setLoading(true);
      try {
        const [tradesData, reflectionsData] = await Promise.all([
          fetchTrades(activeAccount!.id),
          fetchReflections(activeAccount!.id)
        ]);
        
        setTrades(tradesData);
        setReflections(reflectionsData);
        
        // 1. Calculate Stats
        const total = tradesData.length;
        const closedTrades = tradesData.filter(t => t.status === 'CLOSED');
        const winTrades = closedTrades.filter(t => (t.pnl || 0) > 0);
        const winRate = closedTrades.length > 0 ? (winTrades.length / closedTrades.length) * 100 : 0;
        
        const netProfit = closedTrades.reduce((acc, t) => acc + Number(t.pnl || 0), 0);
        
        // Calculate average RR for trades with active SL/TP
        let rrSum = 0;
        let rrCount = 0;
        tradesData.forEach(t => {
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

        setStats({
          totalTrades: total,
          winRate,
          netProfit,
          avgRR,
        });

        // 2. Check if reflected today
        const todayStr = new Date().toISOString().split('T')[0];
        const reflected = reflectionsData.some(r => r.reflection_date === todayStr);
        setHasReflectedToday(reflected);

        // 3. Calculate Blow-Up Risk
        const risk = predictBlowUpRisk(tradesData, reflectionsData);
        setBlowUpProbability(risk.probability);
        setBlowUpLevel(risk.level);

      } catch (err) {
        console.error('Failed to load dashboard metrics', err);
      } finally {
        setLoading(false);
      }
    }

    loadDashboardData();
  }, [activeAccount?.id, accountLoading]);

  if (accountLoading || (loading && activeAccount)) {
    return (
      <div className="flex flex-col gap-6 w-full py-8 text-zinc-400 font-sans">
        <div className="h-8 w-48 animate-pulse bg-zinc-900 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(n => (
            <div key={n} className="h-28 animate-pulse bg-zinc-900 border border-zinc-900/60 rounded-xl" />
          ))}
        </div>
        <div className="h-64 animate-pulse bg-zinc-900 border border-zinc-900/60 rounded-xl w-full" />
      </div>
    );
  }

  // If no account exists
  if (!activeAccount) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-4 py-12 px-4 font-sans">
        <div className="h-16 w-16 bg-zinc-900 border border-zinc-800 flex items-center justify-center rounded-2xl text-zinc-500 shadow-md">
          <Layers size={28} />
        </div>
        <div className="flex flex-col gap-1.5 max-w-sm">
          <h2 className="text-lg font-bold text-white">No Trading Profile Selected</h2>
          <p className="text-sm text-zinc-500">Create a Demo, Live, or Prop Firm Challenge account to access stats, dashboard analytics, and psychological coaching.</p>
        </div>
        <Link
          href="/accounts"
          className="flex items-center gap-2 bg-indigo-650 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer shadow-md mt-2"
        >
          <Plus size={16} />
          <span>Manage Accounts</span>
        </Link>
      </div>
    );
  }

  const recentTrades = trades.slice(0, 5);
  const isPropAccount = activeAccount.account_type === 'Prop Challenge' || activeAccount.account_type === 'Funded Account';

  // Calculate running balance data points for closed trades
  const closedTrades = [...trades]
    .filter(t => t.status === 'CLOSED')
    .sort((a, b) => new Date(a.close_time || a.open_time).getTime() - new Date(b.close_time || b.open_time).getTime());

  // Derive starting capital: current balance minus sum of all closed PnL
  const totalClosedPnL = closedTrades.reduce((sum, t) => sum + Number(t.pnl || 0), 0);
  const startingCapital = activeAccount.balance - totalClosedPnL;

  let balanceSum = startingCapital;
  const chartData = [
    {
      name: 'Start',
      balance: balanceSum,
      date: 'Starting Capital',
      pnl: 0,
      pair: '',
      direction: ''
    },
    ...closedTrades.map((t, idx) => {
      balanceSum += Number(t.pnl || 0);
      return {
        name: `Trade ${idx + 1}`,
        balance: balanceSum,
        date: new Date(t.close_time || t.open_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
        pnl: Number(t.pnl || 0),
        pair: t.pair,
        direction: t.direction
      };
    })
  ];


  return (
    <div className="flex flex-col gap-6 w-full font-sans pb-12">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-white">{activeAccount.name} Dashboard</h1>
          <p className="text-sm text-zinc-400">Track metrics, drawdown parameters, and cognitive trading performance.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/journal"
            className="flex items-center gap-2 bg-indigo-650 hover:bg-indigo-500 text-white px-4 py-2 rounded-md text-sm font-semibold transition-colors cursor-pointer shadow-md"
          >
            <Plus size={16} />
            <span>New Trade</span>
          </Link>
        </div>
      </div>

      {/* Prop Firm Drawdown & Target Widgets */}
      {isPropAccount && activeProfile && (
        <PropChallengeWidgets account={activeAccount} profile={activeProfile} trades={trades} />
      )}

      {/* Checklist Reminder */}
      {!hasReflectedToday && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-amber-500/5 border border-amber-500/15 p-4 rounded-xl text-amber-500">
          <div className="flex items-center gap-3">
            <AlertCircle size={20} className="shrink-0 mt-0.5 sm:mt-0" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-zinc-200">Daily Reflection Needed</span>
              <span className="text-xs text-zinc-500 mt-0.5">Protect your streak! Take 1 minute to log your mindset and rule compliance for today.</span>
            </div>
          </div>
          <Link
            href="/reflection"
            className="flex items-center gap-1.5 text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/10 px-3 py-1.5 rounded-md text-xs font-semibold tracking-wide uppercase transition-colors shrink-0"
          >
            <Brain size={14} />
            <span>Reflect Now</span>
          </Link>
        </div>
      )}

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Trades */}
        <div className="bg-zinc-900/40 border border-zinc-900/60 p-5 rounded-xl flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Total Trades</span>
            <span className="text-2xl font-bold text-white tracking-tight">{stats.totalTrades}</span>
          </div>
          <div className="h-10 w-10 bg-zinc-800/40 border border-zinc-800 flex items-center justify-center rounded-lg text-zinc-400">
            <Layers size={18} />
          </div>
        </div>

        {/* Win Rate */}
        <div className="bg-zinc-900/40 border border-zinc-900/60 p-5 rounded-xl flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Win Rate</span>
            <span className="text-2xl font-bold text-white tracking-tight">{stats.winRate.toFixed(1)}%</span>
          </div>
          <div className="h-10 w-10 bg-zinc-800/40 border border-zinc-800 flex items-center justify-center rounded-lg text-indigo-400">
            <Percent size={18} />
          </div>
        </div>

        {/* Net Profit */}
        <div className="bg-zinc-900/40 border border-zinc-900/60 p-5 rounded-xl flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Net Profit</span>
            <span className={`text-2xl font-bold tracking-tight ${stats.netProfit >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
              {stats.netProfit >= 0 ? '+' : ''}${stats.netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>
          <div className={`h-10 w-10 bg-zinc-800/40 border border-zinc-800 flex items-center justify-center rounded-lg ${stats.netProfit >= 0 ? 'text-emerald-450' : 'text-red-400'}`}>
            <DollarSign size={18} />
          </div>
        </div>

        {/* Average R:R */}
        <div className="bg-zinc-900/40 border border-zinc-900/60 p-5 rounded-xl flex items-center justify-between">
          <div className="flex flex-col gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Average R:R</span>
            <span className="text-2xl font-bold text-white tracking-tight">1 : {stats.avgRR.toFixed(2)}</span>
          </div>
          <div className="h-10 w-10 bg-zinc-800/40 border border-zinc-800 flex items-center justify-center rounded-lg text-amber-500">
            <Award size={18} />
          </div>
        </div>
      </div>

      {/* Capital Growth Curve Chart */}
      <div className="bg-zinc-900/20 border border-zinc-900/60 p-5 rounded-xl flex flex-col gap-4">
        <div className="flex flex-col">
          <h3 className="text-base font-bold text-white">Capital Growth Curve</h3>
          <p className="text-xs text-zinc-500">Cumulative account balance progression from closed trades.</p>
        </div>
        {closedTrades.length === 0 ? (
          <div className="h-64 w-full flex flex-col items-center justify-center gap-2 text-zinc-600 border border-dashed border-zinc-900 rounded-lg mt-2">
            <TrendingUp size={28} className="text-zinc-800" />
            <span className="text-sm font-semibold text-zinc-600">No closed trades yet</span>
            <span className="text-xs text-zinc-700">Close your first trade to see the growth curve.</span>
          </div>
        ) : (
          <div className="h-64 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#18181b" strokeDasharray="3 3" vertical={false} />
                <XAxis 
                  dataKey="name" 
                  stroke="#52525b" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false}
                  dy={10}
                />
                <YAxis 
                  stroke="#52525b" 
                  fontSize={11} 
                  tickLine={false} 
                  axisLine={false}
                  tickFormatter={(value) => `$${value.toLocaleString()}`}
                  domain={['auto', 'auto']}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="balance" 
                  stroke="#6366f1" 
                  strokeWidth={2}
                  fillOpacity={1} 
                  fill="url(#colorBalance)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Main Section Layout */}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Trades Ledger (Left 2 cols) */}
        <div className="lg:col-span-2 bg-zinc-900/20 border border-zinc-900/60 rounded-xl p-5 flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <h3 className="text-base font-bold text-white">Recent Activity</h3>
              <p className="text-xs text-zinc-500">Latest trade setups logged in this account.</p>
            </div>
            <Link 
              href="/history"
              className="flex items-center gap-1 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors uppercase tracking-wider"
            >
              <span>View History</span>
              <ChevronRight size={14} />
            </Link>
          </div>

          <div className="flex flex-col divide-y divide-zinc-900 border-t border-zinc-900/50 mt-1">
            {recentTrades.length === 0 ? (
              <div className="py-8 text-center text-zinc-600 text-sm">
                No trades logged yet. Click &quot;New Trade&quot; above to log your first trade setup!
              </div>
            ) : (
              recentTrades.map((trade) => {
                const isWin = trade.status === 'CLOSED' && (trade.pnl || 0) > 0;
                const isLoss = trade.status === 'CLOSED' && (trade.pnl || 0) < 0;
                return (
                  <div key={trade.id} className="py-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      {/* Direction Badge */}
                      <div className={`h-8 w-8 shrink-0 flex items-center justify-center rounded text-[10px] font-bold tracking-wider ${
                        trade.direction === 'LONG' 
                          ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                          : 'bg-red-500/10 text-red-500 border border-red-500/20'
                      }`}>
                        {trade.direction}
                      </div>
                      
                      <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold text-zinc-200">{trade.pair}</span>
                        <span className="text-xs text-zinc-500 truncate mt-0.5">
                          {trade.status === 'CLOSED' 
                            ? `Closed: ${new Date(trade.close_time || '').toLocaleDateString()}`
                            : `Opened: ${new Date(trade.open_time).toLocaleDateString()} (Running)`
                          }
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-6">
                      {/* Lot Size */}
                      <div className="hidden sm:flex flex-col items-end">
                        <span className="text-xs text-zinc-500">Volume</span>
                        <span className="text-sm font-semibold text-zinc-300">{trade.lot_size} Lots</span>
                      </div>

                      {/* Profit Badge */}
                      <div className="flex flex-col items-end shrink-0 min-w-[80px]">
                        {trade.status === 'OPEN' ? (
                          <span className="text-xs font-semibold text-zinc-400 bg-zinc-800 px-2 py-0.5 rounded border border-zinc-700">
                            OPEN
                          </span>
                        ) : (
                          <>
                            <span className={`text-sm font-bold ${isWin ? 'text-emerald-500' : isLoss ? 'text-red-500' : 'text-zinc-400'}`}>
                              {isWin ? '+' : ''}${Number(trade.pnl || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span className="text-[10px] text-zinc-500 mt-0.5 font-medium">
                              PnL
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Trade Psychology / Goals Panel (Right 1 col) */}
        <div className="bg-zinc-900/20 border border-zinc-900/60 rounded-xl p-5 flex flex-col gap-4">
          <div className="flex flex-col">
            <h3 className="text-base font-bold text-white">Psychology Pulse</h3>
            <p className="text-xs text-zinc-500">Current behavior alerts and plan execution.</p>
          </div>

          <div className="flex-1 flex flex-col gap-4 justify-between mt-2">
            <div className="flex flex-col gap-3">
              {/* AI Account Shield (Blow-up Predictor) */}
              <div className="bg-zinc-900/40 border border-zinc-900/60 p-4 rounded-lg flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-xs text-zinc-500">AI Account Shield</span>
                  <span className="text-sm font-bold text-zinc-300 mt-1">7-Day Failure Risk</span>
                </div>
                {blowUpProbability !== null && (
                  <div className={`text-xs font-bold px-2 py-1 rounded border ${
                    blowUpLevel === 'HIGH'
                      ? 'bg-red-500/10 text-red-400 border-red-500/20 animate-pulse'
                      : blowUpLevel === 'MEDIUM'
                      ? 'bg-amber-500/10 text-amber-550 border-amber-500/20'
                      : 'bg-emerald-500/10 text-emerald-450 border-emerald-500/20'
                  }`}>
                    {blowUpProbability}% {blowUpLevel}
                  </div>
                )}
              </div>

              {/* Behavior Alerts list */}
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Recent Violations</span>
                
                {reflections.some(r => r.did_revenge_trade) ? (
                  <div className="flex items-start gap-2.5 bg-red-500/5 border border-red-500/10 p-3 rounded text-red-400 text-xs">
                    <TrendingDown size={14} className="shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-zinc-200">Revenge Trading Alert</span>
                      <span>Emotional scaling detected in reflections. Take a break.</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2.5 bg-emerald-500/5 border border-emerald-500/10 p-3 rounded text-emerald-450 text-xs">
                    <TrendingUp size={14} className="shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-zinc-200">Discipline Intact</span>
                      <span>No revenge trading patterns logged in recent reflections. Keep it up!</span>
                    </div>
                  </div>
                )}

                {reflections.some(r => r.did_move_stop_loss) && (
                  <div className="flex items-start gap-2.5 bg-amber-500/5 border border-amber-500/10 p-3 rounded text-amber-500 text-xs">
                    <AlertCircle size={14} className="shrink-0 mt-0.5" />
                    <div className="flex flex-col gap-0.5">
                      <span className="font-semibold text-zinc-200">SL Movements Flagged</span>
                      <span>You moved your stop loss lower on recent sessions. Enforce risk caps.</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Link
              href="/coach"
              className="bg-indigo-650/10 border border-indigo-500/25 p-4 rounded-lg text-indigo-405 text-xs leading-relaxed hover:bg-indigo-650/15 hover:border-indigo-500/40 transition-all flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Brain size={16} className="shrink-0" />
                <div className="flex flex-col gap-0.5 text-left">
                  <span className="font-semibold text-zinc-200">Consult AI Coach</span>
                  <span>Get DNA breakdown & detailed advice</span>
                </div>
              </div>
              <ChevronRight size={14} className="text-indigo-400 shrink-0" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
