-- =========================================================================
-- AI TRADING JOURNAL & PERFORMANCE COACH - DATABASE SCHEMA (PHASE 1)
-- Run this script inside the Supabase SQL Editor to initialize tables.
-- =========================================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE
-- Automatically populated when a user signs up via Supabase Auth
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    email TEXT NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS for profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile." 
    ON public.profiles FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile." 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id);

-- Trigger to automatically create a profile row upon user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        new.id,
        new.email,
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 2. TRADES TABLE
CREATE TABLE IF NOT EXISTS public.trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    pair VARCHAR(30) NOT NULL, -- e.g., EURUSD, BTCUSD, AAPL, Gold (XAUUSD)
    direction VARCHAR(10) CHECK (direction IN ('LONG', 'SHORT')) NOT NULL,
    session VARCHAR(20) CHECK (session IN ('ASIAN', 'LONDON', 'NEW_YORK', 'LONDON_NY')) NOT NULL,
    setup_grade VARCHAR(5) CHECK (setup_grade IN ('A+', 'A', 'B', 'C', 'D')) NOT NULL,
    pre_trade_state VARCHAR(20) CHECK (pre_trade_state IN ('Calm', 'Focused', 'FOMO', 'Angry', 'Tired', 'Greedy')) DEFAULT 'Calm' NOT NULL,
    entry_price NUMERIC(18, 8) NOT NULL,
    exit_price NUMERIC(18, 8),
    stop_loss NUMERIC(18, 8) NOT NULL,
    take_profit NUMERIC(18, 8) NOT NULL,
    lot_size NUMERIC(15, 4) NOT NULL,
    screenshot_url TEXT, -- Saved URL from Supabase Storage bucket
    setup_tags TEXT[] DEFAULT '{}'::text[] NOT NULL,
    notes TEXT,
    pnl NUMERIC(15, 2), -- Computed profit/loss (realized)
    status VARCHAR(10) CHECK (status IN ('OPEN', 'CLOSED')) DEFAULT 'CLOSED' NOT NULL,
    open_time TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    close_time TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Enable RLS for trades
ALTER TABLE public.trades ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can perform CRUD on their own trades."
    ON public.trades FOR ALL
    USING (auth.uid() = user_id);

-- Indexing for high-performance sorting and filtering
CREATE INDEX IF NOT EXISTS idx_trades_user_id ON public.trades(user_id);
CREATE INDEX IF NOT EXISTS idx_trades_pair ON public.trades(pair);
CREATE INDEX IF NOT EXISTS idx_trades_open_time ON public.trades(open_time);


-- 3. DAILY REFLECTIONS TABLE (Psychology Tracking)
CREATE TABLE IF NOT EXISTS public.daily_reflections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    reflection_date DATE DEFAULT CURRENT_DATE NOT NULL,
    followed_plan BOOLEAN DEFAULT TRUE NOT NULL,
    did_revenge_trade BOOLEAN DEFAULT FALSE NOT NULL,
    did_move_stop_loss BOOLEAN DEFAULT FALSE NOT NULL,
    emotional_state VARCHAR(50) NOT NULL, -- e.g. "Calm", "Anxious", "Greedy", "Frustrated", "FOMO"
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    CONSTRAINT unique_user_reflection_date UNIQUE (user_id, reflection_date)
);

-- Enable RLS for daily_reflections
ALTER TABLE public.daily_reflections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own reflections."
    ON public.daily_reflections FOR ALL
    USING (auth.uid() = user_id);

-- Indexing for daily reflections
CREATE INDEX IF NOT EXISTS idx_reflections_user_date ON public.daily_reflections(user_id, reflection_date);


-- =========================================================================
-- 4. STORAGE BUCKET PROVISIONING (FOR CHART SCREENSHOTS)
-- =========================================================================

-- Create storage bucket for trade attachments if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('trade-attachments', 'trade-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for storage bucket
CREATE POLICY "Allow public read access to trade attachments"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'trade-attachments');

CREATE POLICY "Allow authenticated users to upload trade attachments"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'trade-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Allow users to delete their own trade attachments"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'trade-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);


-- =========================================================================
-- 5. ACCOUNTS & PROP FIRM EVALUATIONS (PHASE 1.5)
-- =========================================================================

-- 1. ACCOUNTS TABLE
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name VARCHAR(100) NOT NULL,
    account_type VARCHAR(50) CHECK (account_type IN ('Demo', 'Live', 'Prop Challenge', 'Funded Account')) NOT NULL,
    balance NUMERIC(15, 2) NOT NULL, -- Initial size
    trading_style VARCHAR(50) CHECK (trading_style IN ('Scalping', 'Intraday', 'Swing')) NOT NULL,
    trading_goal VARCHAR(50) CHECK (trading_goal IN ('Pass Challenge', 'Get Funded', 'Preserve Capital', 'Consistency')) NOT NULL,
    is_archived BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- RLS for Accounts
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own accounts."
    ON public.accounts FOR ALL USING (auth.uid() = user_id);

-- 2. PROP FIRM PROFILES TABLE (Extensions for Challenge and Funded accounts)
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- RLS for Prop Firm Profiles
ALTER TABLE public.prop_firm_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own prop firm profiles."
    ON public.prop_firm_profiles FOR ALL USING (
        account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid())
    );

-- 3. ACCOUNT STATISTICS TABLE
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

-- RLS for Account Statistics
ALTER TABLE public.account_statistics ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own account stats."
    ON public.account_statistics FOR SELECT USING (
        account_id IN (SELECT id FROM public.accounts WHERE user_id = auth.uid())
    );

-- 4. UPDATE TRADES TABLE
ALTER TABLE public.trades 
    ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_trades_account_id ON public.trades(account_id);

