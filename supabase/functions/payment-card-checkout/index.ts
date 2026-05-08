// Creates a Stripe Checkout Session (card + Apple/Google Pay) for a rent payment.
// On success, Stripe webhooks (payment_intent.succeeded) flow through payment-webhook
// which updates the payment row and triggers the landlord transfer.
import { corsHeaders, getUser, json, serviceClient } from '../_shared/auth.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

async function stripe(path: string, params: Record<string, string>, idempotencyKey?: string) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null) body.append(k, v);
  const res = await fetch(`https://api.stripe.com/v1${path}`, { method: 'POST', headers, body: body.toString() });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error?.message || `Stripe ${path} failed`);
  return j;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json().catch(() => ({}));
    const paymentId = String(body.payment_id ?? '');
    const returnOrigin = String(body.return_origin ?? '');
    if (!paymentId) return json({ error: 'Missing payment_id' }, 400);
    if (!returnOrigin || !/^https?:\/\//.test(returnOrigin)) return json({ error: 'Missing return_origin' }, 400);

    const sb = serviceClient();

    const { data: payment, error: perr } = await sb
      .from('payments')
      .select('id, lease_id, amount, status, leases!inner(tenant_id)')
      .eq('id', paymentId)
      .single();
    if (perr || !payment) return json({ error: 'Payment not found' }, 404);
    // @ts-ignore nested
    if (payment.leases.tenant_id !== user.id) return json({ error: 'Forbidden' }, 403);
    if (payment.status === 'paid' || payment.status === 'processing') {
      return json({ error: `Payment already ${payment.status}` }, 409);
    }

    const { data: profile } = await sb
      .from('profiles')
      .select('email, stripe_customer_id, full_name, first_name, last_name')
      .eq('id', user.id)
      .maybeSingle();

    // Ensure a Stripe customer (reuse if already linked).
    let customerId = profile?.stripe_customer_id ?? '';
    if (!customerId) {
      const cus = await stripe('/customers', {
        email: profile?.email ?? user.email ?? '',
        'metadata[user_id]': user.id,
        name: profile?.full_name || `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || (profile?.email ?? ''),
      }, `cus_card_${user.id}`);
      customerId = cus.id;
      await sb.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
    }

    const amountCents = Math.round(Number(payment.amount) * 100);
    const successUrl = `${returnOrigin.replace(/\/$/, '')}/tenant/payments?card=success&payment_id=${paymentId}`;
    const cancelUrl = `${returnOrigin.replace(/\/$/, '')}/tenant/pay-rent?card=canceled`;

    const session = await stripe('/checkout/sessions', {
      mode: 'payment',
      customer: customerId,
      'payment_method_types[]': 'card',
      'line_items[0][quantity]': '1',
      'line_items[0][price_data][currency]': 'usd',
      'line_items[0][price_data][unit_amount]': String(amountCents),
      'line_items[0][price_data][product_data][name]': 'Rent payment',
      'payment_intent_data[description]': 'Rent (card)',
      'payment_intent_data[setup_future_usage]': 'off_session',
      'payment_intent_data[metadata][payment_id]': paymentId,
      'payment_intent_data[metadata][lease_id]': payment.lease_id,
      'payment_intent_data[metadata][user_id]': user.id,
      'metadata[payment_id]': paymentId,
      client_reference_id: paymentId,
      success_url: successUrl,
      cancel_url: cancelUrl,
    }, `cs_card_${paymentId}`);

    // Pre-fill fields so the webhook can match by provider_transfer_id once the PI succeeds.
    await sb.from('payments').update({
      method: 'card',
      provider: 'stripe_card',
      provider_transfer_id: session.payment_intent ?? null,
      payment_method_id: null,
    }).eq('id', paymentId);

    return json({ url: session.url, session_id: session.id });
  } catch (e) {
    console.error('[payment-card-checkout]', e);
    return json({ error: (e as Error).message }, 500);
  }
});
