// Refreshes the landlord's Stripe Connect status from Stripe and returns it.
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

async function stripePost(path: string, params: Record<string, string>) {
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null) body.append(k, v);
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
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
      .select('stripe_connect_account_id, stripe_connect_charges_enabled, stripe_connect_payouts_enabled, stripe_connect_details_submitted')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.stripe_connect_account_id) {
      return json({ connected: false });
    }

    const url = new URL(req.url);
    const wantLogin = url.searchParams.get('login_link') === '1';

    const acct = await stripeGet(`/accounts/${profile.stripe_connect_account_id}`);

    await sb.from('profiles').update({
      stripe_connect_charges_enabled: !!acct.charges_enabled,
      stripe_connect_payouts_enabled: !!acct.payouts_enabled,
      stripe_connect_details_submitted: !!acct.details_submitted,
      stripe_connect_updated_at: new Date().toISOString(),
    }).eq('id', user.id);

    let loginUrl: string | undefined;
    if (wantLogin && acct.details_submitted) {
      try {
        const link = await stripePost(`/accounts/${profile.stripe_connect_account_id}/login_links`, {});
        loginUrl = link.url;
      } catch (e) {
        console.warn('[stripe-connect-status] login link failed', (e as Error).message);
      }
    }

    return json({
      connected: true,
      account_id: profile.stripe_connect_account_id,
      charges_enabled: !!acct.charges_enabled,
      payouts_enabled: !!acct.payouts_enabled,
      details_submitted: !!acct.details_submitted,
      requirements: acct.requirements ?? null,
      login_url: loginUrl,
    });
  } catch (e) {
    console.error('[stripe-connect-status]', e);
    return json({ error: (e as Error).message }, 500);
  }
});
