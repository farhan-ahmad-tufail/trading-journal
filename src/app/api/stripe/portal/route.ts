import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { getUserFromSession } from '@/lib/auth-verify';
import { createPortalSession } from '@/lib/stripe';

export async function POST(request: NextRequest) {
  try {
    const isMock = !process.env.NEXT_PUBLIC_SUPABASE_URL ||
                   process.env.NEXT_PUBLIC_SUPABASE_URL.includes('your-supabase-project');

    if (isMock) {
      // In offline/mock mode, simulate billing portal redirection
      return NextResponse.json({
        success: true,
        url: `${request.nextUrl.origin}/accounts?portal=mock_active`
      });
    }

    const user = await getUserFromSession(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Retrieve user profile to find Stripe Customer ID
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (!profile || !profile.stripe_customer_id) {
      return NextResponse.json({ error: 'No active Stripe billing record found for this profile.' }, { status: 400 });
    }

    const origin = request.nextUrl.origin;
    const portalUrl = await createPortalSession(profile.stripe_customer_id, origin);

    return NextResponse.json({
      success: true,
      url: portalUrl
    });
  } catch (err: any) {
    console.error('Stripe billing portal route error:', err);
    return NextResponse.json({ error: err.message || 'Internal server error.' }, { status: 500 });
  }
}
