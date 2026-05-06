// Shared helper: create a Stripe Transfer from the platform balance to the landlord's
// connected account for a given paid `payments` row.
//
// Uses separate charges & transfers — the charge already happened on the platform
// account; we issue a transfer with `source_transaction = <charge_id>` so the funds
// move from that specific charge once it settles.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

async function stripe(path: string, params: Record<string, string>, idempotencyKey?: string) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null) body.append(k, v);
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST', headers, body: body.toString(),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error?.message || `Stripe ${path} failed`);
  return j;
}

async function stripeGet(path: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error?.message || `Stripe ${path} failed`);
  return j;
}

type SbClient = ReturnType<typeof createClient>;

export interface TransferOutcome {
  status: 'created' | 'skipped' | 'failed';
  transferId?: string;
  reason?: string;
}

export async function createTransferForPayment(sb: SbClient, paymentId: string): Promise<TransferOutcome> {
  // Pull the payment + landlord connect account.
  const { data: payment, error: pErr } = await sb
    .from('payments')
    .select('id, lease_id, amount, status, provider, provider_transfer_id, transfer_id, destination_account_id, leases!inner(landlord_id)')
    .eq('id', paymentId)
    .maybeSingle();
  if (pErr) throw pErr;
  if (!payment) return { status: 'skipped', reason: 'payment not found' };
  if (payment.transfer_id) return { status: 'skipped', reason: 'transfer already exists', transferId: payment.transfer_id };
  if (payment.status !== 'paid') return { status: 'skipped', reason: `payment status is ${payment.status}` };
  if (!payment.provider_transfer_id) return { status: 'skipped', reason: 'no payment_intent on payment' };

  // @ts-ignore embedded
  const landlordId = payment.leases?.landlord_id as string | undefined;
  if (!landlordId) return { status: 'skipped', reason: 'no landlord on lease' };

  const { data: landlord } = await sb
    .from('profiles')
    .select('stripe_connect_account_id, stripe_connect_charges_enabled, stripe_connect_payouts_enabled')
    .eq('id', landlordId)
    .maybeSingle();
  const destination = landlord?.stripe_connect_account_id;
  if (!destination) {
    await sb.from('payments').update({
      transfer_status: 'skipped',
      transfer_error: 'Landlord has not connected a Stripe account',
    }).eq('id', paymentId);
    return { status: 'skipped', reason: 'landlord not connected' };
  }
  if (!landlord?.stripe_connect_payouts_enabled) {
    await sb.from('payments').update({
      transfer_status: 'pending_landlord',
      transfer_error: 'Landlord Stripe account is not fully onboarded',
      destination_account_id: destination,
    }).eq('id', paymentId);
    return { status: 'skipped', reason: 'landlord payouts disabled' };
  }

  // Stripe Transfer needs a charge id (source_transaction). Look it up from the PI.
  let chargeId: string | undefined;
  try {
    const pi = await stripeGet(`/payment_intents/${payment.provider_transfer_id}`);
    chargeId = pi.latest_charge as string | undefined;
  } catch (e) {
    return { status: 'failed', reason: `payment_intent lookup failed: ${(e as Error).message}` };
  }
  if (!chargeId) return { status: 'skipped', reason: 'charge not yet available' };

  const amountCents = Math.round(Number(payment.amount) * 100);
  try {
    const transfer = await stripe('/transfers', {
      amount: String(amountCents),
      currency: 'usd',
      destination,
      source_transaction: chargeId,
      description: 'Rent payout',
      'metadata[payment_id]': paymentId,
      'metadata[lease_id]': payment.lease_id,
    }, `transfer_${paymentId}`);

    await sb.from('payments').update({
      transfer_id: transfer.id,
      destination_account_id: destination,
      transfer_status: 'created',
      transfer_error: null,
      transfer_created_at: new Date().toISOString(),
    }).eq('id', paymentId);

    return { status: 'created', transferId: transfer.id };
  } catch (e) {
    const msg = (e as Error).message;
    await sb.from('payments').update({
      transfer_status: 'failed',
      transfer_error: msg,
      destination_account_id: destination,
    }).eq('id', paymentId);
    return { status: 'failed', reason: msg };
  }
}
