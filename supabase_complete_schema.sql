-- =========================================================================
-- AI TRADING JOURNAL & PERFORMANCE COACH - COMPLETE DATABASE SCHEMA
-- For Firebase Auth & PostgreSQL (Supabase) Integration
-- Run this script in a clean Supabase SQL Editor window to initialize all tables.
-- =========================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. PROFILES TABLE
-- String Firebase UIDs (VARCHAR) are used instead of UUIDs.
CREATE TABLE IF NOT EXISTS public.profiles (
    id VARCHAR(255) PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    stripe_customer_id TEXT,
    subscription_id TEXT,
    subscription_status TEXT DEFAULT 'free', -- 'free', 'trialing', 'active', 'canceled'
    price_id TEXT,
    current_period_end TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public select for matching user queries" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Allow public insert/update via admin bypass" ON public.profiles FOR ALL USING (true);

-- Indexing for SaaS billing
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON public.profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON public.profiles(subscription_status);


-- 2. ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL,
    account_type VARCHAR(50) CHECK (account_type IN ('Demo', 'Live', 'Prop Challenge', 'Funded Account')) NOT NULL,
    balance NUMERIC(15, 2) NOT NULL,
    trading_style VARCHAR(50) CHECK (trading_style IN ('Scalping', 'Intraday', 'Swing')) NOT NULL,
    trading_goal VARCHAR(50) CHECK (trading_goal IN ('Pass Challenge', 'Get Funded', 'Preserve Capital', 'Consistency')) NOT NULL,
    is_archived BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Accounts RLS Policy" ON public.accounts FOR ALL USING (true);


-- 3. PROP FIRM PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.prop_firm_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE UNIQUE NOT NULL,
    firm_name VARCHAR(50) CHECK (firm_name IN ('FundingPips', 'FTMO', 'The5ers', 'MyFundedFX', 'FundedNext', 'Other')) NOT NULL,
    challenge_type VARCHAR(50) CHECK (challenge_type IN ('1 Step', '2 Step', 'Instant Funding')) NOT NULL,
    profit_target_pct NUMERIC(5, 2),
    phase_1_target_pct NUMERIC(5, 2),
    phase_2_target_pct NUMERIC(5, 2),
    daily_drawdown_pct NUMERIC(5, 2),
    max_drawdown_pct NUMERIC(5, 2),
    min_trading_days INTEGER DEFAULT 0,
    daily_reset_timezone VARCHAR(20) DEFAULT 'Local',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.prop_firm_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Prop Firm Profiles RLS Policy" ON public.prop_firm_profiles FOR ALL USING (true);


-- 4. ACCOUNT STATISTICS TABLE
CREATE TABLE IF NOT EXISTS public.account_statistics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE UNIQUE NOT NULL,
    total_trades INTEGER DEFAULT 0,
    win_rate NUMERIC(5, 2) DEFAULT 0.0,
    net_profit NUMERIC(15, 2) DEFAULT 0.0,
    avg_rr NUMERIC(5, 2) DEFAULT 0.0,
    current_drawdown NUMERIC(15, 2) DEFAULT 0.0,
    days_traded INTEGER DEFAULT 0,
    last_updated TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.account_statistics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Account Stats RLS Policy" ON public.account_statistics FOR ALL USING (true);


-- 5. TRADES TABLE
CREATE TABLE IF NOT EXISTS public.trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    pair VARCHAR(30) NOT NULL,
    direction VARCHAR(10) CHECK (direction IN ('LONG', 'SHORT')) NOT NULL,
    session VARCHAR(20) CHECK (session IN ('ASIAN', 'LONDON', 'NEW_YORK', 'LONDON_NY')) NOT NULL,
    setup_grade VARCHAR(5) CHECK (setup_grade IN ('A+', 'A', 'B', 'C', 'D')) NOT NULL,
    pre_trade_state VARCHAR(20) CHECK (pre_trade_state IN ('Calm', 'Focused', 'FOMO', 'Angry', 'Tired', 'Greedy')) DEFAULT 'Calm' NOT NULL,
    entry_price NUMERIC(18, 8) NOT NULL,
    exit_price NUMERIC(18, 8),
    stop_loss NUMERIC(18, 8) NOT NULL,
    take_profit NUMERIC(18, 8) NOT NULL,
    lot_size NUMERIC(15, 4) NOT NULL,
    screenshot_url TEXT,
    setup_tags TEXT[] DEFAULT '{}'::text[] NOT NULL,
    notes TEXT,
    pnl NUMERIC(15, 2),
    status VARCHAR(10) CHECK (status IN ('OPEN', 'CLOSED')) DEFAULT 'CLOSED' NOT NULL,
    open_time TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    close_time TIMESTAMP WITH TIME ZONE,
    import_source VARCHAR(50) DEFAULT 'MANUAL',
    external_ticket VARCHAR(100),
    commission NUMERIC(15, 2) DEFAULT 0.0,
    swap NUMERIC(15, 2) DEFAULT 0.0,
    duration_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trades RLS Policy" ON public.trades FOR ALL USING (true);

-- Indexing for trades
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON public.trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_account_id ON public.trades(account_id);
CREATE INDEX IF NOT EXISTS idx_trades_pair ON public.trades(pair);
CREATE INDEX IF NOT EXISTS idx_trades_open_time ON public.trades(open_time);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_account_ticket ON public.trades(account_id, external_ticket) 
    WHERE external_ticket IS NOT NULL;


-- 6. DAILY REFLECTIONS TABLE (Psychology Tracking)
CREATE TABLE IF NOT EXISTS public.daily_reflections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    reflection_date DATE DEFAULT CURRENT_DATE NOT NULL,
    followed_plan BOOLEAN DEFAULT TRUE NOT NULL,
    did_revenge_trade BOOLEAN DEFAULT FALSE NOT NULL,
    did_move_stop_loss BOOLEAN DEFAULT FALSE NOT NULL,
    emotional_state VARCHAR(50) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_user_reflection_date UNIQUE (user_id, reflection_date)
);

