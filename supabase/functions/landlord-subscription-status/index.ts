// Refreshes landlord's subscription status from Stripe.
import { corsHeaders, getUser, json, serviceClient } from '../_shared/auth.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

async function stripeGet(path: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
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
      .select('stripe_customer_id, stripe_subscription_id, subscription_price_id')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.stripe_customer_id) {
      return json({ active: false, has_price: !!profile?.subscription_price_id, status: null });
    }

    // Find active/trialing subscriptions for this customer.
    const subs = await stripeGet(`/subscriptions?customer=${profile.stripe_customer_id}&status=all&limit=10`);
    const list = (subs.data ?? []) as Array<{ id: string; status: string; current_period_end: number; items: { data: Array<{ price: { id: string } }> } }>;
    // Prefer one matching the assigned price; else most recent active/trialing.
    const matching = list.find((s) => s.items?.data?.some((it) => it.price?.id === profile.subscription_price_id) && ['active', 'trialing'].includes(s.status))
      ?? list.find((s) => ['active', 'trialing'].includes(s.status));

    const status = matching?.status ?? list[0]?.status ?? null;
    const subId = matching?.id ?? list[0]?.id ?? null;
    const periodEnd = matching?.current_period_end ?? list[0]?.current_period_end ?? null;
    const active = !!matching;

    await sb.from('profiles').update({
      stripe_subscription_id: subId,
      stripe_subscription_status: status,
      subscription_current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      subscription_updated_at: new Date().toISOString(),
    }).eq('id', user.id);

    return json({ active, status, has_price: !!profile.subscription_price_id, current_period_end: periodEnd });
  } catch (e) {
    console.error('[landlord-subscription-status]', e);
    return json({ error: (e as Error).message }, 500);
  }
});
