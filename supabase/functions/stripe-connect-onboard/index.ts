// Creates (if needed) a Stripe Express connected account for the landlord
// and returns an onboarding Account Link URL.
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
    const { data: profile, error: pErr } = await sb
      .from('profiles')
      .select('id, email, stripe_connect_account_id')
      .eq('id', user.id)
      .maybeSingle();
    if (pErr) throw pErr;

    const body = await req.json().catch(() => ({}));
    const manualAccountId = typeof body.account_id === 'string' ? body.account_id.trim() : '';

    let accountId = profile?.stripe_connect_account_id ?? null;

    // Allow attaching a pre-existing Stripe (test) connected account by ID.
    if (manualAccountId) {
      if (!/^acct_[A-Za-z0-9]+$/.test(manualAccountId)) {
        return json({ error: 'Invalid Stripe account id (expected acct_…)' }, 400);
      }
      // Validate it exists / is accessible with our platform key
      await stripe(`/accounts/${manualAccountId}`);
      accountId = manualAccountId;
      await sb.from('profiles').update({
        stripe_connect_account_id: accountId,
        stripe_connect_updated_at: new Date().toISOString(),
      }).eq('id', user.id);
    }

    if (!accountId) {
      const acct = await stripe('/accounts', {
        type: 'express',
        email: profile?.email ?? user.email ?? '',
        'capabilities[transfers][requested]': 'true',
        'capabilities[card_payments][requested]': 'true',
        'capabilities[us_bank_account_ach_payments][requested]': 'true',
        country: 'US',
        'business_type': 'individual',
        'metadata[user_id]': user.id,
      });
      accountId = acct.id;
      await sb.from('profiles').update({
        stripe_connect_account_id: accountId,
        stripe_connect_updated_at: new Date().toISOString(),
      }).eq('id', user.id);
    } else {
      // Ensure ACH capability is requested on existing accounts (idempotent).
      try {
        await stripe(`/accounts/${accountId}`, {
          'capabilities[us_bank_account_payments][requested]': 'true',
        });
      } catch (e) {
        console.warn('[stripe-connect-onboard] could not request us_bank_account_payments', (e as Error).message);
      }
    }

    const origin = (body.return_url_origin as string | undefined)
      || req.headers.get('origin')
      || 'https://leaseloft.ai';

    // If a manual account was attached and onboarding already complete, skip account link.
    if (manualAccountId) {
      try {
        const acct = await stripe(`/accounts/${accountId}`);
        await sb.from('profiles').update({
          stripe_connect_charges_enabled: !!acct.charges_enabled,
          stripe_connect_payouts_enabled: !!acct.payouts_enabled,
          stripe_connect_details_submitted: !!acct.details_submitted,
          stripe_connect_updated_at: new Date().toISOString(),
        }).eq('id', user.id);
        if (acct.details_submitted) {
          return json({ url: null, account_id: accountId, attached: true });
        }
      } catch (_e) { /* fall through to create link */ }
    }


    const link = await stripe('/account_links', {
      account: accountId!,
      refresh_url: `${origin}/landlord/profile?stripe_refresh=1`,
      return_url: `${origin}/landlord/profile?stripe_return=1`,
      type: 'account_onboarding',
    });

    return json({ url: link.url, account_id: accountId });
  } catch (e) {
    console.error('[stripe-connect-onboard]', e);
    return json({ error: (e as Error).message }, 500);
  }
});
