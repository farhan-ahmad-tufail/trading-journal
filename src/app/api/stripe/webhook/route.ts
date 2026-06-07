import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: NextRequest) {
  const rawBody = await request.text();
  const signature = request.headers.get('stripe-signature') || '';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  // 1. Verify Stripe Webhook Signature
  const isValid = await verifyWebhookSignature(rawBody, signature, webhookSecret);
  if (!isValid && process.env.NODE_ENV === 'production') {
    console.error('Stripe Webhook Signature Verification Failed');
    return new Response('Invalid Signature', { status: 400 });
  }

  try {
    const event = JSON.parse(rawBody);
    const adminSupabase = createAdminClient();

    const subscription = event.data.object;
    const customerId = subscription.customer;
    const subscriptionId = subscription.id;
    const status = subscription.status;
    const priceId = subscription.items?.data?.[0]?.price?.id || subscription.plan?.id || '';
    const currentPeriodEnd = subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null;

    // Retrieve userId from metadata passed in Checkout Session
    const userId = subscription.metadata?.user_id;

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        // If metadata is missing, we try to match via stripe_customer_id
        if (userId) {
          const { error } = await adminSupabase
            .from('profiles')
            .update({
              stripe_customer_id: customerId,
              subscription_id: subscriptionId,
              subscription_status: status === 'active' || status === 'trialing' ? 'active' : status,
              price_id: priceId,
              current_period_end: currentPeriodEnd
            })
            .eq('id', userId);
          if (error) throw error;
        } else {
          // Fallback lookup by customer ID
          const { error } = await adminSupabase
            .from('profiles')
            .update({
              subscription_id: subscriptionId,
              subscription_status: status === 'active' || status === 'trialing' ? 'active' : status,
              price_id: priceId,
              current_period_end: currentPeriodEnd
            })
            .eq('stripe_customer_id', customerId);
          if (error) throw error;
        }
        break;
      }
      case 'customer.subscription.deleted': {
        if (userId) {
          const { error } = await adminSupabase
            .from('profiles')
            .update({
              subscription_status: 'free',
              subscription_id: null,
              price_id: null,
              current_period_end: null
            })
            .eq('id', userId);
          if (error) throw error;
        } else {
          const { error } = await adminSupabase
            .from('profiles')
            .update({
              subscription_status: 'free',
              subscription_id: null,
              price_id: null,
              current_period_end: null
            })
            .eq('stripe_customer_id', customerId);
          if (error) throw error;
        }
        break;
      }
      default:
        // Unhandled events
        break;
    }

    return NextResponse.json({ received: true });
  } catch (err: any) {
    console.error('Stripe webhook handling failed:', err);
    return NextResponse.json({ error: err.message || 'Webhook handler error' }, { status: 500 });
  }
}
