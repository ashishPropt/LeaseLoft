import type { PaymentProvider, LinkedAccount, InitiateInput, InitiateResult, WebhookEvent } from './types.ts';

const PLAID_ENV = Deno.env.get('PLAID_ENV') ?? 'sandbox';
const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID') ?? '';
const PLAID_SECRET = Deno.env.get('PLAID_SECRET') ?? '';

const BASE = PLAID_ENV === 'production'
  ? 'https://production.plaid.com'
  : PLAID_ENV === 'development'
  ? 'https://development.plaid.com'
  : 'https://sandbox.plaid.com';

async function plaid(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: PLAID_CLIENT_ID, secret: PLAID_SECRET, ...body }),
  });
  const json = await res.json();
  if (!res.ok) {
    console.error(`[plaid] ${path} failed`, json);
    throw new Error(json.error_message || json.error_code || `Plaid ${path} failed`);
  }
  return json;
}

export const plaidTransferProvider: PaymentProvider = {
  name: 'plaid_transfer',

  async createLinkToken({ userId }) {
    const json = await plaid('/link/token/create', {
      user: { client_user_id: userId },
      client_name: 'Rent Payments',
      products: ['auth'],
      country_codes: ['US'],
      language: 'en',
    });
    return { linkToken: json.link_token };
  },

  async exchangePublicToken({ publicToken, accountId }): Promise<LinkedAccount> {
    const exch = await plaid('/item/public_token/exchange', { public_token: publicToken });
    const accessToken = exch.access_token as string;

    // Fetch account details for display
    const acct = await plaid('/accounts/get', { access_token: accessToken });
    const found = acct.accounts.find((a: { account_id: string }) => a.account_id === accountId)
      ?? acct.accounts[0];

    return {
      accessToken,
      providerAccountId: found.account_id,
      bankName: acct.item?.institution_name || found.name || 'Bank',
      mask: found.mask || '••••',
      accountType: found.subtype || found.type || 'checking',
    };
  },

  async initiatePayment(input: InitiateInput): Promise<InitiateResult> {
    // 1. Authorize
    const auth = await plaid('/transfer/authorization/create', {
      access_token: input.accessToken,
      account_id: input.providerAccountId,
      type: 'debit',
      network: 'ach',
      amount: (input.amountCents / 100).toFixed(2),
      ach_class: 'web',
      user: { legal_name: input.userName },
      idempotency_key: `auth_${input.idempotencyKey}`,
    });
    if (auth.authorization?.decision !== 'approved') {
      return {
        providerTransferId: '',
        status: 'failed',
        failureReason: auth.authorization?.decision_rationale?.description || 'Authorization declined',
      };
    }

    // 2. Create transfer
    const tr = await plaid('/transfer/create', {
      access_token: input.accessToken,
      account_id: input.providerAccountId,
      authorization_id: auth.authorization.id,
      description: input.description.slice(0, 15), // Plaid limit
    });

    return {
      providerTransferId: tr.transfer.id,
      status: 'processing',
    };
  },

  async parseWebhook(_req, rawBody): Promise<WebhookEvent[] | null> {
    let payload: { webhook_type?: string; webhook_code?: string };
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return null;
    }
    if (payload.webhook_type !== 'TRANSFER') return null;

    // Plaid sends TRANSFER_EVENTS_UPDATE — pull deltas via /transfer/event/sync.
    const sync = await plaid('/transfer/event/sync', { after_id: 0, count: 25 });
    const events = (sync.transfer_events ?? []) as Array<{
      transfer_id: string;
      event_type: string;
      failure_reason?: { description?: string };
    }>;

    const map: Record<string, WebhookEvent['newStatus']> = {
      pending: 'processing',
      posted: 'paid',
      settled: 'paid',
      failed: 'failed',
      returned: 'returned',
      cancelled: 'failed',
    };

    return events
      .filter((e) => map[e.event_type])
      .map((e) => ({
        providerTransferId: e.transfer_id,
        newStatus: map[e.event_type],
        failureReason: e.failure_reason?.description,
      }));
  },
};
