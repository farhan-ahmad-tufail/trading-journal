export type TradeDirection = 'LONG' | 'SHORT';
export type TradeStatus = 'OPEN' | 'CLOSED';
export type TradingSession = 'ASIAN' | 'LONDON' | 'NEW_YORK' | 'LONDON_NY';
export type SetupGrade = 'A+' | 'A' | 'B' | 'C' | 'D';

export type PreTradeState = 'Calm' | 'Focused' | 'FOMO' | 'Angry' | 'Tired' | 'Greedy';

export type AccountType = 'Demo' | 'Live' | 'Prop Challenge' | 'Funded Account';
export type TradingStyle = 'Scalping' | 'Intraday' | 'Swing';
export type TradingGoal = 'Pass Challenge' | 'Get Funded' | 'Preserve Capital' | 'Consistency';
export type PropFirmName = 'FundingPips' | 'FTMO' | 'The5ers' | 'MyFundedFX' | 'FundedNext' | 'Other';
export type PropChallengeType = '1 Step' | '2 Step' | 'Instant Funding';

export interface Account {
  id: string;
  user_id: string;
  name: string;
  account_type: AccountType;
  balance: number;
  trading_style: TradingStyle;
  trading_goal: TradingGoal;
  is_archived?: boolean;
  created_at: string;
}

export interface PropFirmProfile {
  id: string;
  account_id: string;
  firm_name: PropFirmName;
  challenge_type: PropChallengeType;
  profit_target_pct?: number;
  phase_1_target_pct?: number;
  phase_2_target_pct?: number;
  daily_drawdown_pct?: number;
  max_drawdown_pct?: number;
  min_trading_days?: number;
  daily_reset_timezone?: 'UTC' | 'EST' | 'Local';
  created_at: string;
}

export interface AccountStatistics {
  id: string;
  account_id: string;
  total_trades: number;
  win_rate: number;
  net_profit: number;
  avg_rr: number;
  current_drawdown: number;
  days_traded: number;
  last_updated: string;
}

export interface Trade {
  id: string;
  user_id: string;
  account_id?: string; // Segregate by account
  pair: string;
  direction: TradeDirection;
  session: TradingSession;
  setup_grade: SetupGrade;
  pre_trade_state: PreTradeState;
  entry_price: number;
  exit_price?: number;
  stop_loss: number;
  take_profit: number;
  lot_size: number;
  screenshot_url?: string;
  setup_tags: string[];
  notes?: string;
  pnl?: number;
  status: TradeStatus;
  open_time: string;
  close_time?: string;
  created_at: string;
  import_source?: 'MANUAL' | 'MT5_CSV' | 'MT5_HTML';
  external_ticket?: string;
  commission?: number;
  swap?: number;
  duration_seconds?: number;
}

export interface DailyReflection {
  id: string;
  user_id: string;
  account_id?: string; // Optional: segregate reflections by account
  reflection_date: string;
  followed_plan: boolean;
  did_revenge_trade: boolean;
  did_move_stop_loss: boolean;
  emotional_state: string; // e.g., 'Calm', 'FOMO', 'Anxious', 'Angry', 'Greedy', 'Bored'
  notes?: string;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  stripe_customer_id?: string;
  subscription_id?: string;
  subscription_status?: string; // 'free', 'trialing', 'active', 'canceled'
  price_id?: string;
  current_period_end?: string;
}

