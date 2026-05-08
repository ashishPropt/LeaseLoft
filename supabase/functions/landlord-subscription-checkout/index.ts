// Creates a Stripe Checkout session for the landlord's platform subscription.
import { corsHeaders, getUser, json, serviceClient } from '../_shared/auth.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

async function stripe(path: string, params?: Record<string, string>) {
  const body = new URLSearchParams();
  if (params) for (const [k, v] of Object.entries(params)) if (v != null) body.append(k, v);
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: params ? 'POST' : 'GET',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params ? body.toString() : undefined,
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error?.message || `Stripe ${path} failed`);
  return j;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const sb = serviceClient();
    const { data: profile } = await sb
      .from('profiles')
      .select('id, email, full_name, first_name, last_name, subscription_price_id, stripe_customer_id')
      .eq('id', user.id)
      .maybeSingle();

    const priceId = profile?.subscription_price_id;
    if (!priceId) {
      return json({ error: 'No subscription plan assigned. Contact your administrator.' }, 400);
    }

    let customerId = profile?.stripe_customer_id ?? null;
    if (!customerId) {
      const cust = await stripe('/customers', {
        email: profile?.email ?? user.email ?? '',
        name: profile?.full_name ?? `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim(),
        'metadata[user_id]': user.id,
      });
      customerId = cust.id;
      await sb.from('profiles').update({ stripe_customer_id: customerId }).eq('id', user.id);
    }

    const body = await req.json().catch(() => ({}));
    const origin = (body.return_url_origin as string | undefined)
      || req.headers.get('origin')
      || 'https://leaseloft.ai';

    const session = await stripe('/checkout/sessions', {
      mode: 'subscription',
      customer: customerId!,
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      success_url: `${origin}/landlord/setup?sub_return=1`,
      cancel_url: `${origin}/landlord/setup?sub_cancel=1`,
      'metadata[user_id]': user.id,
      'subscription_data[metadata][user_id]': user.id,
    });

    return json({ url: session.url });
  } catch (e) {
    console.error('[landlord-subscription-checkout]', e);
    return json({ error: (e as Error).message }, 500);
  }
});