ALTER TABLE public.daily_reflections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Daily Reflections RLS Policy" ON public.daily_reflections FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_reflections_user_date ON public.daily_reflections(user_id, reflection_date);


-- 7. RAG EMBEDDINGS (AI Coach Semantic Memory)
CREATE TABLE IF NOT EXISTS public.trade_note_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trade_id UUID REFERENCES public.trades(id) ON DELETE CASCADE UNIQUE NOT NULL,
    user_id VARCHAR(255) REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    notes_summary TEXT NOT NULL,
    embedding vector(1536), -- 1536-dimensional vector for OpenAI/Gemini text-embedding
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE public.trade_note_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Trade Note Embeddings RLS Policy" ON public.trade_note_embeddings FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_trade_note_embeddings_vector 
ON public.trade_note_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);


-- 8. BLOW-UP RISK PREDICTIONS
CREATE TABLE IF NOT EXISTS public.blowup_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
    failure_probability INTEGER CHECK (failure_probability BETWEEN 0 AND 100) NOT NULL,
    risk_level VARCHAR(10) CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')) NOT NULL,
    reasons TEXT[] DEFAULT '{}'::text[] NOT NULL,
    suggested_actions TEXT[] DEFAULT '{}'::text[] NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.blowup_predictions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Blowup Predictions RLS Policy" ON public.blowup_predictions FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_blowup_user_acc ON public.blowup_predictions(user_id, account_id);


-- 9. COACHING REPORTS TABLE
CREATE TABLE IF NOT EXISTS public.coaching_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id VARCHAR(255) REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
    report_type VARCHAR(20) CHECK (report_type IN ('DAILY', 'WEEKLY', 'MONTHLY')) DEFAULT 'DAILY' NOT NULL,
    risk_data JSONB NOT NULL,
    psychology_data JSONB NOT NULL,
    strategy_data JSONB NOT NULL,
    performance_data JSONB NOT NULL,
    prop_firm_data JSONB NOT NULL,
    blowup_prediction JSONB NOT NULL,
    executive_summary TEXT NOT NULL,
    action_plan TEXT[] DEFAULT '{}'::text[] NOT NULL,
    full_report_markdown TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

ALTER TABLE public.coaching_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Coaching Reports RLS Policy" ON public.coaching_reports FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_coaching_reports_acc 
ON public.coaching_reports(user_id, account_id, created_at DESC);


-- =========================================================================
-- 10. STORAGE BUCKET PROVISIONING (FOR CHART SCREENSHOTS)
-- =========================================================================

INSERT INTO storage.buckets (id, name, public) 
VALUES ('trade-attachments', 'trade-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies
CREATE POLICY "Allow public read access to trade attachments"
    ON storage.objects FOR SELECT USING (bucket_id = 'trade-attachments');

CREATE POLICY "Allow administrative uploads to trade attachments"
    ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'trade-attachments');

CREATE POLICY "Allow administrative deletions to trade attachments"
    ON storage.objects FOR DELETE USING (bucket_id = 'trade-attachments');


-- =========================================================================
-- 11. VECTOR SIMILARITY QUERY FUNCTION
-- =========================================================================

CREATE OR REPLACE FUNCTION public.match_trade_notes (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_user_id VARCHAR(255)
)
RETURNS TABLE (
  id uuid,
  trade_id uuid,
  notes_summary text,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    tne.id,
    tne.trade_id,
    tne.notes_summary,
    1 - (tne.embedding <=> query_embedding) AS similarity
  FROM public.trade_note_embeddings tne
  WHERE tne.user_id = p_user_id
    AND 1 - (tne.embedding <=> query_embedding) > match_threshold
  ORDER BY tne.embedding <=> query_embedding ASC
  LIMIT match_count;
END;
$$;
