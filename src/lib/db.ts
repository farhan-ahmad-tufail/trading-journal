import { createClient } from './supabase/client';
import { Trade, DailyReflection, Account, PropFirmProfile } from '@/types';

export const isMockMode = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
                           process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-supabase-project');

const TRADES_KEY = 'trader_dna_trades';
const REFLECTIONS_KEY = 'trader_dna_reflections';
const ACCOUNTS_KEY = 'trader_dna_accounts';
const PROP_PROFILES_KEY = 'trader_dna_prop_profiles';

// Seed mock data for interactive local trial
export const seedMockData = () => {
  if (typeof window === 'undefined') return;

  // 1. Seed Accounts
  if (!localStorage.getItem(ACCOUNTS_KEY)) {
    const mockAccounts: Account[] = [
      {
        id: 'acc-live',
        user_id: 'demo-user',
        name: 'Personal Live',
        account_type: 'Live',
        balance: 10000,
        trading_style: 'Intraday',
        trading_goal: 'Consistency',
        created_at: new Date().toISOString()
      },
      {
        id: 'acc-challenge',
        user_id: 'demo-user',
        name: 'FundingPips 5K Challenge',
        account_type: 'Prop Challenge',
        balance: 5000,
        trading_style: 'Swing',
        trading_goal: 'Pass Challenge',
        created_at: new Date().toISOString()
      }
    ];
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(mockAccounts));
  }

  // 2. Seed Prop Firm Profiles
  if (!localStorage.getItem(PROP_PROFILES_KEY)) {
    const mockProfiles: PropFirmProfile[] = [
      {
        id: 'profile-challenge',
        account_id: 'acc-challenge',
        firm_name: 'FundingPips',
        challenge_type: '2 Step',
        profit_target_pct: 8,
        phase_1_target_pct: 8,
        phase_2_target_pct: 5,
        daily_drawdown_pct: 5,
        max_drawdown_pct: 10,
        min_trading_days: 3,
        created_at: new Date().toISOString()
      }
    ];
    localStorage.setItem(PROP_PROFILES_KEY, JSON.stringify(mockProfiles));
  }
  
  // 3. Seed Trades
  if (!localStorage.getItem(TRADES_KEY)) {
    const mockTrades: Trade[] = [
      {
        id: '1',
        user_id: 'demo-user',
        account_id: 'acc-challenge',
        pair: 'XAUUSD',
        direction: 'LONG',
        entry_price: 2320.50,
        exit_price: 2345.20,
        stop_loss: 2310.00,
        take_profit: 2350.00,
        lot_size: 2.0,
        notes: 'Followed H4 breakout structure. Calm entry, solid execution.',
        pnl: 4940.00,
        status: 'CLOSED',
        open_time: new Date(Date.now() - 3600000 * 4).toISOString(), // 4 hours ago
        close_time: new Date(Date.now() - 3600000 * 2).toISOString(),
        setup_tags: ['Liquidity Sweep', 'CHOCH', 'FVG'],
        session: 'LONDON',
        setup_grade: 'A+',
        pre_trade_state: 'Focused',
        created_at: new Date().toISOString()
      },
      {
        id: '2',
        user_id: 'demo-user',
        account_id: 'acc-challenge',
        pair: 'EURUSD',
        direction: 'SHORT',
        entry_price: 1.0850,
        exit_price: 1.0895,
        stop_loss: 1.0875,
        take_profit: 1.0800,
        lot_size: 5.0,
        notes: 'FOMO trade, counter-trend. Got angry and moved stop loss. Overleveraged on this size.',
        pnl: -2250.00,
        status: 'CLOSED',
        open_time: new Date(Date.now() - 3600000 * 24).toISOString(), // 1 day ago
        close_time: new Date(Date.now() - 3600000 * 23).toISOString(),
        setup_tags: ['Breakout'],
        session: 'ASIAN',
        setup_grade: 'D',
        pre_trade_state: 'FOMO',
        created_at: new Date().toISOString()
      },
      {
        id: '3',
        user_id: 'demo-user',
        account_id: 'acc-challenge',
        pair: 'GBPUSD',
        direction: 'LONG',
        entry_price: 1.2720,
        exit_price: 1.2780,
        stop_loss: 1.2680,
        take_profit: 1.2820,
        lot_size: 3.0,
        notes: 'Rebound off daily support zone. Took profits early because market slowed down.',
        pnl: 1800.00,
        status: 'CLOSED',
        open_time: new Date(Date.now() - 3600000 * 48).toISOString(), // 2 days ago
        close_time: new Date(Date.now() - 3600000 * 46).toISOString(),
        setup_tags: ['Support Resistance', 'Pullback'],
        session: 'LONDON_NY',
        setup_grade: 'A',
        pre_trade_state: 'Calm',
        created_at: new Date().toISOString()
      },
      {
        id: '4',
        user_id: 'demo-user',
        account_id: 'acc-challenge',
        pair: 'BTCUSD',
        direction: 'SHORT',
        entry_price: 68500.00,
        exit_price: 67200.00,
        stop_loss: 69200.00,
        take_profit: 66000.00,
        lot_size: 0.5,
        notes: 'Resistance rejection structure. Clean hold.',
        pnl: 650.00,
        status: 'CLOSED',
        open_time: new Date(Date.now() - 3600000 * 72).toISOString(), // 3 days ago
        close_time: new Date(Date.now() - 3600000 * 70).toISOString(),
        setup_tags: ['Support Resistance', 'Trendline'],
        session: 'NEW_YORK',
        setup_grade: 'A',
        pre_trade_state: 'Focused',
        created_at: new Date().toISOString()
      },
      {
        id: '5',
        user_id: 'demo-user',
        account_id: 'acc-challenge',
        pair: 'XAUUSD',
        direction: 'LONG',
        entry_price: 2315.00,
        exit_price: 2305.00,
        stop_loss: 2308.00,
        take_profit: 2335.00,
        lot_size: 1.5,
        notes: 'Moved stop loss lower to give it room. Violated risk plan. Ended up losing more.',
        pnl: -1500.00,
        status: 'CLOSED',
        open_time: new Date(Date.now() - 3600000 * 96).toISOString(), // 4 days ago
        close_time: new Date(Date.now() - 3600000 * 95).toISOString(),
        setup_tags: ['Liquidity Sweep'],
        session: 'NEW_YORK',
        setup_grade: 'B',
        pre_trade_state: 'Tired',
        created_at: new Date().toISOString()
      }
    ];
    localStorage.setItem(TRADES_KEY, JSON.stringify(mockTrades));
  }

  // 4. Seed Reflections
  if (!localStorage.getItem(REFLECTIONS_KEY)) {
    const mockReflections: DailyReflection[] = [
      {
        id: '1',
        user_id: 'demo-user',
        account_id: 'acc-challenge',
        reflection_date: new Date().toISOString().split('T')[0],
        followed_plan: false,
        did_revenge_trade: true,
        did_move_stop_loss: true,
        emotional_state: 'Frustrated',
        notes: 'Struggled to stay calm after the EURUSD loss. Need to walk away from the screens.',
        created_at: new Date().toISOString()
      }
    ];
    localStorage.setItem(REFLECTIONS_KEY, JSON.stringify(mockReflections));
  }
};

