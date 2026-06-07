'use client';

import React, { useState, useEffect } from 'react';
import { fetchTrades, fetchReflections } from '@/lib/db';
import { Trade, DailyReflection } from '@/types';
import { useAccount } from '@/components/AccountProvider';
import {
  analyzeTradingDNA,
  predictBlowUpRisk,
  analyzeTradeGradeProcess,
  getCoachResponse,
  DNAStats,
  BlowUpRisk,
  ProcessComparison
} from '@/lib/coach';
import {
  Brain,
  ShieldAlert,
  Flame,
  Award,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  MessageSquare,
  Send,
  Zap,
  ArrowRight,
  RefreshCw,
  PlusCircle,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';

export default function AICoachPage() {
  const { activeAccount, loading: accountLoading } = useAccount();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [reflections, setReflections] = useState<DailyReflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Coach Chat states
  const [activeTab, setActiveTab] = useState<'INSIGHTS' | 'PROCESS' | 'CHAT'>('INSIGHTS');
  const [chatQuestion, setChatQuestion] = useState('');
  const [chatResponse, setChatResponse] = useState<string | null>(null);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [customQuestionInput, setCustomQuestionInput] = useState('');

  const loadData = async () => {
    if (!activeAccount) return;
    try {
      const [tradesData, reflectionsData] = await Promise.all([
        fetchTrades(activeAccount.id),
        fetchReflections(activeAccount.id)
      ]);
      setTrades(tradesData);
      setReflections(reflectionsData);
    } catch (err) {
      console.error('Failed to load coach metrics', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (accountLoading) return;
    if (!activeAccount) {
      setLoading(false);
      return;
    }
    loadData();
  }, [activeAccount?.id, accountLoading]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handlePromptClick = (questionKey: string, questionText: string) => {
    setSelectedPrompt(questionKey);
    const response = getCoachResponse(questionKey, trades, reflections);
    setChatResponse(response);
  };

  const handleCustomQuestionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuestionInput.trim()) return;

    const query = customQuestionInput.trim().toLowerCase();
    let response = '';

    // Route query keyword matches to coach endpoints or build dynamic fallback
    if (query.includes('lose') || query.includes('loss') || query.includes('losing')) {
      response = getCoachResponse('why_am_i_losing', trades, reflections);
    } else if (query.includes('overtrade') || query.includes('frequency') || query.includes('many')) {
      response = getCoachResponse('am_i_overtrading', trades, reflections);
    } else if (query.includes('weakness') || query.includes('fault') || query.includes('mistake')) {
      response = getCoachResponse('what_is_my_biggest_weakness', trades, reflections);
    } else if (query.includes('best') || query.includes('setup') || query.includes('perform') || query.includes('win')) {
      response = getCoachResponse('which_setup_performs_best', trades, reflections);
    } else {
      // General NLP fallback based on stats
      const dna = analyzeTradingDNA(trades);
      response = `### 🧠 AI Trading Mentor\n\nI analyzed your query: *"${customQuestionInput}"*\n\nBased on your database of **${trades.length}** trades:\n\n*   Your best asset pair is **${dna.bestPair}**.\n*   Your top strategy setup is **${dna.bestStrategy}**.\n*   Your highest win rate is logged during the **${dna.bestSession}** session.\n\n*Recommendation:* Stick strictly to your high-probability hours and avoid forcing entries during low-volume periods.`;
    }

    setChatResponse(response);
    setSelectedPrompt('custom');
    setChatQuestion(customQuestionInput);
    setCustomQuestionInput('');
  };

  if (accountLoading || (loading && activeAccount)) {
    return (
      <div className="flex flex-col gap-6 w-full py-8 text-zinc-400 font-sans">
        <div className="h-8 w-48 animate-pulse bg-zinc-900 rounded" />
        <div className="h-64 animate-pulse bg-zinc-900 border border-zinc-900/60 rounded-xl w-full" />
      </div>
    );
  }

  if (!activeAccount) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-4 py-12 px-4 font-sans">
        <div className="h-16 w-16 bg-zinc-900 border border-zinc-800 flex items-center justify-center rounded-2xl text-zinc-500 shadow-md">
          <Brain size={28} />
        </div>
        <div className="flex flex-col gap-1.5 max-w-sm">
          <h2 className="text-lg font-bold text-white">No Trading Profile Selected</h2>
          <p className="text-sm text-zinc-500">Create a Demo, Live, or Prop Firm Challenge account first to access AI coaching insights.</p>
        </div>
        <Link
          href="/accounts"
          className="flex items-center gap-2 bg-indigo-650 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer shadow-md mt-2"
        >
          <PlusCircle size={16} />
          <span>Manage Accounts</span>
        </Link>
      </div>
    );
  }

  // Run analytical engines
  const dna = analyzeTradingDNA(trades);
  const blowup = predictBlowUpRisk(trades, reflections);
  const processComparisons = analyzeTradeGradeProcess(trades);

  // Format probability color/borders
  const getRiskColor = (level: string) => {
    switch (level) {
      case 'HIGH': return { text: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', hoverBorder: 'hover:border-red-500/40' };
      case 'MEDIUM': return { text: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', hoverBorder: 'hover:border-amber-500/40' };
      default: return { text: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', hoverBorder: 'hover:border-emerald-500/40' };
    }
  };

  const riskStyles = getRiskColor(blowup.level);

  return (
    <div className="flex flex-col gap-6 w-full font-sans pb-12">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-900 pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-indigo-500 animate-pulse" />
            <h1 className="text-2xl font-bold tracking-tight text-white">AI Trading Coach</h1>
          </div>
          <p className="text-sm text-zinc-400">Discover your DNA metrics, predict drawdowns, and audit process quality.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-indigo-600/10 border border-indigo-500/15 px-3 py-1.5 rounded-lg text-indigo-400 text-xs font-semibold">
            <span>Profile: <strong className="text-zinc-200">{activeAccount.name}</strong></span>
          </div>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 px-3 py-2 rounded-md text-xs font-semibold tracking-wide transition-colors cursor-pointer"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span>Sync Live Stats</span>
          </button>
        </div>
      </div>

      {/* Tabs Selector Navigation */}
      <div className="flex border-b border-zinc-900 pb-px">
        <button
          onClick={() => setActiveTab('INSIGHTS')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'INSIGHTS'
              ? 'border-indigo-650 text-indigo-400 bg-indigo-500/[0.02]'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Trading DNA & Risk
        </button>
        <button
          onClick={() => setActiveTab('PROCESS')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'PROCESS'
              ? 'border-indigo-650 text-indigo-400 bg-indigo-500/[0.02]'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Process Teacher ({processComparisons.length})
        </button>
        <button
          onClick={() => setActiveTab('CHAT')}
          className={`px-4 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
            activeTab === 'CHAT'
              ? 'border-indigo-650 text-indigo-400 bg-indigo-500/[0.02]'
              : 'border-transparent text-zinc-500 hover:text-zinc-300'
          }`}
        >
          AI Mentorship Console
        </button>
      </div>

      {/* -------------------------------------------------------------
          TAB 1: TRADING DNA & RISK
          ------------------------------------------------------------- */}
      {activeTab === 'INSIGHTS' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left / Center columns: DNA Engine & Analysis */}
          <div className="lg:col-span-2 flex flex-col gap-6">
            
            {/* Trading DNA Engine Metrics */}
            <div className="bg-zinc-900/20 border border-zinc-900/60 rounded-xl p-5 flex flex-col gap-4">
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Pattern Detection Engine</h3>
                <p className="text-xs text-zinc-500 mt-1">Calculated variables mapping your statistical edges.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-1">
                <div className="bg-zinc-950/40 border border-zinc-900/60 p-4 rounded-lg flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide">Best Session</span>
                  <span className="text-sm font-bold text-white uppercase">{dna.bestSession.replace('_', ' ')}</span>
                </div>
                <div className="bg-zinc-950/40 border border-zinc-900/60 p-4 rounded-lg flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide">Worst Session</span>
                  <span className="text-sm font-bold text-red-400 uppercase">{dna.worstSession.replace('_', ' ')}</span>
                </div>
                <div className="bg-zinc-950/40 border border-zinc-900/60 p-4 rounded-lg flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide">Best Asset Pair</span>
                  <span className="text-sm font-bold text-emerald-400 uppercase">{dna.bestPair}</span>
                </div>
                <div className="bg-zinc-950/40 border border-zinc-900/60 p-4 rounded-lg flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide">Worst Asset Pair</span>
                  <span className="text-sm font-bold text-red-400 uppercase">{dna.worstPair}</span>
                </div>
                <div className="bg-zinc-950/40 border border-zinc-900/60 p-4 rounded-lg flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide">Top Strategy</span>
                  <span className="text-sm font-bold text-indigo-400">{dna.bestStrategy}</span>
                </div>
                <div className="bg-zinc-950/40 border border-zinc-900/60 p-4 rounded-lg flex flex-col gap-1">
                  <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide">Max Risk-to-Reward</span>
                  <span className="text-sm font-bold text-amber-500">1 : {dna.bestRR.toFixed(1)}</span>
                </div>
              </div>
            </div>

            {/* Wins most when vs Loses most when */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Wins Most */}
              <div className="bg-emerald-950/5 border border-emerald-950/20 p-5 rounded-xl flex flex-col gap-3">
                <div className="flex items-center gap-2 text-emerald-500">
                  <TrendingUp size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">Statistical Edge Boosters</span>
                </div>
                <ul className="flex flex-col gap-2 mt-1">
                  {dna.winsMostWhen.map((item, idx) => (
                    <li key={idx} className="text-xs text-zinc-300 flex items-start gap-2">
                      <span className="text-emerald-500 mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Loses Most */}
              <div className="bg-red-950/5 border border-red-950/20 p-5 rounded-xl flex flex-col gap-3">
                <div className="flex items-center gap-2 text-red-500">
                  <TrendingDown size={16} />
                  <span className="text-xs font-bold uppercase tracking-wider">Leaking Points & Pitfalls</span>
                </div>
                <ul className="flex flex-col gap-2 mt-1">
                  {dna.losesMostWhen.map((item, idx) => (
                    <li key={idx} className="text-xs text-zinc-300 flex items-start gap-2">
                      <span className="text-red-500 mt-0.5">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

          </div>

          {/* Right column: AI Blow-Up Predictor Card */}
          <div className="flex flex-col">
            <div className={`bg-zinc-900/20 border rounded-xl p-5 flex flex-col gap-4 transition-all h-full ${riskStyles.border}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldAlert className={`h-5 w-5 ${riskStyles.text}`} />
                  <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-350">Blow-up Predictor</h3>
                </div>
                <span className={`text-[10px] font-black px-2 py-0.5 rounded ${riskStyles.bg} ${riskStyles.text} border ${riskStyles.border}`}>
                  {blowup.level} RISK
                </span>
              </div>

              {/* Prediction Probability Gauge */}
              <div className="flex flex-col items-center justify-center py-4 bg-zinc-950/30 border border-zinc-900/40 rounded-lg relative overflow-hidden">
                <div className="flex flex-col items-center z-10">
                  <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest">7-Day Failure Risk</span>
                  <span className={`text-4xl font-extrabold tracking-tighter mt-1.5 ${riskStyles.text}`}>
                    {blowup.probability}%
                  </span>
                  <span className="text-[10px] text-zinc-500 mt-2 text-center max-w-[200px]">
                    Probability of hitting prop firm drawdown limit or account failure.
                  </span>
                </div>
                
                {/* Horizontal slider bar display */}
                <div className="w-4/5 h-1.5 bg-zinc-900 rounded-full mt-4 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all ${
                      blowup.level === 'HIGH' ? 'bg-red-500' : blowup.level === 'MEDIUM' ? 'bg-amber-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${blowup.probability}%` }}
                  />
                </div>
              </div>

              {/* Reasons */}
              <div className="flex flex-col gap-2 mt-1">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Risk Indicators</span>
                {blowup.reasons.length === 0 ? (
                  <span className="text-xs text-zinc-400 italic">No alarming risk factors flagged in your recent activities. Keep maintaining checklist rules.</span>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {blowup.reasons.map((reason, idx) => (
                      <li key={idx} className="text-xs text-zinc-300 flex items-start gap-2 bg-zinc-950/20 border border-zinc-900/30 p-2 rounded">
                        <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                        <span>{reason}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Action Steps */}
              <div className="flex flex-col gap-2 mt-1">
                <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Suggested Shield Actions</span>
                <ul className="flex flex-col gap-2">
                  {blowup.actions.map((act, idx) => (
                    <li key={idx} className="text-xs text-zinc-300 flex items-start gap-2">
                      <CheckCircle2 size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                      <span>{act}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 2: PROCESS TEACHER (Expected vs Actual Outcome)
          ------------------------------------------------------------- */}
      {activeTab === 'PROCESS' && (
        <div className="bg-zinc-900/20 border border-zinc-900/60 rounded-xl p-5 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 border-b border-zinc-900 pb-3">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Process Teacher Engine</h3>
              <p className="text-xs text-zinc-500 mt-1">
                Evaluates Setup Quality (Checklist Grade) against actual trade outcomes. Result-oriented bias makes you repeat bad setups. This panel helps fix your habit loop.
              </p>
            </div>
            
            {/* Quick Process Stats */}
            <div className="flex gap-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                A/A+ Setups: {processComparisons.filter(p => p.expectedGrade === 'A+' || p.expectedGrade === 'A').length}
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 whitespace-nowrap">
                C/D Setups: {processComparisons.filter(p => p.expectedGrade === 'C' || p.expectedGrade === 'D').length}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-4 mt-2">
            {processComparisons.length === 0 ? (
              <div className="py-12 text-center text-zinc-600 text-xs">
                No closed trades logged. Complete a trade in your journal and assign it a Setup Quality grade (A+ to D) to begin process feedback.
              </div>
            ) : (
              processComparisons.map((comp) => {
                const badgeStyleMap = {
                  SUCCESS: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                  WARNING: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
                  NEUTRAL: 'bg-zinc-800 text-zinc-400 border-zinc-700',
                  DANGER: 'bg-red-500/10 text-red-400 border-red-500/20'
                };
                
                const processBadgeLabel = {
                  SUCCESS: 'Good Process',
                  WARNING: 'Expected Outcome',
                  NEUTRAL: 'Average Setup',
                  DANGER: 'Bad Process (Bias Trap)'
                };

                return (
                  <div 
                    key={comp.tradeId} 
                    className={`border rounded-xl p-4 flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-zinc-950/20 ${
                      comp.badgeType === 'SUCCESS' 
                        ? 'border-emerald-500/10 hover:border-emerald-500/30' 
                        : comp.badgeType === 'DANGER'
                        ? 'border-red-500/10 hover:border-red-500/30'
                        : 'border-zinc-900 hover:border-zinc-800'
                    }`}
                  >
                    {/* Left side: Trade Info & Grade comparison */}
                    <div className="flex flex-col gap-2 min-w-[200px]">
                      <div className="flex items-center gap-2.5">
                        <span className="font-bold text-white">{comp.pair}</span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.25 rounded ${
                          comp.direction === 'LONG' ? 'bg-emerald-500/5 text-emerald-500' : 'bg-red-500/5 text-red-500'
                        }`}>
                          {comp.direction}
                        </span>
                        <span className="text-[10px] text-zinc-500">
                          {new Date(comp.openTime).toLocaleDateString()}
                        </span>
                      </div>
                      
                      {/* Grades Compare */}
                      <div className="flex items-center gap-2 mt-1">
                        <div className="flex flex-col">
                          <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold leading-none">Expected Grade</span>
                          <span className="text-xs font-bold text-zinc-300 mt-1">{comp.expectedGrade}</span>
                        </div>
                        <ArrowRight size={12} className="text-zinc-700 mt-2" />
                        <div className="flex flex-col">
                          <span className="text-[9px] uppercase tracking-wider text-zinc-500 font-semibold leading-none">Actual Outcome</span>
                          <span className={`text-xs font-bold mt-1 ${
                            comp.actualOutcome === 'WIN' ? 'text-emerald-500' : comp.actualOutcome === 'LOSS' ? 'text-red-500' : 'text-zinc-500'
                          }`}>
                            {comp.actualOutcome} ({comp.pnl >= 0 ? '+' : ''}${comp.pnl.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })})
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Middle: AI Process Teaching Explanation */}
                    <div className="flex-1 text-xs text-zinc-300 leading-relaxed max-w-xl md:px-4">
                      <p>{comp.explanation}</p>
                    </div>

                    {/* Right side: Process Badge */}
                    <div className="shrink-0 mt-2 md:mt-0">
                      <span className={`text-[10px] font-black px-2.5 py-1 rounded border uppercase tracking-wider ${
                        badgeStyleMap[comp.badgeType]
                      }`}>
                        {processBadgeLabel[comp.badgeType]}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* -------------------------------------------------------------
          TAB 3: AI MENTORSHIP CONSOLE (Chat Interface)
          ------------------------------------------------------------- */}
      {activeTab === 'CHAT' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Quick Prompts List (Left 1 col) */}
          <div className="flex flex-col gap-4">
            <div className="bg-zinc-900/20 border border-zinc-900/60 p-5 rounded-xl flex flex-col gap-3">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">Ask Your Mentor</span>
              <p className="text-xs text-zinc-500">Select an audit category below to pull personalized trade logs context and reflection diaries metrics.</p>

              <div className="flex flex-col gap-2.5 mt-2">
                <button
                  onClick={() => handlePromptClick('why_am_i_losing', 'Why am I losing?')}
                  className={`text-left text-xs p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                    selectedPrompt === 'why_am_i_losing'
                      ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/30'
                      : 'bg-zinc-950/20 border-zinc-900 text-zinc-400 hover:text-zinc-200 hover:border-zinc-800'
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-zinc-200">Why am I losing?</span>
                    <span className="text-[10px] text-zinc-500">Audits leaks and psychological faults.</span>
                  </div>
                  <ChevronRight size={14} className="text-zinc-600" />
                </button>

                <button
                  onClick={() => handlePromptClick('am_i_overtrading', 'Am I overtrading?')}
                  className={`text-left text-xs p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                    selectedPrompt === 'am_i_overtrading'
                      ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/30'
                      : 'bg-zinc-950/20 border-zinc-900 text-zinc-400 hover:text-zinc-200 hover:border-zinc-800'
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-zinc-200">Am I overtrading?</span>
                    <span className="text-[10px] text-zinc-500">Checks frequency constraints limits.</span>
                  </div>
                  <ChevronRight size={14} className="text-zinc-600" />
                </button>

                <button
                  onClick={() => handlePromptClick('what_is_my_biggest_weakness', 'What is my biggest weakness?')}
                  className={`text-left text-xs p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                    selectedPrompt === 'what_is_my_biggest_weakness'
                      ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/30'
                      : 'bg-zinc-950/20 border-zinc-900 text-zinc-400 hover:text-zinc-200 hover:border-zinc-800'
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-zinc-200">What is my biggest weakness?</span>
                    <span className="text-[10px] text-zinc-500">Finds behavioral patterns.</span>
                  </div>
                  <ChevronRight size={14} className="text-zinc-600" />
                </button>

                <button
                  onClick={() => handlePromptClick('which_setup_performs_best', 'Which setup performs best?')}
                  className={`text-left text-xs p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                    selectedPrompt === 'which_setup_performs_best'
                      ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/30'
                      : 'bg-zinc-950/20 border-zinc-900 text-zinc-400 hover:text-zinc-200 hover:border-zinc-800'
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-zinc-200">Which setup performs best?</span>
                    <span className="text-[10px] text-zinc-500">Maps high probability strategy edges.</span>
                  </div>
                  <ChevronRight size={14} className="text-zinc-600" />
                </button>
              </div>
            </div>
          </div>

          {/* Chat Response Area (Right 2 cols) */}
          <div className="lg:col-span-2 flex flex-col gap-4 h-[450px]">
            <div className="flex-1 bg-zinc-900/20 border border-zinc-900/60 rounded-xl p-5 overflow-y-auto flex flex-col gap-4 relative">
              
              {!chatResponse ? (
                /* Empty Chat Prompt Screen */
                <div className="flex-1 flex flex-col items-center justify-center text-center gap-3">
                  <div className="h-12 w-12 bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center rounded-xl text-indigo-400">
                    <MessageSquare size={22} className="animate-pulse" />
                  </div>
                  <div className="flex flex-col gap-1 max-w-sm">
                    <span className="text-sm font-semibold text-zinc-200">Interactive Mentor Portal</span>
                    <span className="text-xs text-zinc-500">Click on one of the diagnostics audits in the left panel or ask a custom question below to unlock your mentoring feed.</span>
                  </div>
                </div>
              ) : (
                /* Chat Active Screen */
                <div className="flex flex-col gap-4 text-zinc-300 font-sans leading-relaxed text-sm">
                  {/* User Bubble */}
                  <div className="self-end bg-indigo-600/15 border border-indigo-500/20 px-4 py-2 rounded-xl rounded-tr-none text-xs font-semibold text-indigo-300 max-w-[80%]">
                    {chatQuestion || (selectedPrompt === 'why_am_i_losing' ? 'Why am I losing?' : selectedPrompt === 'am_i_overtrading' ? 'Am I overtrading?' : selectedPrompt === 'what_is_my_biggest_weakness' ? 'What is my biggest weakness?' : 'Which setup performs best?')}
                  </div>

                  {/* AI response content */}
                  <div className="bg-zinc-950/40 border border-zinc-900/65 px-5 py-4 rounded-xl rounded-tl-none flex gap-3 items-start">
                    <div className="h-8 w-8 bg-indigo-600 rounded-md shrink-0 flex items-center justify-center text-white font-black text-xs shadow-md">Ω</div>
                    <div className="flex-1 flex flex-col gap-2 prose prose-invert max-w-none text-zinc-300">
                      {/* Formatted Markdown Display Helper */}
                      {chatResponse.split('\n').map((line, idx) => {
                        if (line.startsWith('### ')) {
                          return <h3 key={idx} className="text-sm font-bold text-white border-b border-zinc-900 pb-1.5 mt-2 mb-1 uppercase tracking-wider">{line.replace('### ', '')}</h3>;
                        }
                        if (line.startsWith('#### ')) {
                          return <h4 key={idx} className="text-xs font-bold text-zinc-400 mt-2.5 mb-1.5 uppercase tracking-wide">{line.replace('#### ', '')}</h4>;
                        }
                        if (line.startsWith('**') && line.endsWith('**')) {
                          return <p key={idx} className="font-semibold text-zinc-200 text-xs mt-1">{line.replace(/\*\*/g, '')}</p>;
                        }
                        if (line.startsWith('*   ') || line.startsWith('-   ')) {
                          return (
                            <li key={idx} className="ml-4 list-disc text-xs text-zinc-300 pl-1 my-0.5">
                              {line.replace(/^(\*\s+|\-\s+)/, '').replace(/\`([^\`]+)\`/g, '$1')}
                            </li>
                          );
                        }
                        if (line.startsWith('1. ') || line.startsWith('2. ') || line.startsWith('3. ')) {
                          return <p key={idx} className="text-xs text-zinc-300 ml-2 pl-1 my-1"><strong>{line.substring(0, 3)}</strong>{line.substring(3).replace(/\*\*/g, '')}</p>;
                        }
                        if (line.trim() === '') {
                          return <div key={idx} className="h-1.5" />;
                        }
                        return <p key={idx} className="text-xs text-zinc-300 leading-normal my-0.5">{line.replace(/\*\*/g, '').replace(/\`([^\`]+)\`/g, '$1')}</p>;
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Custom Q&A query bar */}
            <form onSubmit={handleCustomQuestionSubmit} className="flex gap-2">
              <input
                type="text"
                placeholder="Ask about your rules, sizing parameters, or best pairs..."
                value={customQuestionInput}
                onChange={(e) => setCustomQuestionInput(e.target.value)}
                className="flex-1 bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-lg px-4 py-2.5 text-xs text-zinc-200 placeholder:text-zinc-600 transition-colors"
              />
              <button
                type="submit"
                className="bg-indigo-650 hover:bg-indigo-500 text-white font-semibold text-xs px-4 py-2.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 shadow-md shrink-0"
              >
                <Send size={12} />
                <span>Submit Query</span>
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
