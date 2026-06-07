-- =========================================================================
-- AI TRADING JOURNAL & PERFORMANCE COACH - DATABASE MIGRATION (PHASE 2)
-- Run this script inside your Supabase SQL Editor to apply Phase 2 updates.
-- =========================================================================

-- Enable Vector support for RAG Memory
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. SAAS BILLING & SUBSCRIPTIONS
CREATE TYPE public.subscription_tier AS ENUM ('FREE', 'PRO', 'PROP_TEAM');
CREATE TYPE public.subscription_status AS ENUM ('ACTIVE', 'PAST_DUE', 'CANCELED', 'TRIALING');

CREATE TABLE IF NOT EXISTS public.subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
    stripe_customer_id TEXT UNIQUE,
    stripe_subscription_id TEXT UNIQUE,
    tier public.subscription_tier DEFAULT 'FREE'::public.subscription_tier NOT NULL,
    status public.subscription_status DEFAULT 'ACTIVE'::public.subscription_status NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. TEAM ACCOUNTS (For Prop Firm Desks)
CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.team_members (
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    role VARCHAR(20) CHECK (role IN ('ADMIN', 'TRADER')) DEFAULT 'TRADER',
    PRIMARY KEY (team_id, user_id)
);

-- 3. REFERRAL & AFFILIATE SYSTEM
CREATE TABLE IF NOT EXISTS public.referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    referred_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE UNIQUE NOT NULL,
    referral_code VARCHAR(20) NOT NULL,
    status VARCHAR(20) CHECK (status IN ('PENDING', 'CONVERTED', 'PAID')) DEFAULT 'PENDING',
    commission_earned NUMERIC(10,2) DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 4. RAG EMBEDDINGS (AI Coach Semantic Memory)
CREATE TABLE IF NOT EXISTS public.trade_note_embeddings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    trade_id UUID REFERENCES public.trades(id) ON DELETE CASCADE UNIQUE NOT NULL,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    notes_summary TEXT NOT NULL,
    embedding vector(1536), -- 1536-dimensional vector for OpenAI text-embedding-3-small
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 5. BLOW-UP RISK PREDICTIONS
CREATE TABLE IF NOT EXISTS public.blowup_predictions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
    failure_probability INTEGER CHECK (failure_probability BETWEEN 0 AND 100) NOT NULL,
    risk_level VARCHAR(10) CHECK (risk_level IN ('LOW', 'MEDIUM', 'HIGH')) NOT NULL,
    reasons TEXT[] DEFAULT '{}'::text[] NOT NULL,
    suggested_actions TEXT[] DEFAULT '{}'::text[] NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 6. MIGRATION EXTENSION ON TRADES (To track imports and avoid duplicates)
ALTER TABLE public.trades 
    ADD COLUMN IF NOT EXISTS import_source VARCHAR(50) DEFAULT 'MANUAL', -- 'MANUAL', 'MT5_CSV', 'MT5_HTML'
    ADD COLUMN IF NOT EXISTS external_ticket VARCHAR(100), -- MT5 ticket ID
    ADD COLUMN IF NOT EXISTS commission NUMERIC(15, 2) DEFAULT 0.0,
    ADD COLUMN IF NOT EXISTS swap NUMERIC(15, 2) DEFAULT 0.0,
    ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

-- Create unique index to prevent duplicate imports of the same trade tickets
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_account_ticket ON public.trades(account_id, external_ticket) 
    WHERE external_ticket IS NOT NULL;

-- Enable RLS for newly added tables
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trade_note_embeddings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blowup_predictions ENABLE ROW LEVEL SECURITY;

-- Setup Row-Level Security (RLS) policies
CREATE POLICY "Users can manage their own subscription." ON public.subscriptions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Team owners can manage team." ON public.teams FOR ALL USING (owner_id = auth.uid());
CREATE POLICY "Members can view team details." ON public.team_members FOR SELECT USING (user_id = auth.uid() OR team_id IN (SELECT id FROM public.teams WHERE owner_id = auth.uid()));
CREATE POLICY "Users can view referrals they sent." ON public.referrals FOR ALL USING (auth.uid() = referrer_id);
CREATE POLICY "Users can manage their own trade note embeddings." ON public.trade_note_embeddings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can manage their own blowup predictions." ON public.blowup_predictions FOR ALL USING (auth.uid() = user_id);

-- Create performance search index for vector similarity search
CREATE INDEX IF NOT EXISTS idx_trade_note_embeddings_vector 
ON public.trade_note_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

CREATE INDEX IF NOT EXISTS idx_blowup_user_acc ON public.blowup_predictions(user_id, account_id);


-- 7. VECTOR SIMILARITY QUERY FUNCTION
CREATE OR REPLACE FUNCTION public.match_trade_notes (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  p_user_id uuid
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