// ==========================================
// 1. ACCOUNT PROFILE CRUD FUNCTIONS
// ==========================================

export async function fetchAccounts(): Promise<Account[]> {
  if (isMockMode) {
    seedMockData();
    const data = localStorage.getItem(ACCOUNTS_KEY);
    return data ? JSON.parse(data) : [];
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function archiveAccount(id: string, archive: boolean): Promise<void> {
  if (isMockMode) {
    const data = localStorage.getItem(ACCOUNTS_KEY);
    if (data) {
      const accounts: Account[] = JSON.parse(data);
      const updated = accounts.map(a => a.id === id ? { ...a, is_archived: archive } : a);
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(updated));
    }
    return;
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('accounts')
    .update({ is_archived: archive })
    .eq('id', id);

  if (error) throw error;
}

export async function saveAccount(
  account: Omit<Account, 'id' | 'user_id' | 'created_at' | 'is_archived'>,
  propFirmDetails?: Omit<PropFirmProfile, 'id' | 'account_id' | 'created_at'>
): Promise<Account> {
  const accountId = isMockMode ? 'acc-' + Math.random().toString(36).substring(2, 9) : '';
  const newAccount: Account = {
    ...account,
    id: accountId,
    user_id: isMockMode ? 'demo-user' : '',
    is_archived: false,
    created_at: new Date().toISOString()
  };

  if (isMockMode) {
    // Save account
    const accountsData = localStorage.getItem(ACCOUNTS_KEY);
    const accounts: Account[] = accountsData ? JSON.parse(accountsData) : [];
    accounts.push(newAccount);
    localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts));

    // Save prop firm details if applicable
    if (propFirmDetails && (account.account_type === 'Prop Challenge' || account.account_type === 'Funded Account')) {
      const propProfilesData = localStorage.getItem(PROP_PROFILES_KEY);
      const profiles: PropFirmProfile[] = propProfilesData ? JSON.parse(propProfilesData) : [];
      const newProfile: PropFirmProfile = {
        ...propFirmDetails,
        id: 'profile-' + Math.random().toString(36).substring(2, 9),
        account_id: accountId,
        created_at: new Date().toISOString()
      };
      profiles.push(newProfile);
      localStorage.setItem(PROP_PROFILES_KEY, JSON.stringify(profiles));
    }

    return newAccount;
  }

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) throw new Error('Unauthenticated');

  // Insert Account
  const { data: dbAccount, error: accError } = await supabase
    .from('accounts')
    .insert([{ ...account, user_id: userData.user.id }])
    .select()
    .single();

  if (accError) throw accError;

  // Insert Prop Profile if applicable
  if (propFirmDetails && (account.account_type === 'Prop Challenge' || account.account_type === 'Funded Account')) {
    const { error: propError } = await supabase
      .from('prop_firm_profiles')
      .insert([{ ...propFirmDetails, account_id: dbAccount.id }]);

    if (propError) throw propError;
  }

  return dbAccount;
}

