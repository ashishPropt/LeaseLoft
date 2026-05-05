import { corsHeaders, getUser, json, serviceClient } from '../_shared/auth.ts';
import { getProvider } from '../_shared/payments/index.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json();
    const publicToken = String(body.public_token ?? '');
    const accountId = String(body.account_id ?? '');
    if (!accountId) return json({ error: 'Missing account_id' }, 400);

    const sb = serviceClient();

    // Find tenant's active lease to capture landlord_id
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

    const provider = getProvider();
    const linked = await provider.exchangePublicToken({ publicToken, accountId });

    const { data: pm, error: ierr } = await sb
      .from('payment_methods')
      .insert({
        tenant_id: user.id,
        landlord_id: lease.landlord_id,
        provider: provider.name,
        provider_account_id: linked.providerAccountId,
        provider_access_token: linked.accessToken,
        bank_name: linked.bankName,
        account_mask: linked.mask,
        account_type: linked.accountType,
      })
      .select('id, bank_name, account_mask, account_type, status')
      .single();
    if (ierr) throw ierr;

    return json({ payment_method: pm });
  } catch (e) {
    console.error('[payment-exchange-token]', e);
    return json({ error: (e as Error).message }, 500);
  }
});
