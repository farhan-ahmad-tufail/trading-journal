import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();
    const cookieStore = await cookies();

    if (token) {
      // Set the session cookie. Set max age to 5 days
      cookieStore.set('firebase-token', token, {
        path: '/',
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 5 * 24 * 60 * 60, // 5 days
      });
    } else {
      // Clear the session cookie
      cookieStore.delete('firebase-token');
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Session endpoint error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
