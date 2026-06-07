-- =========================================================================
-- AI TRADING JOURNAL & PERFORMANCE COACH - DATABASE MIGRATION (PHASE 2 EXTRA)
-- MULTI-AGENT COACHING REPORT PERSISTENCE SCHEMA
-- =========================================================================

-- Create table to cache consolidated multi-agent reports
CREATE TABLE IF NOT EXISTS public.coaching_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
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

-- Enable RLS
ALTER TABLE public.coaching_reports ENABLE ROW LEVEL SECURITY;

-- Setup Row-Level Security policy
CREATE POLICY "Users can manage their own coaching reports." 
ON public.coaching_reports 
FOR ALL 
USING (auth.uid() = user_id);

-- Speed up queries by indexing account and created time
CREATE INDEX IF NOT EXISTS idx_coaching_reports_acc 
ON public.coaching_reports(user_id, account_id, created_at DESC);
