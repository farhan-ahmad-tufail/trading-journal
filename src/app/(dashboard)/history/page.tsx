'use client';

import React, { useState, useEffect, useRef } from 'react';
import { fetchTrades, deleteTrade, updateTrade } from '@/lib/db';
import { Trade, TradeDirection, TradeStatus } from '@/types';
import { useAccount } from '@/components/AccountProvider';
import Link from 'next/link';
import { 
  Search, 
  Trash2, 
  ArrowUpDown, 
  ShieldAlert, 
  Calendar, 
  ExternalLink,
  ChevronDown,
  PlusCircle,
  Pencil,
  X,
  CheckCircle2,
  Lock
} from 'lucide-react';

type SortField = 'open_time' | 'pnl' | 'lot_size';
type SortOrder = 'asc' | 'desc';

// ─── PnL Calculator (same logic as journal page) ───────────────────────────
function calculatePnlEstimate(entry: number, exit: number, size: number, dir: TradeDirection, symbol: string): number {
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

function getLocalDateTimeString(date = new Date()) {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
}

// ─── Edit / Close Trade Modal ─────────────────────────────────────────────
interface EditModalProps {
  trade: Trade;
  onClose: () => void;
  onSave: (updated: Trade) => void;
}

function EditTradeModal({ trade, onClose, onSave }: EditModalProps) {
  const isOpen = trade.status === 'OPEN';

  // Editable fields
  const [exitPrice, setExitPrice] = useState(trade.exit_price ? String(trade.exit_price) : '');
  const [entryPrice, setEntryPrice] = useState(String(trade.entry_price));
  const [stopLoss, setStopLoss] = useState(String(trade.stop_loss));
  const [takeProfit, setTakeProfit] = useState(String(trade.take_profit));
  const [lotSize, setLotSize] = useState(String(trade.lot_size));
  const [closeTime, setCloseTime] = useState(
    trade.close_time ? getLocalDateTimeString(new Date(trade.close_time)) : getLocalDateTimeString()
  );
  const [notes, setNotes] = useState(trade.notes || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on overlay click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  // Derived live PnL preview
  const entryNum = parseFloat(entryPrice);
  const exitNum = parseFloat(exitPrice);
  const sizeNum = parseFloat(lotSize);
  const livePnl = (!isNaN(entryNum) && !isNaN(exitNum) && !isNaN(sizeNum) && exitNum > 0)
    ? calculatePnlEstimate(entryNum, exitNum, sizeNum, trade.direction, trade.pair)
    : null;

  const handleSave = async () => {
    setError(null);

    const entry = parseFloat(entryPrice);
    const exit = exitPrice ? parseFloat(exitPrice) : null;
    const sl = parseFloat(stopLoss);
    const tp = parseFloat(takeProfit);
    const size = parseFloat(lotSize);

    // Validations
    if (isNaN(entry) || entry <= 0) return setError('Entry Price must be a valid positive number.');
    if (exit !== null && (isNaN(exit) || exit <= 0)) return setError('Exit Price must be a valid positive number.');
    if (isNaN(sl) || sl <= 0) return setError('Stop Loss must be a valid positive number.');
    if (isNaN(tp) || tp <= 0) return setError('Take Profit must be a valid positive number.');
    if (isNaN(size) || size <= 0) return setError('Volume must be a valid positive number.');
    if (isOpen && !exit) return setError('Exit Price is required to close this trade.');

    const newStatus: TradeStatus = exit ? 'CLOSED' : 'OPEN';
    const pnl = exit ? calculatePnlEstimate(entry, exit, size, trade.direction, trade.pair) : undefined;

    setLoading(true);
    try {
      const updates: Partial<Trade> = {
        entry_price: entry,
        exit_price: exit || undefined,
        stop_loss: sl,
        take_profit: tp,
        lot_size: size,
        pnl,
        status: newStatus,
        notes: notes.trim(),
        close_time: exit ? new Date(closeTime).toISOString() : undefined,
      };

      const updated = await updateTrade(trade.id, updates);
      onSave(updated);
    } catch (err: any) {
      setError(err.message || 'Failed to update trade.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-end"
    >
      {/* Slide-in Panel */}
      <div className="w-full max-w-md h-full bg-zinc-950 border-l border-zinc-900 flex flex-col animate-in slide-in-from-right duration-200 font-sans overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-900">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-base font-bold text-white">
              {isOpen ? '🔒 Close Trade' : '✏️ Edit Trade'}
            </h2>
            <p className="text-xs text-zinc-500">
              {trade.pair} — {trade.direction} — {isOpen ? 'Mark as Closed' : 'Update Details'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-5 p-6 flex-1">

          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-md text-red-400 text-sm">
              <ShieldAlert size={16} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Info badge */}
          {isOpen && (
            <div className="flex items-start gap-2.5 bg-amber-500/5 border border-amber-500/15 px-4 py-3 rounded-md text-amber-500 text-xs">
              <Lock size={14} className="shrink-0 mt-0.5" />
              <span>Fill in the <strong>Exit Price</strong> and <strong>Close Time</strong> to mark this trade as Closed. PnL will be calculated automatically.</span>
            </div>
          )}

          {/* Entry Price */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-500 font-medium">Entry Price</label>
            <input
              type="number"
              step="any"
              min="0"
              value={entryPrice}
              onChange={(e) => setEntryPrice(e.target.value.replace(/-/g, ''))}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md px-3 py-2 text-sm text-zinc-200 transition-colors"
            />
          </div>

          {/* Exit Price */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-500 font-medium">
              Exit Price {isOpen && <span className="text-amber-500 font-bold">*</span>}
              {!isOpen && <span className="text-zinc-700 ml-1">(leave blank to keep OPEN)</span>}
            </label>
            <input
              type="number"
              step="any"
              min="0"
              value={exitPrice}
              onChange={(e) => setExitPrice(e.target.value.replace(/-/g, ''))}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md px-3 py-2 text-sm text-zinc-200 transition-colors"
              placeholder="Enter exit price..."
            />
          </div>

          {/* SL & TP */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-500 font-medium">Stop Loss (SL)</label>
              <input
                type="number"
                step="any"
                min="0"
                value={stopLoss}
                onChange={(e) => setStopLoss(e.target.value.replace(/-/g, ''))}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md px-3 py-2 text-sm text-zinc-200 transition-colors"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-500 font-medium">Take Profit (TP)</label>
              <input
                type="number"
                step="any"
                min="0"
                value={takeProfit}
                onChange={(e) => setTakeProfit(e.target.value.replace(/-/g, ''))}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md px-3 py-2 text-sm text-zinc-200 transition-colors"
              />
            </div>
          </div>

          {/* Lot Size */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-500 font-medium">Volume (Lots)</label>
            <input
              type="number"
              step="any"
              min="0"
              value={lotSize}
              onChange={(e) => setLotSize(e.target.value.replace(/-/g, ''))}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md px-3 py-2 text-sm text-zinc-200 transition-colors"
            />
          </div>

          {/* Close Time (shown when exit price is entered or trade is being closed) */}
          {(exitPrice || !isOpen) && (
            <div className="flex flex-col gap-1.5">
              <label className="text-xs text-zinc-500 font-medium">Close Date & Time</label>
              <input
                type="datetime-local"
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md px-3 py-2 text-xs text-zinc-300 transition-colors cursor-pointer"
              />
            </div>
          )}

          {/* PnL Preview */}
          {livePnl !== null && (
            <div className={`flex items-center justify-between px-4 py-3 rounded-lg border text-sm font-bold ${
              livePnl >= 0
                ? 'bg-emerald-500/5 border-emerald-500/15 text-emerald-400'
                : 'bg-red-500/5 border-red-500/15 text-red-400'
            }`}>
              <span className="text-xs text-zinc-500 font-medium">Estimated PnL</span>
              <span>{livePnl >= 0 ? '+' : ''}${livePnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          )}

          {/* Notes */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs text-zinc-500 font-medium">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Update your trade notes..."
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-700 transition-colors resize-none"
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex gap-3 p-6 border-t border-zinc-900 bg-zinc-950 sticky bottom-0">
          <button
            onClick={onClose}
            className="flex-1 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-300 font-semibold text-sm rounded-md py-2.5 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className={`flex-1 font-semibold text-sm rounded-md py-2.5 transition-colors cursor-pointer flex items-center justify-center gap-2 ${
              isOpen
                ? 'bg-amber-600 hover:bg-amber-500 text-white disabled:bg-amber-800'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white disabled:bg-indigo-800'
            }`}
          >
            {loading ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            ) : (
              <>
                <CheckCircle2 size={15} />
                <span>{isOpen ? 'Close Trade' : 'Save Changes'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main History Page ────────────────────────────────────────────────────
export default function HistoryPage() {
  const { activeAccount, loading: accountLoading } = useAccount();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [filterDirection, setFilterDirection] = useState<'ALL' | TradeDirection>('ALL');
  const [filterStatus, setFilterStatus] = useState<'ALL' | TradeStatus>('ALL');

  // Sorting state
  const [sortField, setSortField] = useState<SortField>('open_time');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  const loadTrades = async () => {
    if (!activeAccount) return;
    try {
      const data = await fetchTrades(activeAccount.id);
      setTrades(data);
    } catch (err: any) {
      setError(err.message || 'Failed to retrieve trade log history.');
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
    loadTrades();
  }, [activeAccount?.id, accountLoading]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this trade setup from your journal?')) return;
    try {
      await deleteTrade(id);
      setTrades(prev => prev.filter(t => t.id !== id));
    } catch (err: any) {
      alert(err.message || 'Failed to delete trade record.');
    }
  };

  const handleEditSave = (updated: Trade) => {
    setTrades(prev => prev.map(t => t.id === updated.id ? updated : t));
    setEditingTrade(null);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // 1. Filter
  const filteredTrades = trades.filter((trade) => {
    const matchesSearch = trade.pair.toUpperCase().includes(search.toUpperCase());
    const matchesDirection = filterDirection === 'ALL' || trade.direction === filterDirection;
    const matchesStatus = filterStatus === 'ALL' || trade.status === filterStatus;
    return matchesSearch && matchesDirection && matchesStatus;
  });

  // 2. Sort
  const sortedTrades = [...filteredTrades].sort((a, b) => {
    let valA: any = a[sortField] !== undefined ? a[sortField] : 0;
    let valB: any = b[sortField] !== undefined ? b[sortField] : 0;
    if (sortField === 'open_time') {
      valA = new Date(a.open_time).getTime();
      valB = new Date(b.open_time).getTime();
    } else {
      valA = Number(valA);
      valB = Number(valB);
    }
    if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
    if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
    return 0;
  });

  if (accountLoading || (loading && activeAccount)) {
    return (
      <div className="flex flex-col gap-6 w-full py-8 text-zinc-400 font-sans">
        <div className="h-8 w-48 animate-pulse bg-zinc-900 rounded" />
        <div className="h-12 w-full animate-pulse bg-zinc-900 rounded-md" />
        <div className="h-96 w-full animate-pulse bg-zinc-900 rounded-xl" />
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
          <p className="text-sm text-zinc-500">Create a Demo, Live, or Prop Firm Challenge account first to view trade history ledger.</p>
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
    <>
      {/* Edit / Close Modal */}
      {editingTrade && (
        <EditTradeModal
          trade={editingTrade}
          onClose={() => setEditingTrade(null)}
          onSave={handleEditSave}
        />
      )}

      <div className="flex flex-col gap-6 w-full font-sans pb-12">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-zinc-900 pb-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-bold tracking-tight text-white">Trade History</h1>
            <p className="text-sm text-zinc-400">Search, filter, and manage your logged trades database.</p>
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

        {/* Filter Toolbar Card */}
        <div className="bg-zinc-900/20 border border-zinc-900/60 p-4 rounded-xl flex flex-col md:flex-row items-center gap-4">
          {/* Search */}
          <div className="relative w-full md:flex-1">
            <Search size={16} className="absolute left-3 top-3 text-zinc-500" />
            <input
              type="text"
              placeholder="Search by pair (e.g. XAUUSD)..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md py-2 pl-9 pr-4 text-xs text-zinc-200 placeholder:text-zinc-700 transition-colors"
            />
          </div>

          {/* Direction Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-xs text-zinc-500 font-semibold uppercase shrink-0">Direction</span>
            <div className="relative w-full md:w-32">
              <select
                value={filterDirection}
                onChange={(e) => setFilterDirection(e.target.value as any)}
                className="w-full appearance-none bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md py-2 pl-3 pr-8 text-xs text-zinc-300 font-medium cursor-pointer transition-colors"
              >
                <option value="ALL">All Setup</option>
                <option value="LONG">LONG Only</option>
                <option value="SHORT">SHORT Only</option>
              </select>
              <ChevronDown size={12} className="absolute right-3 top-3.5 text-zinc-500 pointer-events-none" />
            </div>
          </div>

          {/* Status Filter */}
          <div className="flex items-center gap-2 w-full md:w-auto">
            <span className="text-xs text-zinc-500 font-semibold uppercase shrink-0">Status</span>
            <div className="relative w-full md:w-32">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full appearance-none bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md py-2 pl-3 pr-8 text-xs text-zinc-300 font-medium cursor-pointer transition-colors"
              >
                <option value="ALL">All Status</option>
                <option value="OPEN">OPEN Only</option>
                <option value="CLOSED">CLOSED Only</option>
              </select>
              <ChevronDown size={12} className="absolute right-3 top-3.5 text-zinc-500 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Main Ledger Table Card */}
        <div className="bg-zinc-900/10 border border-zinc-900/60 rounded-xl overflow-hidden">
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-900/30 border-b border-zinc-900 text-zinc-500 text-[10px] font-semibold uppercase tracking-wider">
                  <th className="px-5 py-3.5">Pair</th>
                  <th className="px-5 py-3.5">Direction</th>
                  <th className="px-5 py-3.5 cursor-pointer hover:text-zinc-300 select-none" onClick={() => handleSort('lot_size')}>
                    <div className="flex items-center gap-1.5">
                      <span>Lots</span>
                      <ArrowUpDown size={10} />
                    </div>
                  </th>
                  <th className="px-5 py-3.5 hidden sm:table-cell">Entry Price</th>
                  <th className="px-5 py-3.5 hidden sm:table-cell">Stop Loss</th>
                  <th className="px-5 py-3.5 hidden sm:table-cell">Take Profit</th>
                  <th className="px-5 py-3.5 hidden sm:table-cell">Exit Price</th>
                  <th className="px-5 py-3.5 cursor-pointer hover:text-zinc-300 select-none" onClick={() => handleSort('pnl')}>
                    <div className="flex items-center gap-1.5">
                      <span>Profit / Loss</span>
                      <ArrowUpDown size={10} />
                    </div>
                  </th>
                  <th className="px-5 py-3.5 cursor-pointer hover:text-zinc-300 select-none" onClick={() => handleSort('open_time')}>
                    <div className="flex items-center gap-1.5">
                      <span>Execution Date</span>
                      <ArrowUpDown size={10} />
                    </div>
                  </th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/80 text-sm">
                {sortedTrades.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-5 py-12 text-center text-zinc-600 text-xs">
                      No matching trade records found in this account journal.
                    </td>
                  </tr>
                ) : (
                  sortedTrades.map((trade) => {
                    const isWin = trade.status === 'CLOSED' && (trade.pnl || 0) > 0;
                    const isLoss = trade.status === 'CLOSED' && (trade.pnl || 0) < 0;
                    const isOpenTrade = trade.status === 'OPEN';
                    return (
                      <tr key={trade.id} className="hover:bg-zinc-900/20 transition-colors text-zinc-300">
                        {/* Pair Symbol */}
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <span className="font-bold text-white leading-none">{trade.pair}</span>
                            {trade.setup_tags && trade.setup_tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {trade.setup_tags.map(tag => (
                                  <span key={tag} className="text-[9px] font-semibold bg-zinc-900 border border-zinc-800 text-zinc-500 px-1 py-0.5 rounded">
                                    {tag}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Direction & Grade */}
                        <td className="px-5 py-3.5">
                          <div className="flex flex-col gap-1 items-start">
                            <div className="flex gap-1.5">
                              <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded border ${
                                trade.direction === 'LONG'
                                  ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                  : 'bg-red-500/10 text-red-500 border-red-500/20'
                              }`}>
                                {trade.direction}
                              </span>
                              <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                                trade.setup_grade === 'A+' || trade.setup_grade === 'A'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                  : trade.setup_grade === 'B'
                                  ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20'
                                  : trade.setup_grade === 'C'
                                  ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  : 'bg-red-500/10 text-red-400 border-red-500/20'
                              }`}>
                                {trade.setup_grade}
                              </span>
                            </div>
                            <div className="flex gap-1 items-center mt-1">
                              <span className="text-[9px] font-semibold text-zinc-500 bg-zinc-900 border border-zinc-800 px-1.5 py-0.25 rounded uppercase">
                                {trade.session === 'LONDON_NY' ? 'LDN + NY' : trade.session}
                              </span>
                              <span className="text-[9px] font-semibold text-indigo-400 bg-indigo-500/5 border border-indigo-500/10 px-1.5 py-0.25 rounded">
                                🧠 {trade.pre_trade_state || 'Calm'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Lot Volume */}
                        <td className="px-5 py-3.5 font-medium whitespace-nowrap">
                          {trade.lot_size} Lots
                        </td>

                        {/* Entry Price */}
                        <td className="px-5 py-3.5 font-mono text-zinc-400 hidden sm:table-cell">
                          {Number(trade.entry_price).toFixed(5)}
                        </td>

                        {/* Stop Loss */}
                        <td className="px-5 py-3.5 font-mono text-zinc-500 hidden sm:table-cell">
                          {Number(trade.stop_loss).toFixed(5)}
                        </td>

                        {/* Take Profit */}
                        <td className="px-5 py-3.5 font-mono text-zinc-500 hidden sm:table-cell">
                          {Number(trade.take_profit).toFixed(5)}
                        </td>

                        {/* Exit Price */}
                        <td className="px-5 py-3.5 font-mono text-zinc-400 hidden sm:table-cell">
                          {trade.exit_price ? Number(trade.exit_price).toFixed(5) : (
                            <span className="text-[10px] text-amber-500 font-semibold">Open</span>
                          )}
                        </td>

                        {/* P&L */}
                        <td className="px-5 py-3.5 font-semibold">
                          {isOpenTrade ? (
                            <span className="text-[10px] text-zinc-400 bg-zinc-800 px-1.5 py-0.5 rounded border border-zinc-700 uppercase">
                              OPEN
                            </span>
                          ) : (
                            <span className={isWin ? 'text-emerald-500' : isLoss ? 'text-red-500' : 'text-zinc-400'}>
                              {isWin ? '+' : ''}${Number(trade.pnl || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          )}
                        </td>

                        {/* Execution Date & Time */}
                        <td className="px-5 py-3.5 whitespace-nowrap text-xs text-zinc-500">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5 text-zinc-300 font-medium">
                              <Calendar size={12} className="text-zinc-650 shrink-0" />
                              <span>{new Date(trade.open_time).toLocaleDateString()}</span>
                            </div>
                            <span className="text-[10px] text-zinc-550 ml-5 font-semibold">
                              {new Date(trade.open_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-2">
                            {trade.screenshot_url && (
                              <a
                                href={trade.screenshot_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-zinc-500 hover:text-indigo-400 p-1 rounded hover:bg-zinc-900 transition-colors"
                                title="View Chart Screenshot"
                              >
                                <ExternalLink size={14} />
                              </a>
                            )}

                            {/* Edit / Close button */}
                            <button
                              onClick={() => setEditingTrade(trade)}
                              className={`p-1 rounded hover:bg-zinc-900 transition-colors cursor-pointer ${
                                isOpenTrade ? 'text-amber-500 hover:text-amber-400' : 'text-zinc-500 hover:text-indigo-400'
                              }`}
                              title={isOpenTrade ? 'Close Trade' : 'Edit Trade'}
                            >
                              {isOpenTrade ? <Lock size={14} /> : <Pencil size={14} />}
                            </button>

                            <button
                              onClick={() => handleDelete(trade.id)}
                              className="text-zinc-500 hover:text-red-400 p-1 rounded hover:bg-zinc-900 transition-colors cursor-pointer"
                              title="Delete Entry"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
