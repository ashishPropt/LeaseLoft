import { corsHeaders, getUser, json, serviceClient } from '../_shared/auth.ts';
import { getProvider } from '../_shared/payments/index.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const body = await req.json();
    const paymentId = String(body.payment_id ?? '');
    const paymentMethodId = String(body.payment_method_id ?? '');
    if (!paymentId || !paymentMethodId) return json({ error: 'Missing payment_id or payment_method_id' }, 400);

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

    const { data: pm, error: merr } = await sb
      .from('payment_methods')
      .select('id, tenant_id, provider, provider_account_id, provider_access_token, status, connected_account_id')
      .eq('id', paymentMethodId)
      .single();
    if (merr || !pm) return json({ error: 'Payment method not found' }, 404);
    if (pm.tenant_id !== user.id) return json({ error: 'Forbidden' }, 403);
    if (pm.status !== 'active') return json({ error: 'Payment method revoked' }, 400);
    if (!pm.connected_account_id) return json({ error: 'Bank account is no longer valid. Please re-link your bank.' }, 400);

    // Verify connected account still matches this lease's landlord
    // @ts-ignore embedded
    const landlordId = payment.leases.landlord_id as string;
    const { data: landlord } = await sb
      .from('profiles')
      .select('stripe_connect_account_id, stripe_connect_charges_enabled')
      .eq('id', landlordId)
      .maybeSingle();
    if (!landlord?.stripe_connect_account_id || landlord.stripe_connect_account_id !== pm.connected_account_id) {
      return json({ error: 'Bank account is linked to a different landlord. Please re-link your bank.' }, 400);
    }
    if (!landlord.stripe_connect_charges_enabled) {
      return json({ error: 'Landlord cannot accept payments yet' }, 400);
    }

    const { data: profile } = await sb
      .from('profiles')
      .select('full_name, first_name, last_name, email')
      .eq('id', user.id)
      .single();
    const userName = profile?.full_name
      || `${profile?.first_name ?? ''} ${profile?.last_name ?? ''}`.trim()
      || profile?.email
      || 'Tenant';

    const amountCents = Math.round(Number(payment.amount) * 100);

    const provider = getProvider();
    const result = await provider.initiatePayment({
      accessToken: pm.provider_access_token,
      providerAccountId: pm.provider_account_id,
      amountCents,
      description: 'Rent',
      idempotencyKey: paymentId,
      userId: user.id,
      userName,
      stripeAccount: pm.connected_account_id,
    });

    const newStatus = result.status === 'failed' ? 'failed'
      : result.status === 'posted' ? 'paid'
      : 'processing';

    const { error: uerr } = await sb
      .from('payments')
      .update({
        status: newStatus,
        method: 'ach',
        provider: provider.name,
        provider_transfer_id: result.providerTransferId || null,
        payment_method_id: pm.id,
        amount: amountCents / 100,
        failure_reason: result.failureReason ?? null,
        paid_at: newStatus === 'paid' ? new Date().toISOString() : null,
        connected_account_id: pm.connected_account_id,
      })
      .eq('id', paymentId);
    if (uerr) throw uerr;

    return json({
      status: newStatus,
      provider_transfer_id: result.providerTransferId,
      failure_reason: result.failureReason,
    });
  } catch (e) {
    console.error('[payment-initiate]', e);
    return json({ error: (e as Error).message }, 500);
  }
});
