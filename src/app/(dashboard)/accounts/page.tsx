'use client';

import React, { useState } from 'react';
import { useAccount } from '@/components/AccountProvider';
import { saveAccount, archiveAccount } from '@/lib/db';
import { AccountType, TradingStyle, TradingGoal, PropFirmName, PropChallengeType } from '@/types';
import { CreditCard, Award, Layers, Plus, ShieldCheck, CheckCircle2, ChevronRight, AlertCircle, Archive, RotateCcw } from 'lucide-react';

export default function AccountsPage() {
  const { accounts, activeAccount, setActiveAccount, refreshAccounts } = useAccount();

  // Form States
  const [name, setName] = useState('');
  const [accountType, setAccountType] = useState<AccountType>('Demo');
  const [balance, setBalance] = useState('10000');
  const [tradingStyle, setTradingStyle] = useState<TradingStyle>('Intraday');
  const [tradingGoal, setTradingGoal] = useState<TradingGoal>('Consistency');

  // Prop Firm Specific States
  const [firmName, setFirmName] = useState<PropFirmName>('FundingPips');
  const [challengeType, setChallengeType] = useState<PropChallengeType>('2 Step');
  const [profitTargetPct, setProfitTargetPct] = useState('8');
  const [phase1TargetPct, setPhase1TargetPct] = useState('8');
  const [phase2TargetPct, setPhase2TargetPct] = useState('5');
  const [dailyDrawdownPct, setDailyDrawdownPct] = useState('5');
  const [maxDrawdownPct, setMaxDrawdownPct] = useState('10');
  const [minTradingDays, setMinTradingDays] = useState('3');
  const [dailyResetTimezone, setDailyResetTimezone] = useState<'Local' | 'UTC' | 'EST'>('Local');

  // UI Flow States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleArchiveToggle = async (id: string, isArchived: boolean, e: React.MouseEvent) => {
    e.stopPropagation(); // Stop click from selecting the card
    try {
      await archiveAccount(id, isArchived);
      
      // If we are archiving the currently active account, switch to another candidate if possible
      if (isArchived && activeAccount?.id === id) {
        const remainingCandidates = accounts.filter(a => a.id !== id && !a.is_archived);
        if (remainingCandidates.length > 0) {
          setActiveAccount(remainingCandidates[0]);
        } else {
          // If no other unarchived accounts, set active to null
          // The context refresh will handle it
        }
      }
      
      await refreshAccounts();
    } catch (err: any) {
      setError(err.message || 'Failed to update archive status.');
    }
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'Live': return <CreditCard size={18} className="text-emerald-400" />;
      case 'Prop Challenge': return <Award size={18} className="text-amber-500" />;
      case 'Funded Account': return <Award size={18} className="text-indigo-400" />;
      default: return <Layers size={18} className="text-zinc-500" />;
    }
  };

  const getAccountBadgeClass = (type: string) => {
    switch (type) {
      case 'Live':
        return 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/15';
      case 'Prop Challenge':
        return 'bg-amber-500/10 text-amber-555 border border-amber-500/15';
      case 'Funded Account':
        return 'bg-indigo-650/10 text-indigo-400 border border-indigo-500/15';
      default:
        return 'bg-zinc-800 text-zinc-400 border border-zinc-700';
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    const size = parseFloat(balance);
    if (isNaN(size) || size <= 0) {
      setError('Please enter a valid positive account balance size.');
      return;
    }

    setLoading(true);

    try {
      const accountData = {
        name: name.trim(),
        account_type: accountType,
        balance: size,
        trading_style: tradingStyle,
        trading_goal: tradingGoal,
      };

      let propDetails = undefined;
      if (accountType === 'Prop Challenge' || accountType === 'Funded Account') {
        const dailyDD = parseFloat(dailyDrawdownPct);
        const maxDD = parseFloat(maxDrawdownPct);
        const minDays = parseInt(minTradingDays);

        if (isNaN(dailyDD) || dailyDD <= 0 || dailyDD > 100) throw new Error('Daily Drawdown % must be between 1 and 100.');
        if (isNaN(maxDD) || maxDD <= 0 || maxDD > 100) throw new Error('Max Drawdown % must be between 1 and 100.');
        if (isNaN(minDays) || minDays < 0) throw new Error('Minimum trading days must be 0 or more.');

        propDetails = {
          firm_name: firmName,
          challenge_type: challengeType,
          profit_target_pct: challengeType === '2 Step' ? parseFloat(phase1TargetPct) : parseFloat(profitTargetPct),
          phase_1_target_pct: parseFloat(phase1TargetPct),
          phase_2_target_pct: parseFloat(phase2TargetPct),
          daily_drawdown_pct: dailyDD,
          max_drawdown_pct: maxDD,
          min_trading_days: minDays,
          daily_reset_timezone: dailyResetTimezone,
        };
      }

      const newAccount = await saveAccount(accountData, propDetails);
      
      // Select new account automatically
      setActiveAccount(newAccount);
      
      setSuccess(true);
      setName('');
      setBalance('10000');
      
      // Refresh list
      await refreshAccounts();

      setTimeout(() => {
        setSuccess(false);
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to save account profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full font-sans pb-12">
      <div className="flex flex-col gap-1 border-b border-zinc-900 pb-4">
        <h1 className="text-2xl font-bold tracking-tight text-white">Account Profiles Manager</h1>
        <p className="text-sm text-zinc-400">Create, switch, and monitor challenges across Demo, Live, and Prop account profiles.</p>
      </div>

      {error && (
        <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-md text-red-400 text-sm">
          <AlertCircle size={18} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 rounded-md text-emerald-400 text-sm">
          <CheckCircle2 size={18} className="shrink-0 mt-0.5 animate-bounce" />
          <span>Account created and selected successfully!</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Accounts List (7 Columns) */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400">Current Active Profiles ({accounts.filter(a => !a.is_archived).length})</h3>
          
          <div className="flex flex-col gap-3">
            {accounts.filter(a => !a.is_archived).map((acc) => {
              const isActive = activeAccount?.id === acc.id;
              return (
                <div
                  key={acc.id}
                  onClick={() => setActiveAccount(acc)}
                  className={`bg-zinc-900/20 border p-5 rounded-xl flex items-center justify-between cursor-pointer transition-all hover:bg-zinc-900/40 relative overflow-hidden group ${
                    isActive 
                      ? 'border-indigo-500/80 shadow-indigo-500/[0.02] shadow-lg bg-zinc-900/30' 
                      : 'border-zinc-900 hover:border-zinc-800'
                  }`}
                >
                  <div className="flex items-start gap-4 min-w-0">
                    <div className={`h-10 w-10 rounded-lg flex items-center justify-center border transition-all ${
                      isActive ? 'bg-indigo-600/15 border-indigo-500/25' : 'bg-zinc-900 border-zinc-800'
                    }`}>
                      {getAccountIcon(acc.account_type)}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-200 truncate">{acc.name}</span>
                        <span className={`text-[8px] font-bold px-1.5 py-0.25 rounded uppercase tracking-wide ${getAccountBadgeClass(acc.account_type)}`}>
                          {acc.account_type === 'Prop Challenge' ? 'Challenge' : acc.account_type === 'Funded Account' ? 'Funded' : acc.account_type}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-zinc-550 mt-1 font-medium flex-wrap">
                        <span>Balance: <strong className="text-zinc-450">${acc.balance.toLocaleString()}</strong></span>
                        <span className="h-1 w-1 rounded-full bg-zinc-800" />
                        <span>Style: <strong className="text-zinc-450">{acc.trading_style}</strong></span>
                        <span className="h-1 w-1 rounded-full bg-zinc-800" />
                        <span>Goal: <strong className="text-zinc-450">{acc.trading_goal}</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {/* Archive Button */}
                    <button
                      onClick={(e) => handleArchiveToggle(acc.id, true, e)}
                      className="p-1.5 rounded bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                      title="Archive Profile"
                    >
                      <Archive size={13} />
                    </button>

                    {/* Switch/Active State */}
                    <div onClick={() => !isActive && setActiveAccount(acc)}>
                      {isActive ? (
                        <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded flex items-center gap-1.5 shadow-sm">
                          <ShieldCheck size={11} />
                          Active
                        </span>
                      ) : (
                        <button
                          onClick={() => setActiveAccount(acc)}
                          className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 hover:text-zinc-200 border border-zinc-850 hover:bg-zinc-900/60 px-2 py-0.5 rounded transition-all flex items-center gap-0.5 cursor-pointer bg-zinc-900/30 font-sans"
                        >
                          Switch
                          <ChevronRight size={12} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Archived Profiles Section */}
          {accounts.some(a => a.is_archived) && (
            <div className="flex flex-col gap-3 mt-6 border-t border-zinc-900/60 pt-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Archived Profiles ({accounts.filter(a => a.is_archived).length})</h3>
              <div className="flex flex-col gap-3 opacity-60 hover:opacity-90 transition-opacity">
                {accounts.filter(a => a.is_archived).map((acc) => (
                  <div
                    key={acc.id}
                    className="bg-zinc-900/10 border border-zinc-950 p-4 rounded-xl flex items-center justify-between"
                  >
                    <div className="flex items-start gap-4 min-w-0">
                      <div className="h-10 w-10 rounded-lg flex items-center justify-center border bg-zinc-950/40 border-zinc-900/60">
                        {getAccountIcon(acc.account_type)}
                      </div>

                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-zinc-400 truncate line-through">{acc.name}</span>
                          <span className="text-[8px] font-bold px-1.5 py-0.25 rounded uppercase tracking-wide bg-zinc-900 text-zinc-600 border border-zinc-800/40">
                            {acc.account_type === 'Prop Challenge' ? 'Challenge' : acc.account_type === 'Funded Account' ? 'Funded' : acc.account_type}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-zinc-650 mt-1 font-medium flex-wrap">
                          <span>Balance: <strong>${acc.balance.toLocaleString()}</strong></span>
                          <span className="h-1 w-1 rounded-full bg-zinc-900" />
                          <span>Style: <strong>{acc.trading_style}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={(e) => handleArchiveToggle(acc.id, false, e)}
                        className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 hover:text-zinc-200 border border-zinc-800 hover:bg-zinc-900 px-2.5 py-1.5 rounded transition-all flex items-center gap-1.5 cursor-pointer bg-zinc-950/20"
                        title="Restore Account"
                      >
                        <RotateCcw size={12} />
                        Restore
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Account Form (5 Columns) */}
        <div className="lg:col-span-5 bg-zinc-900/20 border border-zinc-900/60 p-6 sm:p-8 rounded-xl flex flex-col gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-900 pb-2">New Profile Registration</h3>
          
          <form onSubmit={handleFormSubmit} className="flex flex-col gap-4">
            {/* Account Name */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="accName" className="text-xs text-zinc-500 font-medium">Account Display Name</label>
              <input
                id="accName"
                type="text"
                placeholder="e.g. FTMO 10K Challenge"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-700 transition-colors"
              />
            </div>

            {/* Account Type Selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-500 font-medium">Account Profile Type</label>
              <div className="grid grid-cols-2 gap-2">
                {(['Demo', 'Live', 'Prop Challenge', 'Funded Account'] as AccountType[]).map((t) => {
                  const isSelected = accountType === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setAccountType(t)}
                      className={`py-2 px-2.5 rounded-md border text-xs font-bold transition-all text-center cursor-pointer ${
                        isSelected 
                          ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/25 shadow-inner' 
                          : 'bg-zinc-900 border-zinc-900/60 text-zinc-500 hover:text-zinc-350'
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Account Balance / Style */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label htmlFor="accBalance" className="text-xs text-zinc-500 font-medium">Initial Balance ($)</label>
                <input
                  id="accBalance"
                  type="number"
                  placeholder="10000"
                  required
                  value={balance}
                  onChange={(e) => setBalance(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-700 transition-colors"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="tradingStyle" className="text-xs text-zinc-500 font-medium">Trading Style</label>
                <select
                  id="tradingStyle"
                  value={tradingStyle}
                  onChange={(e) => setTradingStyle(e.target.value as TradingStyle)}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md px-3 py-[7px] text-sm text-zinc-300 cursor-pointer transition-colors"
                >
                  <option value="Scalping">Scalping</option>
                  <option value="Intraday">Intraday</option>
                  <option value="Swing">Swing</option>
                </select>
              </div>
            </div>

            {/* Trading Goal */}
            <div className="flex flex-col gap-1.5">
              <label htmlFor="tradingGoal" className="text-xs text-zinc-500 font-medium">Account Trading Goal</label>
              <select
                id="tradingGoal"
                value={tradingGoal}
                onChange={(e) => setTradingGoal(e.target.value as TradingGoal)}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md px-3 py-2 text-sm text-zinc-300 cursor-pointer transition-colors"
              >
                <option value="Pass Challenge">Pass Challenge</option>
                <option value="Get Funded">Get Funded</option>
                <option value="Preserve Capital">Preserve Capital</option>
                <option value="Consistency">Consistency</option>
              </select>
            </div>

            {/* CONDITIONAL PROP FIRM PARAMETERS */}
            {(accountType === 'Prop Challenge' || accountType === 'Funded Account') && (
              <div className="mt-2 pt-3 border-t border-zinc-900 flex flex-col gap-4 animate-in fade-in slide-in-from-top-1 duration-200">
                <span className="text-[10px] font-black uppercase tracking-wider text-zinc-500">Prop Firm Credentials</span>

                {/* Firm Name & Challenge Type */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="firmName" className="text-xs text-zinc-500 font-medium">Prop Firm</label>
                    <select
                      id="firmName"
                      value={firmName}
                      onChange={(e) => setFirmName(e.target.value as PropFirmName)}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md px-3 py-[7px] text-sm text-zinc-300 cursor-pointer transition-colors"
                    >
                      <option value="FundingPips">FundingPips</option>
                      <option value="FTMO">FTMO</option>
                      <option value="The5ers">The5ers</option>
                      <option value="MyFundedFX">MyFundedFX</option>
                      <option value="FundedNext">FundedNext</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="challengeType" className="text-xs text-zinc-500 font-medium">Evaluation Model</label>
                    <select
                      id="challengeType"
                      value={challengeType}
                      onChange={(e) => setChallengeType(e.target.value as PropChallengeType)}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md px-3 py-[7px] text-sm text-zinc-300 cursor-pointer transition-colors"
                    >
                      <option value="1 Step">1 Step Challenge</option>
                      <option value="2 Step">2 Step Challenge</option>
                      <option value="Instant Funding">Instant Funding</option>
                    </select>
                  </div>
                </div>

                {/* Drawdown Parameters */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="dailyDrawdown" className="text-xs text-zinc-500 font-medium">Daily Drawdown %</label>
                    <input
                      id="dailyDrawdown"
                      type="number"
                      placeholder="5"
                      value={dailyDrawdownPct}
                      onChange={(e) => setDailyDrawdownPct(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-700 transition-colors"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="maxDrawdown" className="text-xs text-zinc-500 font-medium">Max Drawdown %</label>
                    <input
                      id="maxDrawdown"
                      type="number"
                      placeholder="10"
                      value={maxDrawdownPct}
                      onChange={(e) => setMaxDrawdownPct(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-700 transition-colors"
                    />
                  </div>
                </div>

                {/* Reset Timezone Selection */}
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="dailyResetTimezone" className="text-xs text-zinc-500 font-medium">Daily Drawdown Reset Timezone</label>
                  <select
                    id="dailyResetTimezone"
                    value={dailyResetTimezone}
                    onChange={(e) => setDailyResetTimezone(e.target.value as 'Local' | 'UTC' | 'EST')}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md px-3 py-2 text-sm text-zinc-350 cursor-pointer transition-colors"
                  >
                    <option value="Local">Local Midnight (Browser Time)</option>
                    <option value="UTC">UTC Midnight (00:00 UTC)</option>
                    <option value="EST">New York Midnight / 5:00 PM EST (Prop standard)</option>
                  </select>
                </div>

                {/* Profit Target Inputs */}
                {challengeType === '2 Step' ? (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="phase1Target" className="text-xs text-zinc-500 font-medium">Phase 1 Target %</label>
                      <input
                        id="phase1Target"
                        type="number"
                        placeholder="8"
                        value={phase1TargetPct}
                        onChange={(e) => setPhase1TargetPct(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-700 transition-colors"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="phase2Target" className="text-xs text-zinc-500 font-medium">Phase 2 Target %</label>
                      <input
                        id="phase2Target"
                        type="number"
                        placeholder="5"
                        value={phase2TargetPct}
                        onChange={(e) => setPhase2TargetPct(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-700 transition-colors"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="profitTarget" className="text-xs text-zinc-500 font-medium">Profit Target %</label>
                      <input
                        id="profitTarget"
                        type="number"
                        placeholder="8"
                        value={profitTargetPct}
                        onChange={(e) => setProfitTargetPct(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-700 transition-colors"
                      />
                    </div>

                    <div className="flex flex-col gap-1.5">
                      <label htmlFor="minTradingDays" className="text-xs text-zinc-500 font-medium">Min Trading Days</label>
                      <input
                        id="minTradingDays"
                        type="number"
                        placeholder="3"
                        value={minTradingDays}
                        onChange={(e) => setMinTradingDays(e.target.value)}
                        className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-700 transition-colors"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-650 hover:bg-indigo-500 disabled:bg-indigo-700 text-white font-semibold text-sm rounded-md py-2.5 transition-colors cursor-pointer mt-2 flex items-center justify-center gap-2 shadow-md"
            >
              {loading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              ) : (
                <>
                  <Plus size={16} />
                  <span>Create Profile</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
