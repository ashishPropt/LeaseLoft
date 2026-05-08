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

type Sub = { id: string; status: string; current_period_end: number; customer: string; items: { data: Array<{ price: { id: string }, current_period_end?: number }> } };

function pickPeriodEnd(s: Sub | undefined): number | null {
  if (!s) return null;
  return s.current_period_end ?? s.items?.data?.[0]?.current_period_end ?? null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const sb = serviceClient();
    const { data: profile } = await sb
      .from('profiles')
      .select('stripe_customer_id, stripe_subscription_id, subscription_price_id, email')
      .eq('id', user.id)
      .maybeSingle();

    const email = profile?.email ?? user.email ?? null;

    // Collect candidate customer IDs: stored + any matching the user's email in Stripe.
    // Pricing Tables can create a NEW customer at checkout time, distinct from the one
    // we created server-side. We need to look across all of them.
    const customerIds = new Set<string>();
    if (profile?.stripe_customer_id) customerIds.add(profile.stripe_customer_id);

    if (email) {
      try {
        const search = await stripeGet(`/customers/search?query=${encodeURIComponent(`email:"${email}"`)}&limit=20`);
        for (const c of (search.data ?? []) as Array<{ id: string }>) customerIds.add(c.id);
      } catch (e) {
        console.warn('[landlord-subscription-status] customer search failed', (e as Error).message);
      }
    }

    if (customerIds.size === 0) {
      return json({ active: false, has_price: !!profile?.subscription_price_id, status: null });
    }

    // Fetch subs across all candidate customers.
    const all: Sub[] = [];
    for (const cid of customerIds) {
      try {
        const subs = await stripeGet(`/subscriptions?customer=${cid}&status=all&limit=10&expand[]=data.items.data.price.product`);
        for (const s of (subs.data ?? []) as Sub[]) all.push(s);
      } catch (e) {
        console.warn('[landlord-subscription-status] list failed for', cid, (e as Error).message);
      }
    }

    // Prefer one matching the assigned price; else most recent active/trialing; else most recent.
    const matching =
      all.find((s) => s.items?.data?.some((it) => it.price?.id === profile?.subscription_price_id) && ['active', 'trialing'].includes(s.status))
      ?? all.find((s) => ['active', 'trialing'].includes(s.status))
      ?? all[0];

    const status = matching?.status ?? null;
    const subId = matching?.id ?? null;
    const periodEnd = pickPeriodEnd(matching);
    const active = !!matching && ['active', 'trialing'].includes(matching.status);

    const updates: Record<string, unknown> = {
      stripe_subscription_id: subId,
      stripe_subscription_status: status,
      subscription_current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
      subscription_updated_at: new Date().toISOString(),
    };
    // If the active subscription belongs to a different customer than what we had stored,
    // update it so future lookups are direct.
    if (matching?.customer && matching.customer !== profile?.stripe_customer_id) {
      updates.stripe_customer_id = matching.customer;
    }
    await sb.from('profiles').update(updates).eq('id', user.id);

    const subscriptions = all.map((s: any) => {
      const item = s.items?.data?.[0];
      const price = item?.price ?? {};
      const product = price.product && typeof price.product === 'object' ? price.product : null;
      return {
        id: s.id,
        status: s.status,
        current_period_end: pickPeriodEnd(s),
        cancel_at_period_end: s.cancel_at_period_end ?? false,
        amount: price.unit_amount ?? null,
        currency: price.currency ?? null,
        interval: price.recurring?.interval ?? null,
        interval_count: price.recurring?.interval_count ?? 1,
        nickname: price.nickname ?? product?.name ?? price.lookup_key ?? null,
        price_id: price.id ?? null,
      };
    }).sort((a, b) => {
      const rank = (st: string) => (['active','trialing'].includes(st) ? 0 : st === 'past_due' ? 1 : 2);
      return rank(a.status) - rank(b.status);
    });

    return json({ active, status, has_price: !!profile?.subscription_price_id, current_period_end: periodEnd, subscriptions });
  } catch (e) {
    console.error('[landlord-subscription-status]', e);
    return json({ error: (e as Error).message }, 500);
  }
});
