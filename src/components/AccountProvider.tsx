'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { fetchAccounts, fetchPropFirmProfile, fetchReflections, calculateReflectionStreak } from '@/lib/db';
import { Account, PropFirmProfile } from '@/types';

interface AccountContextType {
  accounts: Account[];
  activeAccount: Account | null;
  activeProfile: PropFirmProfile | null;
  loading: boolean;
  streak: number;
  setActiveAccount: (account: Account) => void;
  refreshAccounts: () => Promise<void>;
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

export function AccountProvider({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activeAccount, setActiveAccountState] = useState<Account | null>(null);
  const [activeProfile, setActiveProfile] = useState<PropFirmProfile | null>(null);
  const [streak, setStreak] = useState(0);
  const [loading, setLoading] = useState(true);

  const refreshAccounts = async () => {
    try {
      const data = await fetchAccounts();
      setAccounts(data);

      if (data.length > 0) {
        // Resolve active account ID
        const savedId = typeof window !== 'undefined' ? localStorage.getItem('trader_dna_active_account_id') : null;
        
        // Filter out archived accounts for active selection candidate
        const activeCandidates = data.filter(a => !a.is_archived);
        const matched = activeCandidates.find(a => a.id === savedId) || 
                        activeCandidates[0] || 
                        data.find(a => a.id === savedId) || 
                        data[0];
        
        setActiveAccountState(matched);
        if (matched && typeof window !== 'undefined') {
          localStorage.setItem('trader_dna_active_account_id', matched.id);
        }
      } else {
        setActiveAccountState(null);
        setActiveProfile(null);
      }
    } catch (err) {
      console.error('Failed to load accounts in provider', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshAccounts();
  }, []);

  // Fetch active account's prop firm profile when it changes
  useEffect(() => {
    async function loadPropProfile() {
      if (activeAccount && (activeAccount.account_type === 'Prop Challenge' || activeAccount.account_type === 'Funded Account')) {
        try {
          const profile = await fetchPropFirmProfile(activeAccount.id);
          setActiveProfile(profile);
        } catch (err) {
          console.error('Failed to load prop profile for active account', err);
          setActiveProfile(null);
        }
      } else {
        setActiveProfile(null);
      }
    }
    loadPropProfile();
  }, [activeAccount]);

  // Fetch active account's reflections and calculate streak when it changes
  useEffect(() => {
    async function loadStreak() {
      if (activeAccount) {
        try {
          const reflections = await fetchReflections(activeAccount.id);
          const currentStreak = calculateReflectionStreak(reflections);
          setStreak(currentStreak);
        } catch (err) {
          console.error('Failed to load streak for active account', err);
          setStreak(0);
        }
      } else {
        setStreak(0);
      }
    }
    loadStreak();
  }, [activeAccount]);

  const setActiveAccount = (account: Account) => {
    setActiveAccountState(account);
    if (typeof window !== 'undefined') {
      localStorage.setItem('trader_dna_active_account_id', account.id);
    }
  };

  return (
    <AccountContext.Provider value={{
      accounts,
      activeAccount,
      activeProfile,
      loading,
      streak,
      setActiveAccount,
      refreshAccounts
    }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (context === undefined) {
    throw new Error('useAccount must be used within an AccountProvider');
  }
  return context;
}
