'use client';

import React, { useState, useEffect, useRef } from 'react';
import { saveTrade, isMockMode } from '@/lib/db';
import { TradeDirection, TradeStatus, TradingSession, SetupGrade, PreTradeState } from '@/types';
import { useRouter } from 'next/navigation';
import { PlusCircle, ShieldAlert, Sparkles, Image as ImageIcon, Upload, X, Link as LinkIcon, Clipboard } from 'lucide-react';
import { useAccount } from '@/components/AccountProvider';
import Link from 'next/link';

export default function JournalPage() {
  const { activeAccount, loading: accountLoading } = useAccount();
  const [lastClosedLoss, setLastClosedLoss] = useState<any>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<string>('');

  useEffect(() => {
    if (!activeAccount) return;
    
    async function checkLastClosedTrade() {
      try {
        const { fetchTrades } = await import('@/lib/db');
        if (!activeAccount) return;
        const allTrades = await fetchTrades(activeAccount.id);
        const closedTrades = allTrades
          .filter(t => t.status === 'CLOSED')
          .sort((a, b) => new Date(b.close_time || b.open_time).getTime() - new Date(a.close_time || a.open_time).getTime());
        
        if (closedTrades.length > 0 && (closedTrades[0].pnl || 0) < 0) {
          setLastClosedLoss(closedTrades[0]);
        } else {
          setLastClosedLoss(null);
        }
      } catch (err) {
        console.error('Failed to fetch last closed trade', err);
      }
    }
    
    checkLastClosedTrade();
  }, [activeAccount?.id]);

  useEffect(() => {
    if (!lastClosedLoss || !lastClosedLoss.close_time) {
      setCooldownRemaining('');
      return;
    }
    
    const calculateTimeRemaining = () => {
      const closeTimeMs = new Date(lastClosedLoss.close_time!).getTime();
      const nowMs = Date.now();
      const elapsedMs = nowMs - closeTimeMs;
      const cooldownMs = 60 * 60 * 1000; // 60 minutes
      const remainingMs = cooldownMs - elapsedMs;
      
      if (remainingMs <= 0) {
        setCooldownRemaining('');
        return false; // ended
      }
      
      const mins = Math.floor(remainingMs / (60 * 1000));
      const secs = Math.floor((remainingMs % (60 * 1000)) / 1000);
      setCooldownRemaining(`${mins}m ${secs}s`);
      return true;
    };
    
    const active = calculateTimeRemaining();
    if (!active) return;
    
    const timer = setInterval(() => {
      const active = calculateTimeRemaining();
      if (!active) {
        clearInterval(timer);
      }
    }, 1000);
    
    return () => clearInterval(timer);
  }, [lastClosedLoss]);

  // Helper to format Date to local YYYY-MM-DDTHH:MM
  const getLocalDateTimeString = (date = new Date()) => {
    const tzOffset = date.getTimezoneOffset() * 60000;
    return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
  };

  const [pair, setPair] = useState('');
  const [direction, setDirection] = useState<TradeDirection>('LONG');
  const [session, setSession] = useState<TradingSession>('LONDON');
  const [setupGrade, setSetupGrade] = useState<SetupGrade>('A');
  const [preTradeState, setPreTradeState] = useState<PreTradeState>('Calm');
  const [openTime, setOpenTime] = useState(getLocalDateTimeString());
  const [closeTime, setCloseTime] = useState(getLocalDateTimeString());
  const [entryPrice, setEntryPrice] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [stopLoss, setStopLoss] = useState('');
  const [takeProfit, setTakeProfit] = useState('');
  const [lotSize, setLotSize] = useState('1.0');
  const [notes, setNotes] = useState('');
  
  // Screenshot states
  const [screenshotUrl, setScreenshotUrl] = useState('');
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadMode, setUploadMode] = useState<'FILE' | 'URL'>('FILE');

  // Setup Strategy states
  const [setupTags, setSetupTags] = useState<string[]>([]);
  const strategyOptions = [
    'Liquidity Sweep',
    'BOS',
    'CHOCH',
    'FVG',
    'Trendline',
    'Breakout',
    'Pullback',
    'Support Resistance'
  ];

  const handleTagToggle = (tag: string) => {
    setSetupTags(prev => 
      prev.includes(tag) 
        ? prev.filter(t => t !== tag) 
        : [...prev, tag]
    );
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Scroll to error banner if one is set
  useEffect(() => {
    if (error) {
      const errorBanner = document.getElementById('journal-error-banner');
      if (errorBanner) {
        errorBanner.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [error]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Unsupported file type. Please upload an image file.');
      return;
    }
    
    // Check file size (limit to 3MB for local storage safety in mock mode)
    if (file.size > 3 * 1024 * 1024) {
      setError('File size too large. Please upload an image smaller than 3MB.');
      return;
    }

    setError(null);
    setScreenshotFile(file);
    setScreenshotUrl(''); // clear URL input if file is chosen

    const reader = new FileReader();
    reader.onloadend = () => {
      setScreenshotPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Drag & Drop Handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // Clipboard Paste Handler (Ctrl+V)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          processFile(file);
          break;
        }
      }
    }
  };

  const clearScreenshot = () => {
    setScreenshotFile(null);
    setScreenshotPreview(null);
    setScreenshotUrl('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const calculatePnlEstimate = (entry: number, exit: number | null, size: number, dir: TradeDirection, symbol: string): number => {
    if (!exit) return 0;
    const cleanSym = symbol.toUpperCase().replace(/[^A-Z0-9]/g, '');
    const priceDiff = dir === 'LONG' ? (exit - entry) : (entry - exit);

    // 1. Gold (XAUUSD / XAU / GOLD)
    if (cleanSym.includes('XAU') || cleanSym.includes('GOLD')) {
      return priceDiff * size * 100;
    }

    // 2. Silver (XAGUSD / XAG / SILVER)
    if (cleanSym.includes('XAG') || cleanSym.includes('SILVER')) {
      return priceDiff * size * 5000;
    }

    // 3. Major Index CFDs
    // US30, NAS100, GER30 -> Multiplier 1
    // SPX500 -> Multiplier 10
    if (cleanSym.includes('US30') || cleanSym.includes('DJ30') || cleanSym.includes('DOW')) {
      return priceDiff * size * 1;
    }
    if (cleanSym.includes('NAS100') || cleanSym.includes('NAS') || cleanSym.includes('USTEC') || cleanSym.includes('US100') || cleanSym.includes('NDX')) {
      return priceDiff * size * 1;
    }
    if (cleanSym.includes('SPX500') || cleanSym.includes('SPX') || cleanSym.includes('US500') || cleanSym.includes('SP500')) {
      return priceDiff * size * 10;
    }
    if (cleanSym.includes('GER30') || cleanSym.includes('GER40') || cleanSym.includes('DE30') || cleanSym.includes('DE40') || cleanSym.includes('DAX')) {
      return priceDiff * size * 1;
    }

    // 4. Forex JPY Pairs (USDJPY, EURJPY, etc.)
    if (cleanSym.endsWith('JPY')) {
      return priceDiff * size * 1000;
    }

    // 5. Standard Forex Currency Pairs (EURUSD, GBPUSD, AUDUSD, USDCAD, USDCHF, EURGBP, etc.)
    if (cleanSym.length === 6) {
      return priceDiff * size * 100000;
    }

    // 6. Fallback CFD/Crypto/Stock multipliers
    return priceDiff * size;
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!activeAccount) {
      setError('No active trading profile selected. Cannot save trade.');
      return;
    }

    // 1. Check for empty inputs to bypass browser validation popups with modern styling
    if (!pair.trim()) {
      setError('Please fill in the Asset Pair field (e.g. EURUSD).');
      return;
    }
    if (!entryPrice.trim()) {
      setError('Please fill in the Entry Price field.');
      return;
    }
    if (!stopLoss.trim()) {
      setError('Please fill in the Stop Loss (SL) field.');
      return;
    }
    if (!takeProfit.trim()) {
      setError('Please fill in the Take Profit (TP) field.');
      return;
    }
    if (!lotSize.trim()) {
      setError('Please fill in the Volume (Lots) field.');
      return;
    }

    const entry = parseFloat(entryPrice);
    const sl = parseFloat(stopLoss);
    const tp = parseFloat(takeProfit);
    const size = parseFloat(lotSize);
    const exit = exitPrice ? parseFloat(exitPrice) : null;

    // 2. Validate positive numbers only
    if (isNaN(entry) || entry <= 0) return setError('Entry Price must be a valid positive number.');
    if (exit !== null && (isNaN(exit) || exit <= 0)) return setError('Exit Price must be a valid positive number.');
    if (isNaN(sl) || sl <= 0) return setError('Stop Loss (SL) must be a valid positive number.');
    if (isNaN(tp) || tp <= 0) return setError('Take Profit (TP) must be a valid positive number.');
    if (isNaN(size) || size <= 0) return setError('Volume (Lots) must be a valid positive number.');
    
    if (direction === 'LONG') {
      if (sl >= entry) return setError('Stop Loss must be below Entry Price for LONG trades.');
      if (tp <= entry) return setError('Take Profit must be above Entry Price for LONG trades.');
    } else {
      if (sl <= entry) return setError('Stop Loss must be above Entry Price for SHORT trades.');
      if (tp >= entry) return setError('Take Profit must be below Entry Price for SHORT trades.');
    }

    setLoading(true);

    try {
      let finalScreenshotUrl = screenshotUrl;

      // Handle file uploads (Supabase Storage in Live mode, Base64 in Mock mode)
      if (screenshotFile && screenshotPreview) {
        if (isMockMode) {
          finalScreenshotUrl = screenshotPreview; // Store base64 data string locally
        } else {
          const formData = new FormData();
          formData.append('file', screenshotFile);

          const uploadRes = await fetch('/api/upload', {
            method: 'POST',
            body: formData,
          });

          if (!uploadRes.ok) {
            const errData = await uploadRes.json();
            throw new Error(errData.error || 'Failed to upload screenshot.');
          }

          const { publicUrl } = await uploadRes.json();
          finalScreenshotUrl = publicUrl;
        }
      }

      const status: TradeStatus = exit ? 'CLOSED' : 'OPEN';
      const pnl = exit ? calculatePnlEstimate(entry, exit, size, direction, pair) : undefined;

      await saveTrade({
        account_id: activeAccount.id,
        pair: pair.toUpperCase().trim(),
        direction,
        session,
        setup_grade: setupGrade,
        pre_trade_state: preTradeState,
        entry_price: entry,
        exit_price: exit || undefined,
        stop_loss: sl,
        take_profit: tp,
        lot_size: size,
        screenshot_url: finalScreenshotUrl.trim() || undefined,
        setup_tags: setupTags,
        notes: notes.trim(),
        pnl,
        status,
        open_time: new Date(openTime).toISOString(),
        close_time: exit ? new Date(closeTime).toISOString() : undefined,
      });

      setSuccess(true);
      setPair('');
      setEntryPrice('');
      setExitPrice('');
      setStopLoss('');
      setTakeProfit('');
      setSetupTags([]);
      setSession('LONDON');
      setSetupGrade('A');
      setPreTradeState('Calm');
      setOpenTime(getLocalDateTimeString());
      setCloseTime(getLocalDateTimeString());
      setNotes('');
      clearScreenshot();
      
      setTimeout(() => {
        router.push('/history');
      }, 1500);

    } catch (err: any) {
      setError(err.message || 'Failed to save trade to journal.');
    } finally {
      setLoading(false);
    }
  };

  if (accountLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-zinc-950 text-zinc-400 font-sans">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-200" />
      </div>
    );
  }

  if (!activeAccount) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-4 py-12 px-4 font-sans">
        <div className="h-16 w-16 bg-zinc-900 border border-zinc-800 flex items-center justify-center rounded-2xl text-zinc-500 shadow-md">
          <PlusCircle size={28} />
        </div>
        <div className="flex flex-col gap-1.5 max-w-sm">
          <h2 className="text-lg font-bold text-white">No Trading Profile Selected</h2>
          <p className="text-sm text-zinc-500">Create a Demo, Live, or Prop Firm Challenge account first to start journaling trades.</p>
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
    <div className="flex flex-col gap-6 w-full font-sans pb-12" onPaste={handlePaste}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-900 pb-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold tracking-tight text-white">Log Trade Setup</h1>
          <p className="text-sm text-zinc-400">Log your active trades and upload chart screenshots to track setups.</p>
        </div>
        <div className="flex items-center gap-2 bg-indigo-600/10 border border-indigo-500/15 px-3 py-1.5 rounded-lg text-indigo-400 text-xs font-semibold">
          <span>Active Profile: <strong className="text-zinc-200">{activeAccount.name}</strong></span>
        </div>
      </div>

      {error && (
        <div id="journal-error-banner" className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-md text-red-400 text-sm">
          <ShieldAlert size={18} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 rounded-md text-emerald-400 text-sm">
          <Sparkles size={18} className="shrink-0 mt-0.5 animate-bounce" />
          <span>Trade successfully saved to journal! Redirecting to history...</span>
        </div>
      )}

      {cooldownRemaining && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-red-500/5 border border-red-500/15 p-4 rounded-xl text-red-500 animate-pulse">
          <div className="flex items-center gap-3">
            <ShieldAlert size={20} className="shrink-0 mt-0.5 sm:mt-0" />
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-zinc-200">Revenge Trading Risk: 60-Min Cooldown Active</span>
              <span className="text-xs text-zinc-500 mt-0.5">
                You closed a losing trade ({lastClosedLoss?.pair}) at {new Date(lastClosedLoss?.close_time || '').toLocaleTimeString()}. Walk away to avoid emotional overtrading.
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 text-red-550 bg-red-500/10 border border-red-500/10 px-3 py-1.5 rounded-md text-xs font-bold tracking-wide uppercase shrink-0">
            <span>Cooldown: {cooldownRemaining}</span>
          </div>
        </div>
      )}

      <form noValidate onSubmit={handleFormSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-zinc-900/20 border border-zinc-900/60 p-6 sm:p-8 rounded-xl">
        {/* Left Column: Stats */}
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-900 pb-2">Execution Metrics</h3>

          {/* Pair & Direction */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="pair" className="text-xs text-zinc-500 font-medium">Asset Pair (e.g. EURUSD)</label>
              <input
                id="pair"
                type="text"
                placeholder="EURUSD"
                required
                value={pair}
                onChange={(e) => setPair(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-700 transition-colors uppercase"
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-500 font-medium">Trade Direction</label>
              <div className="flex border border-zinc-800 rounded-md overflow-hidden bg-zinc-900 h-[38px] p-0.5">
                <button
                  type="button"
                  onClick={() => setDirection('LONG')}
                  className={`flex-1 text-xs font-bold rounded transition-all ${
                    direction === 'LONG' 
                      ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shadow-inner' 
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  LONG
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('SHORT')}
                  className={`flex-1 text-xs font-bold rounded transition-all ${
                    direction === 'SHORT' 
                      ? 'bg-red-500/10 text-red-500 border border-red-500/20 shadow-inner' 
                      : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  SHORT
                </button>
              </div>
            </div>
          </div>

          {/* Session Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-500 font-medium">Trading Session</label>
            <div className="flex border border-zinc-800 rounded-md overflow-hidden bg-zinc-900 h-[38px] p-0.5 w-full">
              {(['ASIAN', 'LONDON', 'NEW_YORK', 'LONDON_NY'] as TradingSession[]).map((s) => {
                const isSelected = session === s;
                const labelMap = {
                  ASIAN: 'Asian',
                  LONDON: 'London',
                  NEW_YORK: 'New York',
                  LONDON_NY: 'London + NY'
                };
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSession(s)}
                    className={`flex-1 text-center text-xs font-bold rounded transition-all cursor-pointer h-full ${
                      isSelected 
                        ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20 shadow-inner' 
                        : 'text-zinc-500 hover:text-zinc-300'
                    }`}
                  >
                    {labelMap[s]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Setup Grade Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-500 font-medium">Setup Quality (Process Grade)</label>
            <div className="flex border border-zinc-800 rounded-md overflow-hidden bg-zinc-900 h-[38px] p-0.5 w-full">
              {(['A+', 'A', 'B', 'C', 'D'] as SetupGrade[]).map((g) => {
                const isSelected = setupGrade === g;
                const colorMap = {
                  'A+': isSelected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-inner' : 'text-zinc-500 hover:text-emerald-500',
                  'A': isSelected ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 shadow-inner' : 'text-zinc-500 hover:text-zinc-400',
                  'B': isSelected ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/20 shadow-inner' : 'text-zinc-500 hover:text-zinc-400',
                  'C': isSelected ? 'bg-amber-500/10 text-amber-500 border-amber-500/20 shadow-inner' : 'text-zinc-500 hover:text-zinc-400',
                  'D': isSelected ? 'bg-red-500/10 text-red-500 border-red-500/20 shadow-inner' : 'text-zinc-500 hover:text-red-500'
                };
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setSetupGrade(g)}
                    className={`flex-grow text-center text-xs font-bold rounded transition-all cursor-pointer h-full ${
                      colorMap[g]
                    }`}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Pre-Trade Psychology Selector */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-500 font-medium">Pre-Trade Psychology (Mindset at Entry)</label>
            <div className="grid grid-cols-3 gap-2 bg-zinc-950/20 border border-zinc-800 p-2 rounded-md">
              {(['Calm', 'Focused', 'FOMO', 'Angry', 'Tired', 'Greedy'] as PreTradeState[]).map((state) => {
                const isSelected = preTradeState === state;
                const emojiMap = {
                  Calm: '😌 Calm',
                  Focused: '🎯 Focused',
                  FOMO: '😨 FOMO',
                  Angry: '😡 Angry',
                  Tired: '🥱 Tired',
                  Greedy: '🤑 Greedy'
                };
                
                const styleMap = {
                  Calm: isSelected ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' : 'bg-zinc-900 border-zinc-900/60 text-zinc-400 hover:text-emerald-500',
                  Focused: isSelected ? 'bg-indigo-600/10 text-indigo-400 border-indigo-500/25' : 'bg-zinc-900 border-zinc-900/60 text-zinc-400 hover:text-indigo-400',
                  FOMO: isSelected ? 'bg-amber-500/10 text-amber-500 border-amber-500/25' : 'bg-zinc-900 border-zinc-900/60 text-zinc-400 hover:text-amber-500',
                  Angry: isSelected ? 'bg-red-500/10 text-red-500 border-red-500/25 animate-pulse' : 'bg-zinc-900 border-zinc-900/60 text-zinc-400 hover:text-red-500',
                  Tired: isSelected ? 'bg-amber-500/10 text-amber-400 border-amber-500/25' : 'bg-zinc-900 border-zinc-900/60 text-zinc-400 hover:text-amber-400',
                  Greedy: isSelected ? 'bg-red-500/10 text-red-400 border-red-500/25' : 'bg-zinc-900 border-zinc-900/60 text-zinc-400 hover:text-red-400'
                };

                return (
                  <button
                    key={state}
                    type="button"
                    onClick={() => setPreTradeState(state)}
                    className={`px-2 py-1.5 rounded-md border text-xs font-bold transition-all text-center cursor-pointer ${
                      styleMap[state]
                    }`}
                  >
                    {emojiMap[state]}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Entry & Exit Prices */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="entry" className="text-xs text-zinc-500 font-medium">Entry Price</label>
              <input
                id="entry"
                type="number"
                step="any"
                min="0"
                placeholder="1.08500"
                required
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value.replace(/-/g, ''))}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-700 transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="exit" className="text-xs text-zinc-500 font-medium">Exit Price <span className="text-[10px] text-zinc-600">(Leave blank if open)</span></label>
              <input
                id="exit"
                type="number"
                step="any"
                min="0"
                placeholder="1.08950"
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value.replace(/-/g, ''))}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-700 transition-colors"
              />
            </div>
          </div>

          {/* SL & TP Prices */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="sl" className="text-xs text-zinc-500 font-medium">Stop Loss (SL)</label>
              <input
                id="sl"
                type="number"
                step="any"
                min="0"
                placeholder="1.08200"
                required
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value.replace(/-/g, ''))}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-700 transition-colors"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="tp" className="text-xs text-zinc-500 font-medium">Take Profit (TP)</label>
              <input
                id="tp"
                type="number"
                step="any"
                min="0"
                placeholder="1.09200"
                required
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value.replace(/-/g, ''))}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-700 transition-colors"
              />
            </div>
          </div>

          {/* Lot Size */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="lot" className="text-xs text-zinc-500 font-medium">Volume (Lots)</label>
            <input
              id="lot"
              type="number"
              step="any"
              min="0"
              required
              value={lotSize}
              onChange={(e) => setLotSize(e.target.value.replace(/-/g, ''))}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-700 transition-colors"
            />
          </div>

          {/* Execution Time Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="openTime" className="text-xs text-zinc-500 font-medium">Open Date & Time</label>
              <input
                id="openTime"
                type="datetime-local"
                required
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md px-3 py-2 text-xs text-zinc-300 transition-colors cursor-pointer"
              />
            </div>

            {exitPrice && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="closeTime" className="text-xs text-zinc-500 font-medium">Close Date & Time</label>
                <input
                  id="closeTime"
                  type="datetime-local"
                  required
                  value={closeTime}
                  onChange={(e) => setCloseTime(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md px-3 py-2 text-xs text-zinc-300 transition-colors cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Strategy Tags Checklist */}
          <div className="flex flex-col gap-1.5 mt-2">
            <label className="text-xs text-zinc-500 font-medium">Strategy Setups</label>
            <div className="grid grid-cols-2 gap-2 bg-zinc-950/40 border border-zinc-900/60 p-3 rounded-lg">
              {strategyOptions.map(tag => {
                const isSelected = setupTags.includes(tag);
                return (
                  <label key={tag} className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer select-none hover:text-zinc-100 transition-colors">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleTagToggle(tag)}
                      className="rounded bg-zinc-900 border-zinc-800 text-indigo-650 focus:ring-0 focus:ring-offset-0 h-4 w-4 cursor-pointer accent-indigo-600"
                    />
                    <span>{tag}</span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Qualitative Info (Screenshot, Notes, Submit) */}
        <div className="flex flex-col gap-4">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 border-b border-zinc-900 pb-2">Context & Notes</h3>

          {/* Chart Screenshot Section */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-xs text-zinc-500 font-medium">Chart Screenshot</label>
              
              {/* Mode toggler */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setUploadMode('FILE')}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all ${
                    uploadMode === 'FILE' 
                      ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' 
                      : 'text-zinc-500 hover:text-zinc-400'
                  }`}
                >
                  Upload File
                </button>
                <button
                  type="button"
                  onClick={() => setUploadMode('URL')}
                  className={`text-[10px] font-bold px-2 py-0.5 rounded transition-all ${
                    uploadMode === 'URL' 
                      ? 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/20' 
                      : 'text-zinc-500 hover:text-zinc-400'
                  }`}
                >
                  Image URL
                </button>
              </div>
            </div>

            {uploadMode === 'FILE' ? (
              /* Drag & Drop File Zone */
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative border-2 border-dashed rounded-lg p-5 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all ${
                  isDragActive
                    ? 'border-indigo-500 bg-indigo-600/[0.04]'
                    : 'border-zinc-800 bg-zinc-900/10 hover:border-zinc-700 hover:bg-zinc-900/20'
                }`}
              >
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  className="hidden"
                />

                {screenshotPreview ? (
                  /* Thumbnail preview */
                  <div className="relative w-full aspect-video rounded overflow-hidden border border-zinc-800 bg-zinc-950 flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
                    <img 
                      src={screenshotPreview} 
                      alt="Chart Preview" 
                      className="max-w-full max-h-full object-contain"
                    />
                    <button
                      type="button"
                      onClick={clearScreenshot}
                      className="absolute top-2 right-2 h-6 w-6 rounded-full bg-zinc-950/80 hover:bg-zinc-950 border border-zinc-800 text-zinc-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  /* Placeholder prompts */
                  <>
                    <div className="h-10 w-10 bg-zinc-900 border border-zinc-800 flex items-center justify-center rounded-lg text-zinc-500">
                      <Upload size={18} />
                    </div>
                    <span className="text-xs font-semibold text-zinc-300 text-center">
                      Drag & Drop chart, click to browse, or paste (Ctrl+V)
                    </span>
                    <span className="text-[10px] text-zinc-500 text-center leading-normal max-w-xs">
                      Supports TradingView screenshots, clipboard captures, and MT5 export files. (Max 3MB)
                    </span>
                  </>
                )}
              </div>
            ) : (
              /* Image URL Input */
              <div className="relative">
                {screenshotUrl && (
                  <button
                    type="button"
                    onClick={clearScreenshot}
                    className="absolute right-3 top-2.5 text-zinc-500 hover:text-white"
                  >
                    <X size={14} />
                  </button>
                )}
                <LinkIcon size={14} className="absolute left-3 top-3 text-zinc-600" />
                <input
                  type="url"
                  placeholder="https://www.tradingview.com/x/..."
                  value={screenshotUrl}
                  onChange={(e) => {
                    setScreenshotUrl(e.target.value);
                    setScreenshotPreview(e.target.value); // Set preview directly to the URL
                    setScreenshotFile(null); // Clear file if URL is typed
                  }}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md py-2 pl-9 pr-9 text-xs text-zinc-200 placeholder:text-zinc-700 transition-colors"
                />
              </div>
            )}
          </div>

          {/* Notes Textarea */}
          <div className="flex-grow flex flex-col gap-1.5">
            <label htmlFor="notes" className="text-xs text-zinc-500 font-medium">Trade Setup Notes & Reminders</label>
            <textarea
              id="notes"
              placeholder="Write setup arguments: H4 Support reject, trendline bounce, calm state when executing..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-700 transition-colors resize-none flex-grow"
            />
          </div>

          {error && (
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-md text-red-400 text-sm mt-2">
              <ShieldAlert size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700 text-white font-semibold text-sm rounded-md py-2.5 transition-colors cursor-pointer mt-2 flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            ) : (
              <>
                <PlusCircle size={16} />
                <span>Save Trade to Journal</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
