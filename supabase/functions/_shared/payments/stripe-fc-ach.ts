import type { PaymentProvider, LinkedAccount, InitiateInput, InitiateResult, WebhookEvent } from './types.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';

async function stripe(path: string, params?: Record<string, string | undefined>, idempotencyKey?: string) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const body = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) body.append(k, String(v));
    }
  }
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: params || idempotencyKey ? 'POST' : 'GET',
    headers,
    body: params ? body.toString() : undefined,
  });
  const json = await res.json();
  if (!res.ok) {
    console.error(`[stripe] ${path} failed`, json);
    throw new Error(json.error?.message || `Stripe ${path} failed`);
  }
  return json;
}

async function stripeGet(path: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  const json = await res.json();
  if (!res.ok) {
    console.error(`[stripe GET] ${path} failed`, json);
    throw new Error(json.error?.message || `Stripe ${path} failed`);
  }
  return json;
}

// Verify Stripe webhook signature (HMAC SHA-256, t=...,v1=...)
async function verifyStripeSignature(payload: string, header: string, secret: string): Promise<boolean> {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(',').map((p) => {
    const [k, ...rest] = p.split('=');
    return [k, rest.join('=')];
  }));
  const t = parts['t'];
  const v1 = parts['v1'];
  if (!t || !v1) return false;
  const signedPayload = `${t}.${payload}`;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
  const expected = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
  // constant-time compare
  if (expected.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}

export const stripeFcAchProvider: PaymentProvider = {
  name: 'stripe_fc_ach',

  async createLinkToken({ userId }) {
    // Create or reuse a Stripe customer keyed off the user id (idempotent).
    const customer = await stripe('/customers', {
      'metadata[user_id]': userId,
    }, `cus_${userId}`);

    const session = await stripe('/financial_connections/sessions', {
      'account_holder[type]': 'customer',
      'account_holder[customer]': customer.id,
      'permissions[]': 'payment_method',
      'filters[countries][]': 'US',
    });

    // Reuse linkToken field to carry the session client_secret.
    return { linkToken: session.client_secret };
  },

  async exchangePublicToken({ accountId }): Promise<LinkedAccount> {
    // Look up the FC account to get bank metadata + owning customer.
    const fcAccount = await stripeGet(`/financial_connections/accounts/${accountId}`);
    const customerId = fcAccount.account_holder?.customer;
    if (!customerId) throw new Error('Financial Connections account is not linked to a customer');

    // Create a us_bank_account PaymentMethod from the FC account.
    const pm = await stripe('/payment_methods', {
      type: 'us_bank_account',
      'us_bank_account[financial_connections_account]': accountId,
      'billing_details[name]': fcAccount.account_holder?.name || 'Tenant',
    });

    // Attach to the customer so we can charge it later.
    await stripe(`/payment_methods/${pm.id}/attach`, {
      customer: customerId,
    });

    return {
      accessToken: pm.id, // stripe payment_method id
      providerAccountId: customerId, // stripe customer id
      bankName: fcAccount.institution_name || 'Bank',
      mask: fcAccount.last4 || '••••',
      accountType: fcAccount.subcategory || fcAccount.category || 'checking',
    };
  },

  async initiatePayment(input: InitiateInput): Promise<InitiateResult> {
    try {
      const intent = await stripe('/payment_intents', {
        amount: String(input.amountCents),
        currency: 'usd',
        customer: input.providerAccountId,
        payment_method: input.accessToken,
        'payment_method_types[]': 'us_bank_account',
        confirm: 'true',
        'mandate_data[customer_acceptance][type]': 'online',
        'mandate_data[customer_acceptance][online][ip_address]': '0.0.0.0',
        'mandate_data[customer_acceptance][online][user_agent]': 'rent-payments-server',
        description: input.description,
        'metadata[user_id]': input.userId,
        'metadata[idempotency_source]': input.idempotencyKey,
      }, `pi_${input.idempotencyKey}`);

      const status = intent.status as string;
      const mapped: InitiateResult['status'] = status === 'succeeded'
        ? 'posted'
        : status === 'processing' || status === 'requires_action'
        ? 'processing'
        : 'failed';

      return {
        providerTransferId: intent.id,
        status: mapped,
        failureReason: mapped === 'failed' ? (intent.last_payment_error?.message || `Stripe status: ${status}`) : undefined,
      };
    } catch (e) {
      return { providerTransferId: '', status: 'failed', failureReason: (e as Error).message };
    }
  },

  async parseWebhook(req: Request, rawBody: string): Promise<WebhookEvent[] | null> {
    const sigHeader = req.headers.get('stripe-signature') ?? '';
    const valid = await verifyStripeSignature(rawBody, sigHeader, STRIPE_WEBHOOK_SECRET);
    if (!valid) {
      console.error('[stripe webhook] invalid signature');
      return null;
    }

    let event: { type?: string; data?: { object?: Record<string, unknown> } };
    try { event = JSON.parse(rawBody); } catch { return null; }
    const obj = event.data?.object as Record<string, unknown> | undefined;
    if (!obj) return null;

    const map: Record<string, WebhookEvent['newStatus']> = {
      'payment_intent.succeeded': 'paid',
      'payment_intent.processing': 'processing',
      'payment_intent.payment_failed': 'failed',
      'payment_intent.canceled': 'failed',
      'charge.refunded': 'returned',
      'charge.dispute.created': 'returned',
    };

    const newStatus = event.type ? map[event.type] : undefined;
    if (!newStatus) return [];

    // For charge events, look up the parent payment_intent id.
    const providerTransferId = (obj.payment_intent as string | undefined) ?? (obj.id as string);
    if (!providerTransferId) return [];

    const failureReason = (obj.last_payment_error as { message?: string } | undefined)?.message
      ?? (obj.failure_message as string | undefined);

    return [{ providerTransferId, newStatus, failureReason }];
  },
};
