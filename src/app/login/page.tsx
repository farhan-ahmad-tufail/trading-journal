'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { useRouter } from 'next/navigation';
import { Mail, Lock, ShieldAlert, BarChart3, BrainCircuit, Activity } from 'lucide-react';
import { isMockMode } from '@/lib/db';

export default function LoginPage() {
  const { user, loading, signInWithGoogle, signInWithEmail } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.push('/');
    }
  }, [user, loading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setError(null);
    setMessage(null);
    setAuthLoading(true);

    try {
      if (isMockMode) {
        await signInWithEmail(email);
        return;
      }

      await signInWithEmail(email, password);
      setMessage('Check your email for the magic sign-in link!');
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setAuthLoading(true);
    try {
      await signInWithEmail('demo@traderdna.com');
    } catch (err: any) {
      setError(err.message || 'Could not launch sandbox.');
    } finally {
      setAuthLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-zinc-400 font-sans">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-200" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-stretch bg-zinc-950 font-sans text-zinc-100">
      {/* Left Column: Brand Promotion */}
      <div className="hidden lg:flex flex-1 flex-col justify-between p-12 bg-zinc-900/10 border-r border-zinc-900/60 relative overflow-hidden">
        {/* Decorative Grid Lines */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f1f23_1px,transparent_1px),linear-gradient(to_bottom,#1f1f23_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30" />
        
        <div className="flex items-center gap-2 relative z-10">
          <div className="h-6 w-6 rounded bg-indigo-600 flex items-center justify-center text-white font-black text-xs">Ω</div>
          <span className="font-bold text-lg tracking-tight text-white">TRADER<span className="text-indigo-500 font-medium">DNA</span></span>
        </div>

        <div className="flex flex-col gap-6 max-w-md relative z-10 my-auto">
          <div className="h-10 w-10 rounded-lg bg-indigo-600/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <BrainCircuit size={20} />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white leading-tight">
            The Duolingo of Trading Psychology.
          </h1>
          <p className="text-zinc-400 leading-relaxed">
            Stop losing accounts to revenge trading, FOMO entries, and inconsistent risk sizing. Track your mental state and audit execution with AI.
          </p>

          <div className="flex flex-col gap-4 mt-4 border-t border-zinc-900 pt-6">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-xs text-zinc-400 font-semibold tracking-wide uppercase">Real-time Drawdown Guards</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-indigo-500" />
              <span className="text-xs text-zinc-400 font-semibold tracking-wide uppercase">AI Psychological Behavior Profiling</span>
            </div>
          </div>
        </div>

        <div className="text-xs text-zinc-600 relative z-10">
          &copy; {new Date().getFullYear()} Trader DNA. Advanced Performance Technology.
        </div>
      </div>

      {/* Right Column: Authentication Card */}
      <div className="flex-1 flex flex-col justify-center items-center p-6 sm:p-12 relative">
        <div className="w-full max-w-md flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-white">Welcome back</h2>
            <p className="text-sm text-zinc-400">
              Sign in to manage your journal and monitor drawdown parameters.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-3 bg-red-500/10 border border-red-500/20 px-4 py-3 rounded-md text-red-400 text-sm">
              <ShieldAlert size={18} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {message && (
            <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 rounded-md text-emerald-400 text-sm">
              <Mail size={18} className="shrink-0 mt-0.5" />
              <span>{message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-3.5 text-zinc-500" />
                <input
                  id="email"
                  type="email"
                  placeholder="name@example.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md py-2.5 pl-10 pr-4 text-sm text-zinc-200 placeholder:text-zinc-600 transition-colors"
                />
              </div>
            </div>

            {!isMockMode && (
              <div className="flex flex-col gap-1.5">
                <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-3.5 text-zinc-500" />
                  <input
                    id="password"
                    type="password"
                    placeholder="Enter password (optional for magic links)"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 outline-none rounded-md py-2.5 pl-10 pr-4 text-sm text-zinc-200 placeholder:text-zinc-600 transition-colors"
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="mt-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-indigo-700 text-white font-medium text-sm rounded-md py-2.5 transition-colors cursor-pointer flex items-center justify-center gap-2"
            >
              {authLoading ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              ) : isMockMode ? (
                'Sign In'
              ) : isRegister ? (
                'Send Activation Link'
              ) : (
                'Sign In with Magic Link'
              )}
            </button>
          </form>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-zinc-900"></div>
            <span className="flex-shrink mx-4 text-xs font-medium text-zinc-500 uppercase tracking-wide">Or continue with</span>
            <div className="flex-grow border-t border-zinc-900"></div>
          </div>

          <div className="flex flex-col gap-3">
            <button
              onClick={() => signInWithGoogle()}
              disabled={authLoading}
              className="flex items-center justify-center gap-2.5 w-full bg-zinc-900 hover:bg-zinc-900/80 border border-zinc-800 text-zinc-300 font-medium text-sm rounded-md py-2.5 transition-colors cursor-pointer"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              <span>Google SSO</span>
            </button>

            {isMockMode && (
              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={authLoading}
                className="flex items-center justify-center gap-2 w-full bg-indigo-600/10 hover:bg-indigo-600/15 border border-indigo-500/25 text-indigo-400 font-semibold text-sm rounded-md py-2.5 transition-colors cursor-pointer"
              >
                <Activity size={16} />
                <span>Launch Demo Trial (Sandbox Mode)</span>
              </button>
            )}
          </div>

          {isMockMode && (
            <div className="bg-zinc-900/40 border border-zinc-900/60 p-3 rounded text-zinc-500 text-xs leading-relaxed text-center">
              💡 <strong>CTO Sandbox Notice</strong>: The app is running in local preview mode. Use the button above or type any email to explore the journal and dashboard instantly.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
