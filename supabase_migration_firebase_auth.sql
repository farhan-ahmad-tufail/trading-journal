-- =========================================================================
-- AI TRADING JOURNAL & PERFORMANCE COACH - DATABASE SCHEMA (FIREBASE AUTH MIGRATION)
-- Run this script inside your PostgreSQL / Supabase SQL Editor to adapt 
-- tables to accept alphanumeric Firebase User UIDs (as strings) instead of UUIDs.
-- =========================================================================

-- 1. Drop existing foreign key constraints on user_id columns
ALTER TABLE IF EXISTS public.trades 
    DROP CONSTRAINT IF EXISTS trades_user_id_fkey;

ALTER TABLE IF EXISTS public.daily_reflections 
    DROP CONSTRAINT IF EXISTS daily_reflections_user_id_fkey;

ALTER TABLE IF EXISTS public.accounts 
    DROP CONSTRAINT IF EXISTS accounts_user_id_fkey;

-- 2. Drop profile triggers referencing Supabase auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- 3. Modify id column in profiles (remove foreign key to auth.users and make it a VARCHAR)
ALTER TABLE public.profiles 
    DROP CONSTRAINT IF EXISTS profiles_pkey CASCADE;

ALTER TABLE public.profiles 
    ALTER COLUMN id TYPE VARCHAR(255);

ALTER TABLE public.profiles 
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

-- 4. Modify user_id columns in related tables to VARCHAR(255)
ALTER TABLE public.trades 
    ALTER COLUMN user_id TYPE VARCHAR(255);

ALTER TABLE public.daily_reflections 
    ALTER COLUMN user_id TYPE VARCHAR(255);

ALTER TABLE public.accounts 
    ALTER COLUMN user_id TYPE VARCHAR(255);

-- 5. Re-add foreign key constraints mapping back to the modified profiles.id
ALTER TABLE public.trades 
    ADD CONSTRAINT trades_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.daily_reflections 
    ADD CONSTRAINT daily_reflections_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.accounts 
    ADD CONSTRAINT accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 6. Disable Row-Level Security policies or update them
-- Since we are querying via Next.js backend routes utilizing service role admin bypass,
-- client-side RLS is no longer needed. We can keep RLS enabled but since the clients 
-- don't access Supabase directly, we can bypass RLS securely on the server.
