// Creates a Stripe Checkout Session (card + Apple/Google Pay) for a rent payment
// as a DIRECT charge on the landlord's connected Stripe account.
import { corsHeaders, getUser, json, serviceClient } from '../_shared/auth.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

async function stripe(
  path: string,
  params: Record<string, string>,
  idempotencyKey?: string,
  stripeAccount?: string,
) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  if (stripeAccount) headers['Stripe-Account'] = stripeAccount;
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null) body.append(k, v);
  const res = await fetch(`https://api.stripe.com/v1${path}`, { method: 'POST', headers, body: body.toString() });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error?.message || `Stripe ${path} failed`);
  return j;
}

async function stripeSearch(path: string, query: string, stripeAccount?: string) {
  const headers: Record<string, string> = { Authorization: `Bearer ${STRIPE_SECRET_KEY}` };
  if (stripeAccount) headers['Stripe-Account'] = stripeAccount;
  const url = `https://api.stripe.com/v1${path}?query=${encodeURIComponent(query)}&limit=1`;
  const res = await fetch(url, { headers });
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
      .select('id, lease_id, amount, status, leases!inner(tenant_id, landlord_id)')
      .eq('id', paymentId)
      .single();
    if (perr || !payment) return json({ error: 'Payment not found' }, 404);
    // @ts-ignore nested
    if (payment.leases.tenant_id !== user.id) return json({ error: 'Forbidden' }, 403);
    if (payment.status === 'paid' || payment.status === 'processing') {
      return json({ error: `Payment already ${payment.status}` }, 409);
    }

    // @ts-ignore embedded
    const landlordId = payment.leases.landlord_id as string;
    const { data: landlord } = await sb
      .from('profiles')
      .select('stripe_connect_account_id, stripe_connect_charges_enabled')
      .eq('id', landlordId)
      .maybeSingle();
    const connectedAccountId = landlord?.stripe_connect_account_id ?? '';
    if (!connectedAccountId) return json({ error: 'Landlord has not connected a payout account yet' }, 400);
    if (!landlord?.stripe_connect_charges_enabled) return json({ error: 'Landlord cannot accept payments yet' }, 400);

    const { data: profile } = await sb
      .from('profiles')
      .select('email, full_name, first_name, last_name')
      .eq('id', user.id)
      .maybeSingle();

    // Find or create a Customer on the connected account, scoped by user_id metadata.
    let customerId = '';
    try {
      const search = await stripeSearch('/customers/search', `metadata['user_id']:'${user.id}'`, connectedAccountId);
      customerId = search.data?.[0]?.id ?? '';
    } catch (e) {
      console.warn('[payment-card-checkout] customer search failed', (e as Error).message);
    }
    if (!customerId) {
      const cus = await stripe('/customers', {
        email: profile?.email ?? user.email ?? '',
        'metadata[user_id]': user.id,
        name: profile?.full_name || `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || (profile?.email ?? ''),
      }, `cus_card_${user.id}_${connectedAccountId}`, connectedAccountId);
      customerId = cus.id;
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
      'payment_intent_data[metadata][payment_id]': paymentId,
      'payment_intent_data[metadata][lease_id]': payment.lease_id,
      'payment_intent_data[metadata][user_id]': user.id,
      'metadata[payment_id]': paymentId,
      client_reference_id: paymentId,
      success_url: successUrl,
      cancel_url: cancelUrl,
    }, `cs_card_${paymentId}`, connectedAccountId);

    await sb.from('payments').update({
      method: 'card',
      provider: 'stripe_card',
      provider_transfer_id: session.payment_intent ?? null,
      payment_method_id: null,
      connected_account_id: connectedAccountId,
    }).eq('id', paymentId);

    return json({ url: session.url, session_id: session.id });
  } catch (e) {
    console.error('[payment-card-checkout]', e);
    return json({ error: (e as Error).message }, 500);
  }
});
