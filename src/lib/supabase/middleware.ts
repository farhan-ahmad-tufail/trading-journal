import { NextResponse, type NextRequest } from 'next/server';
import { verifyFirebaseToken } from '../firebase-admin-verify';

function parseJwtPayload(token: string) {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export async function updateSession(request: NextRequest) {
  const isMock = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
                 process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-supabase-project');
  const isGuest = request.cookies.get('trader-dna-guest-mode')?.value === 'true';

  if (isMock || isGuest) {
    return NextResponse.next();
  }

  const token = request.cookies.get('firebase-token')?.value;
  const path = request.nextUrl.pathname;

  // Bypass checks for assets, auth APIs, and webhooks
  if (
    path.startsWith('/_next') ||
    path.startsWith('/api/auth') ||
    path.startsWith('/api/stripe/webhook') ||
    path.includes('.')
  ) {
    return NextResponse.next();
  }

  if (!token) {
    if (path !== '/login') {
      return NextResponse.redirect(new URL('/login', request.url));
    }
  } else {
    // Lightweight decode to check token validity/expiration dynamically
    const payload = parseJwtPayload(token);
    const now = Math.floor(Date.now() / 1000);
    const isValid = payload && payload.exp && payload.exp > now;

    if (!isValid) {
      const response = NextResponse.redirect(new URL('/login', request.url));
      response.cookies.delete('firebase-token');
      return response;
    }
    if (path === '/login') {
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}
