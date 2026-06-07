import { NextRequest, NextResponse } from 'next/server';
import { getUserFromSession } from '@/lib/auth-verify';
import { createCheckoutSession } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const isMock = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
                   process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-supabase-project');

    if (isMock) {
      // In offline/mock mode, simulate a successful Stripe redirect back to coach
      return NextResponse.json({
        success: true,
        url: `${request.nextUrl.origin}/coach?billing=success&session_id=mock_session_123`
      });
    }

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Default Pro price ID from environment or standard testing placeholder
    const priceId = process.env.STRIPE_PRICE_ID || 'price_1ProPlanTesting';

    const origin = request.nextUrl.origin;
    const checkoutUrl = await createCheckoutSession(user.id, user.email || '', origin, priceId);

    return NextResponse.json({
      success: true,
      url: checkoutUrl
    });
  } catch (err: any) {
    console.error('Stripe checkout route error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error.' }, { status: 500 });
  }
}
