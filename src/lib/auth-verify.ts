import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { verifyFirebaseToken } from './firebase-admin-verify';

export async function getUserFromSession(request?: NextRequest) {
  const isMock = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
                 process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-supabase-project');
  if (isMock) {
    return {
      id: 'demo-user',
      email: 'demo@traderdna.com',
      full_name: 'Prop Trader Demo',
      avatar_url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&h=150&q=80'
    };
  }

  // 1. Try Authorization header first
  if (request) {
    const authHeader = request.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) {
        const decoded = await verifyFirebaseToken(token);
        if (decoded) {
          return {
            id: decoded.sub as string,
            email: decoded.email as string,
            full_name: (decoded.name || '') as string,
            avatar_url: (decoded.picture || '') as string
          };
        }
      }
    }
  }

  // 2. Try cookie session
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('firebase-token')?.value;
    if (token) {
      const decoded = await verifyFirebaseToken(token);
      if (decoded) {
        return {
          id: decoded.sub as string,
          email: decoded.email as string,
          full_name: (decoded.name || '') as string,
          avatar_url: (decoded.picture || '') as string
        };
      }
    }
  } catch (err) {
    // cookies() may throw when called from static routes or pages in build
  }

  return null;
}
