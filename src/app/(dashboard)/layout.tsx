'use client';

import React, { useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { AccountProvider, useAccount } from '@/components/AccountProvider';
import AccountSwitcher from '@/components/AccountSwitcher';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { 
  LayoutDashboard, 
  PlusCircle, 
  History, 
  Brain, 
  LogOut, 
  User,
  Flame
} from 'lucide-react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AccountProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </AccountProvider>
  );
}

function DashboardLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, signOut } = useAuth();
  const { streak } = useAccount();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-zinc-950 text-zinc-400 font-sans">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-zinc-200" />
          <p className="text-sm font-medium tracking-wide">Syncing session...</p>
        </div>
      </div>
    );
  }

  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Journal Trade', href: '/journal', icon: PlusCircle },
    { name: 'Trade History', href: '/history', icon: History },
    { name: 'AI Coach', href: '/coach', icon: Brain },
    { name: 'Reflection', href: '/reflection', icon: Flame },
  ];

  return (
    <div className="flex h-screen w-screen bg-zinc-950 overflow-hidden font-sans text-zinc-100">
      {/* Sidebar Navigation */}
      <aside className="w-64 border-r border-zinc-900 bg-zinc-900/20 flex flex-col justify-between p-4 shrink-0">
        <div className="flex flex-col gap-6">
          {/* Logo Brand */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between px-2 py-1">
              <Link href="/" className="flex items-center gap-2">
                <div className="h-6 w-6 rounded bg-indigo-600 flex items-center justify-center text-white font-black text-xs">Ω</div>
                <span className="font-bold text-base tracking-tight text-white">TRADER<span className="text-indigo-500 font-medium">DNA</span></span>
              </Link>
              {/* Streak Counter */}
              <div className="flex items-center gap-1 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-full text-amber-500 text-xs font-semibold" title="Reflection streak (consecutive days)">
                <Flame size={12} fill="currentColor" />
                <span>{streak}</span>
              </div>
            </div>
            
            {/* Account Switcher Widget */}
            <AccountSwitcher />
          </div>

          {/* Navigation Links */}
          <nav className="flex flex-col gap-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                    isActive 
                      ? 'bg-zinc-900 text-white border border-zinc-800' 
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/50'
                  }`}
                >
                  <Icon size={16} className={isActive ? 'text-indigo-400' : 'text-zinc-500'} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Footer Profile & Logout */}
        <div className="border-t border-zinc-900 pt-4 flex flex-col gap-3">
          <div className="flex items-center gap-3 px-2">
            {user.avatar_url ? (
              <img 
                src={user.avatar_url} 
                alt={user.full_name || 'User'} 
                className="h-9 w-9 rounded-full border border-zinc-800 object-cover"
              />
            ) : (
              <div className="h-9 w-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300">
                <User size={16} />
              </div>
            )}
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-semibold text-zinc-200 truncate leading-none mb-1">
                {user.full_name || 'Demo Trader'}
              </span>
              <span className="text-xs text-zinc-500 truncate">
                {user.email}
              </span>
            </div>
          </div>
          
          <button
            onClick={() => signOut()}
            className="flex items-center gap-2 px-3 py-2 w-full rounded-md text-sm font-medium text-zinc-400 hover:text-red-400 hover:bg-red-500/5 transition-colors text-left"
          >
            <LogOut size={16} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full bg-zinc-950/40 overflow-y-auto min-w-0">
        <div className="flex-1 p-6 md:p-8 max-w-6xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
