import { corsHeaders, getUser, json, serviceClient } from '../_shared/auth.ts';
import { getProvider } from '../_shared/payments/index.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const sb = serviceClient();

    // Find tenant's active lease + landlord's connected account
    const { data: lease, error: lerr } = await sb
      .from('leases')
      .select('landlord_id')
      .eq('tenant_id', user.id)
      .eq('status', 'active')
      .order('start_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (lerr) throw lerr;
    if (!lease) return json({ error: 'No active lease found' }, 400);

    const { data: landlord } = await sb
      .from('profiles')
      .select('stripe_connect_account_id, stripe_connect_charges_enabled')
      .eq('id', lease.landlord_id)
      .maybeSingle();
    const connectedAccountId = landlord?.stripe_connect_account_id ?? '';
    if (!connectedAccountId) return json({ error: 'Landlord has not connected a payout account yet' }, 400);
    if (!landlord?.stripe_connect_charges_enabled) return json({ error: 'Landlord cannot accept payments yet' }, 400);

    const { data: profile } = await sb
      .from('profiles')
      .select('full_name, first_name, last_name')
      .eq('id', user.id)
      .maybeSingle();
    const userName = profile?.full_name || `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim() || undefined;

    const provider = getProvider();
    const { linkToken } = await provider.createLinkToken({ userId: user.id, userName, stripeAccount: connectedAccountId });
    const publishableKey = Deno.env.get('STRIPE_PUBLISHABLE_KEY') ?? '';
    return json({
      link_token: linkToken,
      publishable_key: publishableKey,
      connected_account_id: connectedAccountId,
    });
  } catch (e) {
    console.error('[payment-link-token]', e);
    return json({ error: (e as Error).message }, 500);
  }
});
