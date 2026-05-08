// One-off admin backfill: request card_payments capability on every existing
// landlord Stripe Connect account. Safe to re-run (idempotent at Stripe).
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
    const { data: isAdmin } = await sb.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) return json({ error: 'Forbidden' }, 403);

    const { data: profiles, error } = await sb
      .from('profiles')
      .select('id, stripe_connect_account_id')
      .not('stripe_connect_account_id', 'is', null);
    if (error) throw error;

    const results: Array<{ user_id: string; account_id: string; status: string; error?: string }> = [];
    for (const p of profiles ?? []) {
      const acctId = p.stripe_connect_account_id as string;
      try {
        await stripe(`/accounts/${acctId}/capabilities/card_payments`, { requested: 'true' });
        results.push({ user_id: p.id as string, account_id: acctId, status: 'requested' });
      } catch (e) {
        results.push({ user_id: p.id as string, account_id: acctId, status: 'failed', error: (e as Error).message });
      }
    }

    return json({ ok: true, total: results.length, results });
  } catch (e) {
    console.error('[stripe-connect-backfill-card]', e);
    return json({ error: (e as Error).message }, 500);
  }
});
