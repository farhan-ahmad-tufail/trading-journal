'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { isMockMode } from '@/lib/db';
import { useRouter } from 'next/navigation';
import { onIdTokenChanged, signInWithPopup, signOut as firebaseSignOut } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';

interface AuthContextType {
  user: {
    id: string;
    email: string;
    full_name?: string;
    avatar_url?: string;
  } | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password?: string) => Promise<void>;
  signInAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthContextType['user']>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (isMockMode) {
      // Check if demo user is logged in
      const savedUser = localStorage.getItem('trader_dna_demo_user');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
      setLoading(false);
      return;
    }

    // Subscribe to Firebase ID token changes (captures login, logout, and token refreshes)
    const unsubscribe = onIdTokenChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const token = await firebaseUser.getIdToken();

          // 1. Save session in server-side HTTP cookie
          await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token })
          });

          // 2. Set client state
          setUser({
            id: firebaseUser.uid,
            email: firebaseUser.email || '',
            full_name: firebaseUser.displayName || '',
            avatar_url: firebaseUser.photoURL || ''
          });

          // 3. Trigger API query to automatically register user profile in DB if not exists
          await fetch('/api/db', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'fetchUserProfile' })
          });
        } catch (err) {
          console.error('Error establishing session/profile:', err);
        }
      } else {
        // Clear session cookie on logout
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: null })
        }).catch(err => console.error('Error clearing session:', err));

        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    if (isMockMode) {
      const demoUser = {
        id: 'demo-user',
        email: 'demo@traderdna.com',
        full_name: 'Prop Trader Demo',
        avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'
      };
      localStorage.setItem('trader_dna_demo_user', JSON.stringify(demoUser));
      setUser(demoUser);
      router.push('/');
      return;
    }

    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      router.push('/');
    } catch (error) {
      console.error('Firebase Google Sign-In error:', error);
      setLoading(false);
      throw error;
    }
  };

  const signInWithEmail = async (email: string, password?: string) => {
    // In mock mode we allow demo user matching
    if (isMockMode) {
      const demoUser = {
        id: 'demo-user',
        email: email,
        full_name: email.split('@')[0],
      };
      localStorage.setItem('trader_dna_demo_user', JSON.stringify(demoUser));
      setUser(demoUser);
      router.push('/');
      return;
    }

    // Google Auth is primary; email login can fall back to login screen warning
    throw new Error('Please sign in using the Login with Google action.');
  };

  const signInAsGuest = async () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('trader_dna_demo_mode', 'true');
      const guestUser = {
        id: 'demo-user',
        email: 'guest@traderdna.com',
        full_name: 'Guest Trader',
        avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'
      };
      localStorage.setItem('trader_dna_demo_user', JSON.stringify(guestUser));
      document.cookie = "trader-dna-guest-mode=true; path=/; max-age=86400; SameSite=Lax";
      setUser(guestUser);
      window.location.href = '/';
    }
  };

  const signOut = async () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('trader_dna_demo_mode');
      localStorage.removeItem('trader_dna_demo_user');
      localStorage.removeItem('trader_dna_mock_profile');
      document.cookie = "trader-dna-guest-mode=; path=/; max-age=0; SameSite=Lax";
    }

    if (isMockMode) {
      setUser(null);
      window.location.href = '/login';
      return;
    }

    setLoading(true);
    try {
      await firebaseSignOut(auth);
      setUser(null);
      window.location.href = '/login';
    } catch (error) {
      console.error('Firebase sign-out error:', error);
      setLoading(false);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, signInWithEmail, signInAsGuest, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
