-- =========================================================================
-- AI TRADING JOURNAL & PERFORMANCE COACH - DATABASE SCHEMA (PHASE 3)
-- Run this script inside your Supabase SQL Editor to apply Phase 3 updates.
-- =========================================================================

-- Add Stripe billing columns to profiles table
ALTER TABLE public.profiles
    ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
    ADD COLUMN IF NOT EXISTS subscription_id TEXT,
    ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'free', -- 'free', 'trialing', 'active', 'canceled'
    ADD COLUMN IF NOT EXISTS price_id TEXT,
    ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMP WITH TIME ZONE;

-- Create index for faster customer and status lookup mapping
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer ON public.profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON public.profiles(subscription_status);
