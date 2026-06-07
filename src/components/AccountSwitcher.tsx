'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useAccount } from '@/components/AccountProvider';
import { ChevronDown, Plus, CreditCard, Award, User, Layers } from 'lucide-react';
import Link from 'next/link';

export default function AccountSwitcher() {
  const { accounts, activeAccount, setActiveAccount } = useAccount();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!activeAccount) return null;

  const getAccountBadgeClass = (type: string) => {
    switch (type) {
      case 'Live':
        return 'bg-emerald-500/10 text-emerald-450 border border-emerald-500/15';
      case 'Prop Challenge':
        return 'bg-amber-500/10 text-amber-500 border border-amber-500/15';
      case 'Funded Account':
        return 'bg-indigo-600/10 text-indigo-400 border border-indigo-500/15';
      default:
        return 'bg-zinc-800 text-zinc-400 border border-zinc-700';
    }
  };

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'Live': return <CreditCard size={13} className="text-emerald-450" />;
      case 'Prop Challenge': return <Award size={13} className="text-amber-500" />;
      case 'Funded Account': return <Award size={13} className="text-indigo-400" />;
      default: return <Layers size={13} className="text-zinc-500" />;
    }
  };

  return (
    <div className="relative font-sans text-xs" ref={dropdownRef}>
      {/* Switcher Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-zinc-900/40 hover:bg-zinc-900/80 border border-zinc-900/60 hover:border-zinc-800/80 px-3 py-2.5 rounded-lg flex items-center justify-between text-left transition-all cursor-pointer shadow-sm"
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-5 w-5 rounded bg-zinc-850 flex items-center justify-center shrink-0 border border-zinc-800">
            {getAccountIcon(activeAccount.account_type)}
          </div>
          <div className="flex flex-col min-w-0 leading-tight">
            <span className="font-bold text-zinc-200 truncate">{activeAccount.name}</span>
            <span className="text-[9px] text-zinc-500 uppercase tracking-wide font-semibold mt-0.5">
              {activeAccount.account_type === 'Prop Challenge' ? 'Challenge' : activeAccount.account_type}
            </span>
          </div>
        </div>
        <ChevronDown size={14} className="text-zinc-500 shrink-0 ml-2" />
      </button>

      {/* Dropdown Menu Popup */}
      {isOpen && (
        <div className="absolute left-0 right-0 mt-1.5 bg-zinc-950 border border-zinc-900 rounded-lg shadow-xl z-50 overflow-hidden py-1 animate-in fade-in slide-in-from-top-1 duration-100">
          <div className="px-2.5 py-1.5 text-[9px] font-black uppercase tracking-wider text-zinc-600 border-b border-zinc-900 mb-1">
            Accounts Switcher
          </div>
          
          <div className="max-h-48 overflow-y-auto flex flex-col gap-0.5 px-1">
            {accounts
              .filter((acc) => !acc.is_archived)
              .map((acc) => {
                const isSelected = acc.id === activeAccount.id;
                return (
                  <button
                    key={acc.id}
                    onClick={() => {
                      setActiveAccount(acc);
                      setIsOpen(false);
                    }}
                    className={`w-full text-left px-2.5 py-2 rounded flex items-center justify-between transition-colors cursor-pointer ${
                      isSelected 
                        ? 'bg-indigo-600/10 text-indigo-400 font-bold border border-indigo-500/10' 
                        : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {getAccountIcon(acc.account_type)}
                      <span className="truncate">{acc.name}</span>
                    </div>
                    <span className={`text-[8px] font-bold px-1 py-0.25 rounded shrink-0 uppercase tracking-wide ${getAccountBadgeClass(acc.account_type)}`}>
                      {acc.account_type === 'Prop Challenge' ? 'Challenge' : acc.account_type === 'Funded Account' ? 'Funded' : acc.account_type}
                    </span>
                  </button>
                );
              })}
          </div>

          <div className="border-t border-zinc-900 mt-1 pt-1 px-1">
            <Link
              href="/accounts"
              onClick={() => setIsOpen(false)}
              className="w-full text-left px-2.5 py-2 rounded flex items-center gap-2 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900/50 transition-colors"
            >
              <Plus size={12} />
              <span>Manage Accounts</span>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
