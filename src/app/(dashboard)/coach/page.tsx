'use client';

import React, { useState, useEffect } from 'react';
import { fetchTrades, fetchReflections, fetchUserProfile } from '@/lib/db';
import { Trade, DailyReflection, Profile } from '@/types';
import { useAccount } from '@/components/AccountProvider';
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
  ChevronRight,
  Activity,
  UserCheck,
  Target,
  Key,
  Lock,
  ExternalLink,
  X
} from 'lucide-react';
import Link from 'next/link';

export default function AICoachPage() {
  const { activeAccount, loading: accountLoading } = useAccount();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [reflections, setReflections] = useState<DailyReflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Profile & billing states
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Multi-Agent states
  const [reportType, setReportType] = useState<'DAILY' | 'WEEKLY' | 'MONTHLY'>('DAILY');
  const [multiAgentReport, setMultiAgentReport] = useState<any | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [activeAgentTab, setActiveAgentTab] = useState<'COACH' | 'RISK' | 'PSYCHOLOGY' | 'STRATEGY' | 'PERFORMANCE' | 'PRO_FIRM'>('COACH');
  const [showFullMarkdown, setShowFullMarkdown] = useState(false);

  // Gemini Key Config States
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [geminiKeyInput, setGeminiKeyInput] = useState('');
  const [savedKeyExists, setSavedKeyExists] = useState(false);

  // Coach Chat states
  const [activeTab, setActiveTab] = useState<'INSIGHTS' | 'PROCESS' | 'CHAT'>('INSIGHTS');
  const [chatMessages, setChatMessages] = useState<Array<{ id: string; role: 'user' | 'assistant'; content: string }>>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<string | null>(null);
  const [customQuestionInput, setCustomQuestionInput] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);

  // Load profile on mount
  useEffect(() => {
    const checkProfile = async () => {
      try {
        const userProfile = await fetchUserProfile();
        setProfile(userProfile);
      } catch (err) {
        console.error('Error fetching profile on mount:', err);
      } finally {
        setProfileLoading(false);
      }
    };
    checkProfile();
  }, []);

  // Initialize key status & chat on client mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedKey = localStorage.getItem('trader_dna_gemini_key');
      setSavedKeyExists(!!savedKey);
      if (savedKey) {
        setGeminiKeyInput(savedKey);
      }
    }
    setChatMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: `### 🧠 AI Mentor Console initialized\n\nWelcome back! I am your cognitive trading performance coach. I audit your live execution limits, sizing metrics, and psychology reflections to find your biggest trading leaks.\n\nHow can I help you refine your playbook edge today?`
      }
    ]);
  }, []);

  const handleUpgrade = async () => {
    setCheckoutLoading(true);
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        alert(data.error || 'Failed to initiate upgrade');
      }
    } catch (err) {
      console.error('Upgrade redirection failed', err);
      alert('Billing server offline. Try again later.');
    } finally {
      setCheckoutLoading(false);
    }
  };

  const loadData = async () => {
    try {
      const userProfile = await fetchUserProfile();
      setProfile(userProfile);

      const isSubscribed = true;
      if (!isSubscribed) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      if (!activeAccount) {
        setLoading(false);
        setRefreshing(false);
        return;
      }

      const [tradesData, reflectionsData] = await Promise.all([
        fetchTrades(activeAccount.id),
        fetchReflections(activeAccount.id)
      ]);
      setTrades(tradesData);
      setReflections(reflectionsData);
      
      // Load report
      await loadMultiAgentReport(activeAccount.id, reportType, tradesData, reflectionsData);
    } catch (err) {
      console.error('Failed to load coach metrics', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadMultiAgentReport = async (
    accId: string, 
    type: 'DAILY' | 'WEEKLY' | 'MONTHLY',
    currentTrades = trades,
    currentReflections = reflections
  ) => {
    setLoadingReport(true);
    const savedKey = typeof window !== 'undefined' ? localStorage.getItem('trader_dna_gemini_key') || '' : '';
    
    try {
      const response = await fetch('/api/ai-coach/multi-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: accId,
          reportType: type,
          balance: activeAccount?.balance || 5000,
          trades: currentTrades,
          reflections: currentReflections,
          apiKey: savedKey
        })
      });

      if (!response.ok) throw new Error('Failed to fetch multi-agent report');
      const data = await response.json();
      setMultiAgentReport(data.report);
    } catch (err) {
      console.error('Failed to load multi-agent report', err);
    } finally {
      setLoadingReport(false);
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

  // Refetch when report type selection changes
  useEffect(() => {
    if (!loading && activeAccount) {
      loadMultiAgentReport(activeAccount.id, reportType);
    }
  }, [reportType]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  // Connect & disconnect handlers
  const handleConnectKey = () => {
    if (typeof window !== 'undefined') {
      const cleanKey = geminiKeyInput.trim();
      if (cleanKey) {
        localStorage.setItem('trader_dna_gemini_key', cleanKey);
        setSavedKeyExists(true);
        setShowKeyModal(false);
        if (activeAccount) {
          loadMultiAgentReport(activeAccount.id, reportType);
        }
      }
    }
  };

  const handleClearKey = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('trader_dna_gemini_key');
      setGeminiKeyInput('');
      setSavedKeyExists(false);
      setShowKeyModal(false);
      if (activeAccount) {
        loadMultiAgentReport(activeAccount.id, reportType);
      }
    }
  };

  const handlePromptClick = async (questionKey: string, questionText: string) => {
    if (!activeAccount) return;
    setSelectedPrompt(questionKey);
    setLoadingChat(true);

    const userMsgId = 'user-' + Date.now();
    const newMessages = [
      ...chatMessages,
      { id: userMsgId, role: 'user' as const, content: questionText }
    ];
    setChatMessages(newMessages);

    const savedKey = typeof window !== 'undefined' ? localStorage.getItem('trader_dna_gemini_key') || '' : '';

    try {
      const chatHistoryPayload = newMessages
        .filter(m => m.id !== 'welcome')
        .slice(0, -1)
        .map(m => ({
          role: m.role,
          content: m.content
        }));

      const response = await fetch('/api/ai-coach/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: questionText,
          accountId: activeAccount.id,
          chatHistory: chatHistoryPayload,
          apiKey: savedKey,
          trades,
          reflections
        })
      });

      if (!response.ok) throw new Error('Failed to get coach advice');
      const data = await response.json();
      
      setChatMessages(prev => [
        ...prev,
        { id: 'assistant-' + Date.now(), role: 'assistant', content: data.reply }
      ]);
    } catch (err: any) {
      setChatMessages(prev => [
        ...prev,
        { id: 'error-' + Date.now(), role: 'assistant', content: `### ⚠️ Connection Error\n\nI was unable to consult your cognitive trading log metrics. Error: ${err.message || 'Unknown'}` }
      ]);
    } finally {
      setLoadingChat(false);
    }
  };

  const handleCustomQuestionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customQuestionInput.trim() || !activeAccount) return;

    const question = customQuestionInput.trim();
    setSelectedPrompt('custom');
    setLoadingChat(true);
    setCustomQuestionInput('');

    const userMsgId = 'user-' + Date.now();
    const newMessages = [
      ...chatMessages,
      { id: userMsgId, role: 'user' as const, content: question }
    ];
    setChatMessages(newMessages);

    const savedKey = typeof window !== 'undefined' ? localStorage.getItem('trader_dna_gemini_key') || '' : '';

    try {
      const chatHistoryPayload = newMessages
        .filter(m => m.id !== 'welcome')
        .slice(0, -1)
        .map(m => ({
          role: m.role,
          content: m.content
        }));

      const response = await fetch('/api/ai-coach/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: question,
          accountId: activeAccount.id,
          chatHistory: chatHistoryPayload,
          apiKey: savedKey,
          trades,
          reflections
        })
      });

      if (!response.ok) throw new Error('Failed to parse question');
      const data = await response.json();
      
      setChatMessages(prev => [
        ...prev,
        { id: 'assistant-' + Date.now(), role: 'assistant', content: data.reply }
      ]);
    } catch (err: any) {
      setChatMessages(prev => [
        ...prev,
        { id: 'error-' + Date.now(), role: 'assistant', content: `### ⚠️ Mentor Link Failure\n\nI struggled to evaluate that query. Error: ${err.message || 'Connection lost'}` }
      ]);
    } finally {
      setLoadingChat(false);
    }
  };

  if (accountLoading || profileLoading || (loading && activeAccount && (profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing'))) {
    return (
      <div className="flex flex-col gap-6 w-full py-8 text-zinc-400 font-sans">
        <div className="h-8 w-48 animate-pulse bg-zinc-900 rounded" />
        <div className="h-64 animate-pulse bg-zinc-900 border border-zinc-900/60 rounded-xl w-full" />
      </div>
    );
  }

  const isSubscribed = true;

  if (!isSubscribed) {
    return (
      <div className="flex flex-col gap-6 w-full font-sans pb-12">
        {/* Header section */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-900 pb-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Brain className="h-6 w-6 text-zinc-550 animate-pulse" />
              <h1 className="text-2xl font-bold tracking-tight text-white">AI Multi-Agent performance Desk</h1>
            </div>
            <p className="text-sm text-zinc-400">Consolidated risk, psychology, strategy, and prop rules audited by specialized agents.</p>
          </div>
        </div>

        {/* Paywall Overlay */}
        <div className="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950/40 p-8 md:p-12 flex flex-col items-center justify-center text-center gap-6 mt-4 shadow-2xl min-h-[50vh]">
          <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 via-purple-500/[0.02] to-transparent pointer-events-none" />
          
          <div className="relative flex items-center justify-center">
            <div className="absolute inset-0 bg-indigo-500/20 rounded-full blur-xl h-16 w-16" />
            <div className="relative h-16 w-16 bg-zinc-900 border border-zinc-800 flex items-center justify-center rounded-2xl text-indigo-400 shadow-md">
              <Lock size={28} />
            </div>
          </div>

          <div className="flex flex-col gap-2.5 max-w-lg z-10">
            <h2 className="text-xl md:text-2xl font-extrabold text-white tracking-tight">
              Unlock Pro Cognitive Mentor
            </h2>
            <p className="text-xs md:text-sm text-zinc-450 leading-relaxed">
              Gain institutional-grade performance intelligence. Upgrade to TraderDNA Pro to access:
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl w-full z-10 mt-2">
            <div className="bg-zinc-900/30 border border-zinc-900/60 p-4 rounded-xl flex flex-col items-center text-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                <Brain size={16} />
              </div>
              <span className="text-xs font-bold text-zinc-200">Multi-Agent Audits</span>
              <span className="text-[10px] text-zinc-500 leading-normal">Consensus from Risk, Psychology & Strategy agents.</span>
            </div>

            <div className="bg-zinc-900/30 border border-zinc-900/60 p-4 rounded-xl flex flex-col items-center text-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400">
                <ShieldAlert size={16} />
              </div>
              <span className="text-xs font-bold text-zinc-200">Blow-up Predictor</span>
              <span className="text-[10px] text-zinc-500 leading-normal">7-Day failure rate analysis and shield recommendations.</span>
            </div>

            <div className="bg-zinc-900/30 border border-zinc-900/60 p-4 rounded-xl flex flex-col items-center text-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-400">
                <MessageSquare size={16} />
              </div>
              <span className="text-xs font-bold text-zinc-200">RAG Mentor Chat</span>
              <span className="text-[10px] text-zinc-550 leading-normal">Interactive playbook advice trained on your logs.</span>
            </div>
          </div>

          {/* CTA */}
          <div className="flex flex-col items-center gap-3 z-10 w-full max-w-sm mt-4">
            <button
              onClick={handleUpgrade}
              disabled={checkoutLoading}
              className="w-full flex items-center justify-center gap-2 bg-indigo-650 hover:bg-indigo-500 disabled:bg-indigo-700/50 text-white font-bold text-sm px-6 py-3 rounded-xl transition-all shadow-lg shadow-indigo-500/10 cursor-pointer"
            >
              {checkoutLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <span>Upgrade to Pro Tier</span>
                  <Zap size={14} className="fill-white" />
                </>
              )}
            </button>
            <span className="text-[10px] text-zinc-500">
              Cancel anytime via your self-serve Billing Dashboard in Account Hub.
            </span>
          </div>
        </div>
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

  const processComparisons = trades.filter(t => t.status === 'CLOSED').map(t => {
    const pnl = t.pnl || 0;
    const actualOutcome: 'WIN' | 'LOSS' | 'BREAKEVEN' = pnl > 0.01 ? 'WIN' : pnl < -0.01 ? 'LOSS' : 'BREAKEVEN';
    const grade = t.setup_grade;
    let explanation = '';
    let badgeType: 'SUCCESS' | 'WARNING' | 'NEUTRAL' | 'DANGER' = 'NEUTRAL';
    if ((grade === 'A+' || grade === 'A') && actualOutcome === 'LOSS') {
      badgeType = 'SUCCESS';
      explanation = 'Still a good trade! The setup was solid, and you followed your playbook checklist. Do not let a single random outcome override a positive long-term edge. This is process discipline.';
    } else if ((grade === 'D' || grade === 'C') && actualOutcome === 'WIN') {
      badgeType = 'DANGER';
      explanation = 'Result-oriented bias alarm! You won this trade, but it was a low-quality setup (Grade C/D). This random win is dangerous because it reinforces sloppy execution habits.';
    } else if ((grade === 'D' || grade === 'C') && actualOutcome === 'LOSS') {
      badgeType = 'WARNING';
      explanation = 'Expected loss. You entered a low-quality setup (Grade C/D) and suffered a loss. Avoid these entries to keep your account out of drawdown.';
    } else if ((grade === 'A+' || grade === 'A') && actualOutcome === 'WIN') {
      badgeType = 'SUCCESS';
      explanation = 'Excellent work. High-quality playbook setup matched with a winning outcome. Keep repeating this process.';
    } else {
      badgeType = actualOutcome === 'WIN' ? 'NEUTRAL' : 'WARNING';
      explanation = actualOutcome === 'WIN' 
        ? 'Decent trade. Solid setup execution resulting in a win. Make sure you filter for A/A+ setups whenever possible.'
        : 'Trade resulted in a loss. Setup grade was average (B). Review if you skipped secondary confirmations.';
    }
    return { tradeId: t.id, pair: t.pair, direction: t.direction, expectedGrade: grade, actualOutcome, pnl, openTime: t.open_time, badgeType, explanation };
  });

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'HIGH': return { text: 'text-red-500', bg: 'bg-red-500/10', border: 'border-red-500/20', hoverBorder: 'hover:border-red-500/40' };
      case 'MEDIUM': return { text: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20', hoverBorder: 'hover:border-amber-500/40' };
      default: return { text: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', hoverBorder: 'hover:border-emerald-500/40' };
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    if (score >= 50) return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    return 'text-red-500 bg-red-500/10 border-red-500/20';
  };

  const riskStyles = multiAgentReport ? getRiskColor(multiAgentReport.blowup.risk_level) : { text: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' };

  return (
    <div className="flex flex-col gap-6 w-full font-sans pb-12">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-900 pb-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <Brain className="h-6 w-6 text-indigo-500 animate-pulse" />
            <h1 className="text-2xl font-bold tracking-tight text-white">AI Multi-Agent performance Desk</h1>
          </div>
          <p className="text-sm text-zinc-400">Consolidated risk, psychology, strategy, and prop rules audited by specialized agents.</p>
        </div>
        <div className="flex items-center gap-2.5">
          {/* Gemini BYOK Config Button */}
          <button
            onClick={() => setShowKeyModal(true)}
            className={`flex items-center gap-2 border px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
              savedKeyExists 
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15'
                : 'bg-indigo-650/10 text-indigo-400 border-indigo-500/20 hover:bg-indigo-650/20'
            }`}
          >
            <Key size={13} />
            <span>{savedKeyExists ? '✅ Gemini Connected' : '🔑 Connect Gemini Key'}</span>
          </button>
          
          <button
            onClick={handleRefresh}
            disabled={refreshing || loadingReport}
            className="flex items-center gap-2 border border-zinc-800 bg-zinc-900/30 hover:bg-zinc-900/60 text-zinc-400 hover:text-zinc-200 px-3 py-2 rounded-md text-xs font-semibold tracking-wide transition-colors cursor-pointer"
          >
            <RefreshCw size={14} className={refreshing || loadingReport ? 'animate-spin' : ''} />
            <span>Sync Live Stats</span>
          </button>
        </div>
      </div>

      {/* Gemini API Key Modal Overlay */}
      {showKeyModal && (
        <div className="fixed inset-0 z-55 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-zinc-950 border border-zinc-900 rounded-2xl flex flex-col font-sans overflow-hidden shadow-2xl p-6 relative gap-4">
            
            {/* Close Button */}
            <button 
              onClick={() => setShowKeyModal(false)}
              className="absolute top-5 right-5 text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <X size={18} />
            </button>

            {/* Title */}
            <div className="flex items-center gap-2.5">
              <Key className="text-indigo-400 h-5 w-5" />
              <h2 className="text-base font-extrabold text-white">Gemini API Key</h2>
            </div>

            <p className="text-xs text-zinc-450 leading-normal">
              To enable AI evaluation features, you need to connect a free Gemini API key.
            </p>

            {/* Instruction Card */}
            <div className="bg-sky-500/[0.02] border border-sky-500/10 p-4 rounded-xl flex flex-col gap-3">
              <span className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider">How to get your key:</span>
              
              <a 
                href="https://aistudio.google.com/app/api-keys" 
                target="_blank" 
                rel="noreferrer"
                className="flex items-center gap-2 bg-sky-500/10 border border-sky-500/20 hover:bg-sky-500/15 text-sky-400 px-3 py-2 rounded-lg text-xs font-bold transition-all w-fit cursor-pointer"
              >
                <span>Get Your Key</span>
                <ExternalLink size={12} />
              </a>

              <ol className="flex flex-col gap-1.5 text-xs text-zinc-400 leading-normal list-decimal list-inside pl-0.5">
                <li>Click the button above to open Google AI Studio.</li>
                <li>Click <strong className="text-zinc-200">"Create API key"</strong>.</li>
                <li><strong className="text-zinc-200">Name your key</strong> (e.g., "TraderDNA").</li>
                <li>Select a project (or <strong className="text-zinc-200">create a new one</strong>).</li>
                <li>Copy the generated key and paste it below.</li>
              </ol>
            </div>

            {/* Key Input */}
            <div className="flex flex-col gap-3">
              <input
                type="password"
                placeholder="Paste your Gemini API key here..."
                value={geminiKeyInput}
                onChange={e => setGeminiKeyInput(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-xl px-4 py-3 text-xs text-zinc-200 placeholder:text-zinc-650 transition-colors font-mono"
              />

              <div className="flex items-center justify-between gap-4 mt-2">
                {savedKeyExists ? (
                  <button
                    onClick={handleClearKey}
                    className="text-xs font-bold text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                  >
                    Disconnect Key
                  </button>
                ) : (
                  <button
                    onClick={() => setShowKeyModal(false)}
                    className="text-xs font-bold text-zinc-500 hover:text-zinc-350 transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                )}

                <button
                  onClick={handleConnectKey}
                  className="bg-indigo-650 hover:bg-indigo-500 text-white font-bold text-xs px-5 py-2.5 rounded-xl transition-colors cursor-pointer shadow-md"
                >
                  Connect Key
                </button>
              </div>
            </div>

            {/* Secure note */}
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-zinc-500 border-t border-zinc-900 pt-3">
              <Lock size={11} />
              <span>Your key is stored securely in your browser.</span>
            </div>

          </div>
        </div>
      )}

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
          AI Coaching Desk
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
          RAG Mentor Chat
        </button>
      </div>

      {/* -------------------------------------------------------------
          TAB 1: MULTI-AGENT INSIGHTS DESK
          ------------------------------------------------------------- */}
      {activeTab === 'INSIGHTS' && (
        <div className="flex flex-col gap-6">
          
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900/10 border border-zinc-900 p-4 rounded-xl">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold text-zinc-350">Active Audit Period</span>
              <span className="text-[10px] text-zinc-500">Run macro assessments of your psychology and parameters.</span>
            </div>

            <div className="flex gap-2">
              {(['DAILY', 'WEEKLY', 'MONTHLY'] as const).map(type => (
                <button
                  key={type}
                  onClick={() => setReportType(type)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold border transition-all cursor-pointer ${
                    reportType === type
                      ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/30'
                      : 'bg-transparent border-zinc-850 text-zinc-500 hover:text-zinc-350 hover:border-zinc-800'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {loadingReport ? (
            <div className="py-24 flex flex-col items-center justify-center text-center gap-4 bg-zinc-950/20 border border-zinc-900/60 rounded-xl">
              <Activity className="h-8 w-8 animate-pulse text-indigo-400" />
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-zinc-200">Consolidating Agent Consensus...</span>
                <span className="text-xs text-zinc-500 max-w-sm">Calculating deterministic risk models and prompting cognitive psychology/blow-up neural layers.</span>
              </div>
            </div>
          ) : !multiAgentReport ? (
            <div className="py-24 text-center text-zinc-500 text-xs bg-zinc-950/20 border border-zinc-900/60 rounded-xl">
              Failed to run Multi-Agent analysis. Verify you have active trade entries logged.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Left Column (2 Cols): Multi-Agent selectors & detailed tab views */}
              <div className="lg:col-span-2 flex flex-col gap-6">
                
                {/* Agent Board Grid */}
                <div className="bg-zinc-900/20 border border-zinc-900/60 rounded-xl p-4 flex flex-col gap-3">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Multi-Agent Team Status</span>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    
                    <button
                      onClick={() => setActiveAgentTab('COACH')}
                      className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                        activeAgentTab === 'COACH'
                          ? 'bg-indigo-650/10 border-indigo-500/40'
                          : 'bg-zinc-950/30 border-zinc-900 hover:border-zinc-850'
                      }`}
                    >
                      <span className="text-[10px] text-zinc-500 font-semibold flex items-center gap-1.5 uppercase tracking-wide">
                        <Brain size={12} className="text-indigo-400" />
                        Coach Agent
                      </span>
                      <span className="text-xs font-bold text-zinc-200 mt-1">Mentor Summary</span>
                    </button>

                    <button
                      onClick={() => setActiveAgentTab('RISK')}
                      className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                        activeAgentTab === 'RISK'
                          ? 'bg-indigo-650/10 border-indigo-500/40'
                          : 'bg-zinc-950/30 border-zinc-900 hover:border-zinc-850'
                      }`}
                    >
                      <span className="text-[10px] text-zinc-500 font-semibold flex items-center gap-1.5 uppercase tracking-wide">
                        <ShieldAlert size={12} className="text-amber-500" />
                        Risk Agent
                      </span>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs font-bold text-zinc-200">Safety Index</span>
                        <span className={`text-[10px] px-1.5 rounded border font-extrabold ${getScoreColor(multiAgentReport.risk.riskScore)}`}>
                          {multiAgentReport.risk.riskScore}
                        </span>
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveAgentTab('PSYCHOLOGY')}
                      className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                        activeAgentTab === 'PSYCHOLOGY'
                          ? 'bg-indigo-650/10 border-indigo-500/40'
                          : 'bg-zinc-950/30 border-zinc-900 hover:border-zinc-850'
                      }`}
                    >
                      <span className="text-[10px] text-zinc-500 font-semibold flex items-center gap-1.5 uppercase tracking-wide">
                        <UserCheck size={12} className="text-indigo-400" />
                        Psychology
                      </span>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs font-bold text-zinc-200">Mindset Score</span>
                        <span className={`text-[10px] px-1.5 rounded border font-extrabold ${getScoreColor(multiAgentReport.psychology.psychologyScore)}`}>
                          {multiAgentReport.psychology.psychologyScore}
                        </span>
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveAgentTab('PRO_FIRM')}
                      className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                        activeAgentTab === 'PRO_FIRM'
                          ? 'bg-indigo-650/10 border-indigo-500/40'
                          : 'bg-zinc-950/30 border-zinc-900 hover:border-zinc-850'
                      }`}
                    >
                      <span className="text-[10px] text-zinc-500 font-semibold flex items-center gap-1.5 uppercase tracking-wide">
                        <Activity size={12} className="text-emerald-500" />
                        Prop Agent
                      </span>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs font-bold text-zinc-200">Rule Safety</span>
                        <span className={`text-[10px] px-1.5 rounded border font-extrabold ${getScoreColor(multiAgentReport.propFirm.propSafetyScore)}`}>
                          {multiAgentReport.propFirm.propSafetyScore}
                        </span>
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveAgentTab('STRATEGY')}
                      className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                        activeAgentTab === 'STRATEGY'
                          ? 'bg-indigo-650/10 border-indigo-500/40'
                          : 'bg-zinc-950/30 border-zinc-900 hover:border-zinc-850'
                      }`}
                    >
                      <span className="text-[10px] text-zinc-500 font-semibold flex items-center gap-1.5 uppercase tracking-wide">
                        <Target size={12} className="text-purple-400" />
                        Strategy
                      </span>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs font-bold text-zinc-200">Edge Score</span>
                        <span className={`text-[10px] px-1.5 rounded border font-extrabold ${getScoreColor(multiAgentReport.strategy.strategyScore)}`}>
                          {multiAgentReport.strategy.strategyScore}
                        </span>
                      </div>
                    </button>

                    <button
                      onClick={() => setActiveAgentTab('PERFORMANCE')}
                      className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                        activeAgentTab === 'PERFORMANCE'
                          ? 'bg-indigo-650/10 border-indigo-500/40'
                          : 'bg-zinc-950/30 border-zinc-900 hover:border-zinc-850'
                      }`}
                    >
                      <span className="text-[10px] text-zinc-500 font-semibold flex items-center gap-1.5 uppercase tracking-wide">
                        <Award size={12} className="text-amber-400" />
                        Performance
                      </span>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs font-bold text-zinc-200">Overall Score</span>
                        <span className={`text-[10px] px-1.5 rounded border font-extrabold ${getScoreColor(multiAgentReport.performance.performanceScore)}`}>
                          {multiAgentReport.performance.performanceScore}
                        </span>
                      </div>
                    </button>

                  </div>
                </div>

                {/* Sub-tab view: Coach Synthesis */}
                {activeAgentTab === 'COACH' && (
                  <div className="bg-zinc-900/20 border border-zinc-900/60 rounded-xl p-5 flex flex-col gap-5">
                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Lead performance mentor report</h3>
                      <p className="text-xs text-zinc-500 mt-1">Synthesized audit details compiled across the entire multi-agent loop.</p>
                    </div>

                    <div className="bg-zinc-950/35 border border-zinc-900/75 p-4 rounded-lg flex flex-col gap-2">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Executive Review</span>
                      <p className="text-xs text-zinc-300 leading-relaxed font-sans">{multiAgentReport.coachReport.executiveSummary}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="border border-red-500/15 bg-red-950/5 p-4 rounded-lg flex flex-col gap-1">
                        <span className="text-[9px] font-bold uppercase text-red-400 tracking-wider flex items-center gap-1">
                          <ShieldAlert size={12} />
                          Biggest Leak
                        </span>
                        <span className="text-xs text-zinc-300 font-medium mt-1 leading-normal">{multiAgentReport.coachReport.biggestMistake}</span>
                      </div>
                      <div className="border border-emerald-500/15 bg-emerald-950/5 p-4 rounded-lg flex flex-col gap-1">
                        <span className="text-[9px] font-bold uppercase text-emerald-400 tracking-wider flex items-center gap-1">
                          <CheckCircle2 size={12} />
                          Biggest Strength
                        </span>
                        <span className="text-xs text-zinc-300 font-medium mt-1 leading-normal">{multiAgentReport.coachReport.biggestStrength}</span>
                      </div>
                      <div className="border border-indigo-500/15 bg-indigo-950/5 p-4 rounded-lg flex flex-col gap-1">
                        <span className="text-[9px] font-bold uppercase text-indigo-400 tracking-wider flex items-center gap-1">
                          <Target size={12} />
                          Improvement Goal
                        </span>
                        <span className="text-xs text-zinc-300 font-medium mt-1 leading-normal">{multiAgentReport.coachReport.whatToImproveNext}</span>
                      </div>
                    </div>

                    {/* Action checklist */}
                    <div className="flex flex-col gap-3">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Strategic Action Checklist</span>
                      <div className="flex flex-col gap-2">
                        {multiAgentReport.coachReport.actionPlan.map((act: string, idx: number) => (
                          <div key={idx} className="flex items-start gap-2.5 bg-zinc-950/15 border border-zinc-900/40 p-3 rounded-lg text-xs text-zinc-300">
                            <CheckCircle2 size={15} className="text-emerald-500 shrink-0 mt-0.5" />
                            <span>{act.replace(/^\d+\.\s*/, '')}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Markdown toggle */}
                    <div className="border-t border-zinc-900 pt-4 flex justify-between items-center">
                      <span className="text-[10px] text-zinc-500">Access full detailed performance transcript.</span>
                      <button
                        onClick={() => setShowFullMarkdown(!showFullMarkdown)}
                        className="text-xs font-bold text-indigo-400 hover:text-indigo-300 transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <span>{showFullMarkdown ? 'Collapse Report Text' : 'Expand Full Report Markdown'}</span>
                        <ChevronRight size={14} className={`transform transition-transform ${showFullMarkdown ? 'rotate-90' : ''}`} />
                      </button>
                    </div>

                    {showFullMarkdown && (
                      <div className="bg-zinc-950/45 border border-zinc-900 p-5 rounded-lg text-xs leading-relaxed text-zinc-350 prose prose-invert font-mono max-h-96 overflow-y-auto whitespace-pre-wrap">
                        {multiAgentReport.coachReport.fullReportMarkdown}
                      </div>
                    )}

                  </div>
                )}

                {/* Sub-tab view: Risk Agent */}
                {activeAgentTab === 'RISK' && (
                  <div className="bg-zinc-900/20 border border-zinc-900/60 rounded-xl p-5 flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Risk Desk audit</h3>
                        <p className="text-xs text-zinc-500 mt-1">Validates leverage margins, sizing rules, and equity preservation curves.</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getScoreColor(multiAgentReport.risk.riskScore)}`}>
                        SCORE: {multiAgentReport.risk.riskScore}/100
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <div className="bg-zinc-950/30 border border-zinc-900 p-4 rounded-lg flex flex-col gap-2">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Violations Detected</span>
                        {multiAgentReport.risk.violations.length === 0 ? (
                          <span className="text-xs text-emerald-500 italic mt-2">No active risk rule violations found. High discipline.</span>
                        ) : (
                          <ul className="flex flex-col gap-2 mt-1">
                            {multiAgentReport.risk.violations.map((v: string, idx: number) => (
                              <li key={idx} className="text-xs text-zinc-300 flex items-center gap-2 bg-red-500/5 border border-red-500/10 p-2 rounded">
                                <AlertTriangle size={14} className="text-red-400 shrink-0" />
                                <span>{v}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div className="bg-zinc-950/30 border border-zinc-900 p-4 rounded-lg flex flex-col gap-2">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Risk Recommendations</span>
                        <ul className="flex flex-col gap-2.5 mt-1">
                          {multiAgentReport.risk.recommendations.map((r: string, idx: number) => (
                            <li key={idx} className="text-xs text-zinc-300 flex items-start gap-2">
                              <CheckCircle2 size={14} className="text-indigo-400 shrink-0 mt-0.5" />
                              <span>{r}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-tab view: Psychology Agent */}
                {activeAgentTab === 'PSYCHOLOGY' && (
                  <div className="bg-zinc-900/20 border border-zinc-900/60 rounded-xl p-5 flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Psychology Desk Audit</h3>
                        <p className="text-xs text-zinc-500 mt-1">Maps emotional profiles, panic decisions, and fomo anomalies.</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getScoreColor(multiAgentReport.psychology.psychologyScore)}`}>
                        SCORE: {multiAgentReport.psychology.psychologyScore}/100
                      </span>
                    </div>

                    <div className="bg-zinc-950/35 border border-zinc-900/80 p-4 rounded-lg flex flex-col gap-2">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Discipline & Behavior Assessment</span>
                      <p className="text-xs text-zinc-300 leading-relaxed font-sans">{multiAgentReport.psychology.disciplineAssessment}</p>
                    </div>

                    <div className="bg-zinc-950/30 border border-zinc-900 p-4 rounded-lg flex flex-col gap-2">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Emotional Triggers Detected</span>
                      <div className="flex flex-wrap gap-2 mt-1">
                        {multiAgentReport.psychology.emotionalTriggers.map((t: string, idx: number) => (
                          <span key={idx} className="text-[10px] bg-indigo-600/10 border border-indigo-500/20 px-2.5 py-1 rounded text-indigo-300 font-bold uppercase">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-tab view: Prop Firm Agent */}
                {activeAgentTab === 'PRO_FIRM' && (
                  <div className="bg-zinc-900/20 border border-zinc-900/60 rounded-xl p-5 flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Prop Compliance Desk</h3>
                        <p className="text-xs text-zinc-500 mt-1">Audits accounts safety indices against strict drawdown requirements.</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getScoreColor(multiAgentReport.propFirm.propSafetyScore)}`}>
                        COMPLIANCE: {multiAgentReport.propFirm.propSafetyScore}/100
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                      <div className="bg-zinc-950/30 border border-zinc-900 p-4 rounded-lg flex flex-col gap-2">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Account compliance Status</span>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className={`text-xs font-black px-3 py-1 rounded border ${
                            multiAgentReport.propFirm.accountHealth === 'Safe' 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' 
                              : multiAgentReport.propFirm.accountHealth === 'Warning'
                              ? 'bg-amber-500/10 text-amber-500 border-amber-500/25'
                              : 'bg-red-500/10 text-red-400 border-red-500/25'
                          }`}>
                            {multiAgentReport.propFirm.accountHealth.toUpperCase()} HEALTH
                          </span>
                        </div>
                      </div>

                      <div className="bg-zinc-950/30 border border-zinc-900 p-4 rounded-lg flex flex-col gap-2">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Rule Checks & Warnings</span>
                        {multiAgentReport.propFirm.violations.length === 0 ? (
                          <span className="text-xs text-emerald-500 italic mt-2">All proprietary rules are 100% aligned and compliant.</span>
                        ) : (
                          <ul className="flex flex-col gap-2 mt-1">
                            {multiAgentReport.propFirm.violations.map((w: string, idx: number) => (
                              <li key={idx} className="text-xs text-zinc-300 flex items-start gap-2 bg-amber-500/5 border border-amber-500/10 p-2 rounded">
                                <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                                <span>{w}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {/* Sub-tab view: Strategy Agent */}
                {activeAgentTab === 'STRATEGY' && (
                  <div className="bg-zinc-900/20 border border-zinc-900/60 rounded-xl p-5 flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Strategy Setup Audit</h3>
                        <p className="text-xs text-zinc-500 mt-1">Validates execution edge, setup tag win rates, and consistency parameters.</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getScoreColor(multiAgentReport.strategy.strategyScore)}`}>
                        EDGE SCORE: {multiAgentReport.strategy.strategyScore}/100
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div className="bg-zinc-950/30 border border-zinc-900 p-4 rounded-lg flex flex-col gap-1">
                        <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide">Top Setup Tag</span>
                        <span className="text-sm font-bold text-emerald-400 mt-1">{multiAgentReport.strategy.bestSetup}</span>
                      </div>
                      <div className="bg-zinc-950/30 border border-zinc-900/40 p-4 rounded-lg flex flex-col gap-1">
                        <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-wide">Weakest Setup Tag</span>
                        <span className="text-sm font-bold text-red-400 mt-1">{multiAgentReport.strategy.weakestSetup}</span>
                      </div>
                    </div>

                    <div className="bg-zinc-950/30 border border-zinc-900 p-4 rounded-lg flex flex-col gap-2">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Process Consistency</span>
                      <div className="flex items-center gap-3 mt-1.5">
                        <div className="flex-1 h-2 bg-zinc-900 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500 rounded-full" style={{ width: `${multiAgentReport.strategy.consistencyPct}%` }} />
                        </div>
                        <span className="text-xs font-bold text-purple-400">{multiAgentReport.strategy.consistencyPct}%</span>
                      </div>
                      <span className="text-[10px] text-zinc-500 mt-1">Reflects your adherence to setup grades and stop-loss limits execution.</span>
                    </div>
                  </div>
                )}

                {/* Sub-tab view: Performance Agent */}
                {activeAgentTab === 'PERFORMANCE' && (
                  <div className="bg-zinc-900/20 border border-zinc-900/60 rounded-xl p-5 flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Performance DNA Desk</h3>
                        <p className="text-xs text-zinc-500 mt-1">Parses win ratios, profit factor limits, and expectancy calculations.</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getScoreColor(multiAgentReport.performance.performanceScore)}`}>
                        DNA SCORE: {multiAgentReport.performance.performanceScore}/100
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                      <div className="bg-zinc-950/30 border border-zinc-900 p-3 rounded flex flex-col">
                        <span className="text-[9px] text-zinc-500 font-semibold uppercase">Win Rate</span>
                        <span className="text-sm font-bold text-white mt-1">{multiAgentReport.performance.winRate.toFixed(1)}%</span>
                      </div>
                      <div className="bg-zinc-950/30 border border-zinc-900 p-3 rounded flex flex-col">
                        <span className="text-[9px] text-zinc-500 font-semibold uppercase">Profit Factor</span>
                        <span className="text-sm font-bold text-white mt-1">{multiAgentReport.performance.profitFactor.toFixed(2)}</span>
                      </div>
                      <div className="bg-zinc-950/30 border border-zinc-900 p-3 rounded flex flex-col">
                        <span className="text-[9px] text-zinc-500 font-semibold uppercase">Expectancy</span>
                        <span className="text-sm font-bold text-white mt-1">${multiAgentReport.performance.expectancy.toFixed(2)}</span>
                      </div>
                      <div className="bg-zinc-950/30 border border-zinc-900 p-3 rounded flex flex-col">
                        <span className="text-[9px] text-zinc-500 font-semibold uppercase">Avg RR</span>
                        <span className="text-sm font-bold text-white mt-1">1 : {multiAgentReport.performance.averageRR.toFixed(1)}</span>
                      </div>
                    </div>

                    <div className="bg-zinc-950/35 border border-zinc-900/80 p-4 rounded-lg flex flex-col gap-2">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Trading DNA Telemetry Summary</span>
                      <p className="text-xs text-zinc-300 leading-relaxed font-sans" dangerouslySetInnerHTML={{ __html: multiAgentReport.performance.tradingDnaSummary }} />
                    </div>
                  </div>
                )}

              </div>

              {/* Right Column (1 Col): AI Blow-Up Predictor Card */}
              <div className="flex flex-col">
                <div className={`bg-zinc-900/20 border rounded-xl p-5 flex flex-col gap-4 transition-all h-full ${riskStyles.border}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldAlert className={`h-5 w-5 ${riskStyles.text}`} />
                      <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-350">Blow-up Predictor</h3>
                    </div>
                    <span className={`text-[10px] font-black px-2 py-0.5 rounded ${riskStyles.bg} ${riskStyles.text} border ${riskStyles.border}`}>
                      {multiAgentReport.blowup.risk_level} RISK
                    </span>
                  </div>

                  {/* Prediction Probability Gauge */}
                  <div className="flex flex-col items-center justify-center py-4 bg-zinc-950/30 border border-zinc-900/40 rounded-lg relative overflow-hidden">
                    <div className="flex flex-col items-center z-10">
                      <span className="text-[10px] text-zinc-500 font-semibold uppercase tracking-widest">7-Day Failure Risk</span>
                      <span className={`text-4xl font-extrabold tracking-tighter mt-1.5 ${riskStyles.text}`}>
                        {multiAgentReport.blowup.failure_probability}%
                      </span>
                      <span className="text-[10px] text-zinc-500 mt-2 text-center max-w-[200px]">
                        Probability of violating rules or losing 10%+ equity.
                      </span>
                    </div>
                    
                    {/* Horizontal slider bar display */}
                    <div className="w-4/5 h-1.5 bg-zinc-900 rounded-full mt-4 overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          multiAgentReport.blowup.risk_level === 'HIGH' ? 'bg-red-500' : multiAgentReport.blowup.risk_level === 'MEDIUM' ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${multiAgentReport.blowup.failure_probability}%` }}
                      />
                    </div>
                  </div>

                  {/* Reasons */}
                  <div className="flex flex-col gap-2 mt-1">
                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Impending Risk Indicators</span>
                    {multiAgentReport.blowup.reasons.length === 0 ? (
                      <span className="text-xs text-zinc-400 italic">No alarming risk factors flagged in your recent activities.</span>
                    ) : (
                      <ul className="flex flex-col gap-1.5">
                        {multiAgentReport.blowup.reasons.map((reason: string, idx: number) => (
                          <li key={idx} className="text-xs text-zinc-300 flex items-start gap-2 bg-zinc-950/35 border border-zinc-900 p-2 rounded">
                            <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Recommendations */}
                  <div className="flex flex-col gap-2 mt-1">
                    <span className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Suggested Shield Actions</span>
                    <ul className="flex flex-col gap-2">
                      {multiAgentReport.blowup.recommendations.map((act: string, idx: number) => (
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
              processComparisons.map((comp, index) => {
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
                    key={index} 
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
            <div className="flex-grow bg-zinc-900/20 border border-zinc-900/60 rounded-xl p-5 overflow-y-auto flex flex-col gap-4 relative">
              
              {chatMessages.length === 0 ? (
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
                /* Chat Active Screen (Thread) */
                <div className="flex flex-col gap-4 text-zinc-300 font-sans leading-relaxed text-sm">
                  {chatMessages.map((msg) => {
                    const isUser = msg.role === 'user';
                    return (
                      <div key={msg.id} className={`flex flex-col gap-1.5 ${isUser ? 'items-end' : 'items-start'}`}>
                        {isUser ? (
                          <div className="bg-indigo-650 border border-indigo-550/20 px-4 py-2 rounded-xl rounded-tr-none text-xs font-semibold text-white max-w-[85%] shadow-md">
                            {msg.content}
                          </div>
                        ) : (
                          <div className="bg-zinc-950/45 border border-zinc-900/65 px-5 py-4 rounded-xl rounded-tl-none flex gap-3 items-start w-full">
                            <div className="h-8 w-8 bg-indigo-600 rounded-md shrink-0 flex items-center justify-center text-white font-black text-xs shadow-md font-mono">Ω</div>
                            <div className="flex-1 flex flex-col gap-2 prose prose-invert max-w-none text-zinc-350">
                              {/* Formatted Markdown Display Helper */}
                              {msg.content.split('\n').map((line, idx) => {
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
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {loadingChat && (
                <div className="flex items-center gap-3 bg-zinc-950/45 border border-zinc-900/40 p-4 rounded-xl rounded-tl-none self-start w-fit">
                  <div className="h-6 w-6 shrink-0 flex items-center justify-center">
                    <div className="h-2 w-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <div className="h-2 w-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s] mx-1" />
                    <div className="h-2 w-2 bg-indigo-500 rounded-full animate-bounce" />
                  </div>
                  <span className="text-[10px] text-zinc-550 font-bold tracking-wide uppercase">AI Mentor is analyzing...</span>
                </div>
              )}
            </div>

            {/* Clear history button */}
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] text-zinc-550">Conversational thread context is passed back-and-forth.</span>
              <button
                type="button"
                onClick={() => setChatMessages([
                  {
                    id: 'welcome',
                    role: 'assistant',
                    content: `### 🧠 AI Mentor Console initialized\n\nWelcome back! I am your cognitive trading performance coach. I audit your live execution limits, sizing metrics, and psychology reflections to find your biggest trading leaks.\n\nHow can I help you refine your playbook edge today?`
                  }
                ])}
                className="text-[10px] font-bold text-zinc-500 hover:text-zinc-350 transition-colors cursor-pointer border border-zinc-900 bg-zinc-950/20 px-2 py-1 rounded"
              >
                Clear Conversation
              </button>
            </div>

            {/* Custom Q&A query bar */}
            <form onSubmit={handleCustomQuestionSubmit} className="flex gap-2">
              <input
                type="text"
                placeholder="Ask about your rules, sizing parameters, or best pairs..."
                value={customQuestionInput}
                onChange={(e) => setCustomQuestionInput(e.target.value)}
                className="flex-1 bg-zinc-900 border border-zinc-805 focus:border-zinc-700 outline-none rounded-lg px-4 py-2.5 text-xs text-zinc-200 placeholder:text-zinc-650 transition-colors"
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