export async function fetchPropFirmProfile(accountId: string): Promise<PropFirmProfile | null> {
  if (isMockMode) {
    seedMockData();
    const data = localStorage.getItem(PROP_PROFILES_KEY);
    if (!data) return null;
    const profiles: PropFirmProfile[] = JSON.parse(data);
    return profiles.find(p => p.account_id === accountId) || null;
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('prop_firm_profiles')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// ==========================================
// 2. TRADES CRUD FUNCTIONS
// ==========================================

export async function fetchTrades(accountId?: string): Promise<Trade[]> {
  if (isMockMode) {
    seedMockData();
    const data = localStorage.getItem(TRADES_KEY);
    const allTrades: Trade[] = data ? JSON.parse(data) : [];
    if (accountId) {
      return allTrades.filter(t => t.account_id === accountId);
    }
    return allTrades;
  }

  const supabase = createClient();
  let query = supabase
    .from('trades')
    .select('*');

  if (accountId) {
    query = query.eq('account_id', accountId);
  }

  const { data, error } = await query.order('open_time', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function saveTrade(
  trade: Omit<Trade, 'id' | 'user_id' | 'created_at'> & { account_id?: string }
): Promise<Trade> {
  const newTrade: Trade = {
    ...trade,
    id: isMockMode ? Math.random().toString(36).substring(2, 9) : '',
    user_id: isMockMode ? 'demo-user' : '',
    created_at: new Date().toISOString()
  };

  if (isMockMode) {
    const data = localStorage.getItem(TRADES_KEY);
    const trades: Trade[] = data ? JSON.parse(data) : [];
    trades.unshift(newTrade);
    localStorage.setItem(TRADES_KEY, JSON.stringify(trades));
    return newTrade;
  }

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) throw new Error('Unauthenticated');

  const { data, error } = await supabase
    .from('trades')
    .insert([{ ...trade, user_id: userData.user.id }])
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteTrade(id: string): Promise<void> {
  if (isMockMode) {
    const data = localStorage.getItem(TRADES_KEY);
    if (data) {
      const trades: Trade[] = JSON.parse(data);
      const filtered = trades.filter(t => t.id !== id);
      localStorage.setItem(TRADES_KEY, JSON.stringify(filtered));
    }
    return;
  }

  const supabase = createClient();
  const { error } = await supabase
    .from('trades')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

export async function updateTrade(
  id: string,
  updates: Partial<Omit<Trade, 'id' | 'user_id' | 'created_at'>>
): Promise<Trade> {
  if (isMockMode) {
    const data = localStorage.getItem(TRADES_KEY);
    if (!data) throw new Error('No trades found.');
    const trades: Trade[] = JSON.parse(data);
    const idx = trades.findIndex(t => t.id === id);
    if (idx === -1) throw new Error('Trade not found.');
    trades[idx] = { ...trades[idx], ...updates };
    localStorage.setItem(TRADES_KEY, JSON.stringify(trades));
    return trades[idx];
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from('trades')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ==========================================
// 3. REFLECTIONS CRUD FUNCTIONS
// ==========================================

export async function fetchReflections(accountId?: string): Promise<DailyReflection[]> {
  if (isMockMode) {
    seedMockData();
    const data = localStorage.getItem(REFLECTIONS_KEY);
    const allRefs: DailyReflection[] = data ? JSON.parse(data) : [];
    if (accountId) {
      return allRefs.filter(r => r.account_id === accountId);
    }
    return allRefs;
  }

  const supabase = createClient();
  let query = supabase
    .from('daily_reflections')
    .select('*');

  if (accountId) {
    query = query.eq('account_id', accountId);
  }

  const { data, error } = await query.order('reflection_date', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function saveReflection(
  reflection: Omit<DailyReflection, 'id' | 'user_id' | 'created_at'> & { account_id?: string }
): Promise<DailyReflection> {
  const newRef: DailyReflection = {
    ...reflection,
    id: isMockMode ? Math.random().toString(36).substring(2, 9) : '',
    user_id: isMockMode ? 'demo-user' : '',
    created_at: new Date().toISOString()
  };

  if (isMockMode) {
    const data = localStorage.getItem(REFLECTIONS_KEY);
    const reflections: DailyReflection[] = data ? JSON.parse(data) : [];
    
    // Check if reflection for this date and account already exists and overwrite it
    const existingIndex = reflections.findIndex(r => 
      r.reflection_date === reflection.reflection_date && 
      (!reflection.account_id || r.account_id === reflection.account_id)
    );
    
    if (existingIndex > -1) {
      reflections[existingIndex] = { ...reflections[existingIndex], ...reflection };
    } else {
      reflections.unshift(newRef);
    }
    
    localStorage.setItem(REFLECTIONS_KEY, JSON.stringify(reflections));
    return newRef;
  }

  const supabase = createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user) throw new Error('Unauthenticated');

  const { data, error } = await supabase
    .from('daily_reflections')
    .upsert({ 
      ...reflection, 
      user_id: userData.user.id 
    }, { 
      onConflict: 'user_id,reflection_date' 
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export function calculateReflectionStreak(reflections: DailyReflection[]): number {
  if (reflections.length === 0) return 0;
  
  // Sort unique reflection dates in descending order
  const sortedDates = [...reflections]
    .map(r => r.reflection_date)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
    
  const uniqueDates = Array.from(new Set(sortedDates));
  
  let streak = 0;
  const now = new Date();
  
  // Convert local dates to match 'YYYY-MM-DD' comparison
  const formatDateStr = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const todayStr = formatDateStr(now);
  
  // Yesterday representation
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = formatDateStr(yesterday);
  
  let checkIndex = 0;
  
  if (uniqueDates[0] === todayStr) {
    streak++;
    checkIndex = 1;
  } else if (uniqueDates[0] === yesterdayStr) {
    streak++;
    checkIndex = 1;
  } else {
    return 0; // Streak broken (last logged date is neither today nor yesterday)
  }
  
  // Traverse backwards
  for (let i = checkIndex; i < uniqueDates.length; i++) {
    const expected = new Date(now);
    expected.setDate(now.getDate() - (uniqueDates[0] === todayStr ? streak : streak + 1));
    const expectedStr = formatDateStr(expected);
    
    if (uniqueDates[i] === expectedStr) {
      streak++;
    } else {
      break; // Gap detected
    }
  }
  
  return streak;
}

