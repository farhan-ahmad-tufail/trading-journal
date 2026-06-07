/**
 * Lightweight Stripe REST API client using native fetch and Web Crypto API.
 * Avoids heavy npm dependencies.
 */

export async function createCheckoutSession(
  userId: string,
  userEmail: string,
  origin: string,
  priceId: string
): Promise<string> {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured on the server.');
  }

  const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      'payment_method_types[0]': 'card',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'mode': 'subscription',
      'success_url': `${origin}/coach?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      'cancel_url': `${origin}/coach?billing=cancel`,
      'customer_email': userEmail,
      'metadata[user_id]': userId,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Stripe Checkout Session creation failed: ${errText}`);
  }

  const data = await response.json();
  return data.url;
}

export async function createPortalSession(
  stripeCustomerId: string,
  origin: string
): Promise<string> {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured on the server.');
  }

  const response = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      'customer': stripeCustomerId,
      'return_url': `${origin}/accounts`,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Stripe Customer Portal creation failed: ${errText}`);
  }

  const data = await response.json();
  return data.url;
}

export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string,
  webhookSecret: string
): Promise<boolean> {
  if (!signatureHeader || !webhookSecret) return false;

  try {
    // 1. Extract timestamp (t=...) and signature (v1=...) from header
    const parts = signatureHeader.split(',');
    const timestampPart = parts.find(p => p.trim().startsWith('t='));
    const signaturePart = parts.find(p => p.trim().startsWith('v1='));

    if (!timestampPart || !signaturePart) return false;

    const timestamp = timestampPart.split('=')[1];
    const signature = signaturePart.split('=')[1];

    if (!timestamp || !signature) return false;

    // 2. Prevent replay attacks (check if timestamp is older than 5 minutes / 300 seconds)
    const timeSec = parseInt(timestamp, 10);
    const nowSec = Math.floor(Date.now() / 1000);
    if (Math.abs(nowSec - timeSec) > 300) {
      console.warn('Stripe Webhook verification: signature timestamp expired (older than 5 minutes)');
      return false;
    }

    // 3. Reconstruct the signature: t.body
    const signedMessage = `${timestamp}.${rawBody}`;

    // 4. HMAC SHA256 sign with Web Crypto API
    const encoder = new TextEncoder();
    const keyData = encoder.encode(webhookSecret);
    const messageData = encoder.encode(signedMessage);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const calculatedSigBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const calculatedSigArray = Array.from(new Uint8Array(calculatedSigBuffer));
    const calculatedSigHex = calculatedSigArray
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Constant-time check comparison
    return calculatedSigHex === signature;
  } catch (err) {
    console.error('Stripe Webhook verification signature exception:', err);
    return false;
  }
}
