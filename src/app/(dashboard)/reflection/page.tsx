'use client';

import React, { useState, useEffect } from 'react';
import { fetchReflections, saveReflection } from '@/lib/db';
import { DailyReflection } from '@/types';
import { useAccount } from '@/components/AccountProvider';
import Link from 'next/link';
import { Brain, Sparkles, ShieldAlert, CheckCircle2, XCircle, Flame, PlusCircle } from 'lucide-react';

export default function ReflectionPage() {
  const { activeAccount, loading: accountLoading, streak } = useAccount();
  const [reflections, setReflections] = useState<DailyReflection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form states
  const [followedPlan, setFollowedPlan] = useState(true);
  const [didRevengeTrade, setDidRevengeTrade] = useState(false);
  const [didMoveStopLoss, setDidMoveStopLoss] = useState(false);
  const [emotionalState, setEmotionalState] = useState('Calm');
  const [notes, setNotes] = useState('');

  const emotions = [
    { label: 'Calm', emoji: '🧘', desc: 'In control, waiting for setups' },
    { label: 'FOMO', emoji: '⚡', desc: 'Afraid of missing moves' },
    { label: 'Anxious', emoji: '😰', desc: 'Stressed about positions' },
    { label: 'Greedy', emoji: '🔥', desc: 'Chasing bigger profits' },
    { label: 'Frustrated', emoji: '😤', desc: 'Angry after loss / slip' },
    { label: 'Bored', emoji: '🥱', desc: 'Forcing low probability trades' }
  ];

  const loadReflections = async () => {
    if (!activeAccount) return;
    try {
      const data = await fetchReflections(activeAccount.id);
      setReflections(data);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve reflection history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (accountLoading) return;
    if (!activeAccount) {
      setLoading(false);
      return;
    }
    loadReflections();
  }, [activeAccount?.id, accountLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!activeAccount) {
      setError('No active trading profile selected. Cannot save reflection.');
      return;
    }

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      await saveReflection({
        account_id: activeAccount.id,
        reflection_date: todayStr,
        followed_plan: followedPlan,
        did_revenge_trade: didRevengeTrade,
        did_move_stop_loss: didMoveStopLoss,
        emotional_state: emotionalState,
        notes: notes.trim()
      });

      setSuccess(true);
      setNotes('');
      // Reload reflection list
      await loadReflections();

      setTimeout(() => {
        setSuccess(false);
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to save reflection.');
    }
  };

  if (accountLoading || (loading && activeAccount)) {
    return (
      <div className="flex flex-col gap-6 w-full py-8 text-zinc-400 font-sans">
        <div className="h-8 w-48 animate-pulse bg-zinc-900 rounded" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-96 animate-pulse bg-zinc-900 rounded-xl" />
          <div className="h-96 animate-pulse bg-zinc-900 rounded-xl" />
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
          <p className="text-sm text-zinc-500">Create a Demo, Live, or Prop Firm Challenge account first to access daily reflection journals.</p>
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

  return (
    <div className="flex flex-col gap-6 w-full font-sans pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-900 pb-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-white">Daily Reflection</h1>
          <p className="text-sm text-zinc-400">Review your mindset and rule compliance statistics daily.</p>
        </div>
        <div className="flex items-center gap-2 bg-indigo-600/10 border border-indigo-500/15 px-3 py-1.5 rounded-lg text-indigo-400 text-xs font-semibold">
          <span>Profile: <strong className="text-zinc-200">{activeAccount.name}</strong></span>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-md text-red-400 text-sm">
          <ShieldAlert size={18} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 rounded-md text-emerald-400 text-sm">
          <Sparkles size={18} className="shrink-0 mt-0.5" />
          <span>Daily Reflection successfully logged! Streak extended.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Form Panel (Left) */}
        <form onSubmit={handleSubmit} className="bg-zinc-900/20 border border-zinc-900/60 p-6 sm:p-8 rounded-xl flex flex-col gap-5 justify-between">
          <div className="flex flex-col gap-5">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-900 pb-2">Psychology Checklist</h3>

            {/* Rule 1: Did you follow your plan */}
            <div className="flex items-center justify-between gap-4 bg-zinc-900/40 border border-zinc-900/60 p-4 rounded-lg">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-bold text-zinc-200">Did you follow your trading plan?</span>
                <span className="text-xs text-zinc-500">Executing only pre-defined setups.</span>
              </div>
              <div className="flex border border-zinc-800 rounded bg-zinc-900 p-0.5 h-[32px] w-32 shrink-0">
                <button
                  type="button"
                  onClick={() => setFollowedPlan(true)}
                  className={`flex-1 text-[10px] font-bold rounded transition-all ${
                    followedPlan 
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  YES
                </button>
                <button
                  type="button"
                  onClick={() => setFollowedPlan(false)}
                  className={`flex-1 text-[10px] font-bold rounded transition-all ${
                    !followedPlan 
                      ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  NO
                </button>
              </div>
            </div>

            {/* Rule 2: Did you revenge trade */}
            <div className="flex items-center justify-between gap-4 bg-zinc-900/40 border border-zinc-900/60 p-4 rounded-lg">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-bold text-zinc-200">Did you revenge trade?</span>
                <span className="text-xs text-zinc-500">Forcing size to make back losses.</span>
              </div>
              <div className="flex border border-zinc-800 rounded bg-zinc-900 p-0.5 h-[32px] w-32 shrink-0">
                <button
                  type="button"
                  onClick={() => setDidRevengeTrade(true)}
                  className={`flex-1 text-[10px] font-bold rounded transition-all ${
                    didRevengeTrade 
                      ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  YES
                </button>
                <button
                  type="button"
                  onClick={() => setDidRevengeTrade(false)}
                  className={`flex-1 text-[10px] font-bold rounded transition-all ${
                    !didRevengeTrade 
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  NO
                </button>
              </div>
            </div>

            {/* Rule 3: Did you move SL */}
            <div className="flex items-center justify-between gap-4 bg-zinc-900/40 border border-zinc-900/60 p-4 rounded-lg">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-bold text-zinc-200">Did you move or delete Stop Loss?</span>
                <span className="text-xs text-zinc-500">Extending stop parameter due to fear.</span>
              </div>
              <div className="flex border border-zinc-800 rounded bg-zinc-900 p-0.5 h-[32px] w-32 shrink-0">
                <button
                  type="button"
                  onClick={() => setDidMoveStopLoss(true)}
                  className={`flex-1 text-[10px] font-bold rounded transition-all ${
                    didMoveStopLoss 
                      ? 'bg-red-500/10 text-red-500 border border-red-500/20' 
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  YES
                </button>
                <button
                  type="button"
                  onClick={() => setDidMoveStopLoss(false)}
                  className={`flex-1 text-[10px] font-bold rounded transition-all ${
                    !didMoveStopLoss 
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  NO
                </button>
              </div>
            </div>

            {/* Emotional State Selector */}
            <div className="flex flex-col gap-2">
              <span className="text-xs text-zinc-500 font-medium">Primary Emotional Mindset Today</span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {emotions.map((item) => {
                  const isSelected = emotionalState === item.label;
                  return (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => setEmotionalState(item.label)}
                      className={`p-3 rounded-lg border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                        isSelected 
                          ? 'bg-indigo-600/15 border-indigo-500 text-indigo-400' 
                          : 'bg-zinc-900/40 border-zinc-900 hover:border-zinc-800 text-zinc-300'
                      }`}
                    >
                      <span className="text-xl">{item.emoji}</span>
                      <span className="text-xs font-bold">{item.label}</span>
                      <span className="text-[9px] text-zinc-500 leading-normal">{item.desc}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Reflection Notes */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="notes" className="text-xs text-zinc-500 font-medium">Mental Logs & Lessons Learned</label>
              <textarea
                id="notes"
                placeholder="What went well today? What triggered errors? How will you adjust tomorrow?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-700 transition-colors resize-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm rounded-md py-2.5 transition-colors cursor-pointer mt-4 flex items-center justify-center gap-2 shadow-md"
          >
            <Brain size={16} />
            <span>Submit Daily Audit</span>
          </button>
        </form>

        {/* History / Streak Ledger Panel (Right) */}
        <div className="bg-zinc-900/10 border border-zinc-900/60 p-6 sm:p-8 rounded-xl flex flex-col gap-4">
          <div className="flex items-center justify-between border-b border-zinc-900 pb-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Streak Logs</h3>
            <div className="flex items-center gap-1.5 text-amber-500 text-xs font-bold bg-amber-500/10 border border-amber-500/20 px-2.5 py-0.5 rounded-full">
              <Flame size={12} fill="currentColor" />
              <span>{streak}-Day Streak</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-4 overflow-y-auto max-h-[500px]">
            {reflections.length === 0 ? (
              <div className="py-12 text-center text-zinc-600 text-sm my-auto">
                No reflections logged yet. Submit today&apos;s mindset audit to start your discipline streak!
              </div>
            ) : (
              reflections.map((ref) => {
                const hadFault = ref.did_revenge_trade || ref.did_move_stop_loss || !ref.followed_plan;
                return (
                  <div key={ref.id} className="bg-zinc-900/30 border border-zinc-900/50 p-4 rounded-lg flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-zinc-400">
                        {new Date(ref.reflection_date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' })}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${
                        hadFault 
                          ? 'bg-amber-500/15 text-amber-500 border-amber-500/20' 
                          : 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20'
                      }`}>
                        {hadFault ? 'Warning Flags' : 'Clean Session'}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-2 mt-1 py-1">
                      <div className="flex flex-col items-center p-1.5 rounded bg-zinc-900/40 border border-zinc-900/50">
                        <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Plan Followed</span>
                        {ref.followed_plan ? (
                          <CheckCircle2 size={14} className="text-emerald-500 mt-1" />
                        ) : (
                          <XCircle size={14} className="text-red-500 mt-1" />
                        )}
                      </div>
                      
                      <div className="flex flex-col items-center p-1.5 rounded bg-zinc-900/40 border border-zinc-900/50">
                        <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold font-sans">No Revenge</span>
                        {!ref.did_revenge_trade ? (
                          <CheckCircle2 size={14} className="text-emerald-500 mt-1" />
                        ) : (
                          <XCircle size={14} className="text-red-500 mt-1" />
                        )}
                      </div>

                      <div className="flex flex-col items-center p-1.5 rounded bg-zinc-900/40 border border-zinc-900/50">
                        <span className="text-[9px] text-zinc-500 uppercase tracking-wider font-semibold">Risk Adherence</span>
                        {!ref.did_move_stop_loss ? (
                          <CheckCircle2 size={14} className="text-emerald-500 mt-1" />
                        ) : (
                          <XCircle size={14} className="text-red-500 mt-1" />
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs text-zinc-300 border-t border-zinc-900/60 pt-2 mt-1">
                      <span className="font-semibold text-zinc-400">State:</span>
                      <span className="bg-indigo-950/40 border border-indigo-900/40 px-2 py-0.5 rounded text-indigo-400 text-[10px] font-bold">
                        {ref.emotional_state}
                      </span>
                    </div>

                    {ref.notes && (
                      <p className="text-xs text-zinc-500 leading-normal italic bg-zinc-900/20 p-2.5 rounded border border-zinc-950/60 mt-1">
                        &ldquo;{ref.notes}&rdquo;
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
