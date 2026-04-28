import type { PaymentProvider, LinkedAccount, InitiateInput, InitiateResult, WebhookEvent } from './types.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const PLAID_CLIENT_ID = Deno.env.get('PLAID_CLIENT_ID') ?? '';
const PLAID_SECRET = Deno.env.get('PLAID_SECRET') ?? '';

async function stripe(path: string, body: URLSearchParams) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || 'Stripe API error');
  return json;
}

async function plaid(path: string, body: Record<string, unknown>) {
  const res = await fetch(`https://sandbox.plaid.com${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: PLAID_CLIENT_ID, secret: PLAID_SECRET, ...body }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error_message || 'Plaid API error');
  return json;
}

export const plaidStripeFcProvider: PaymentProvider = {
  name: 'plaid_stripe_fc',

  async createLinkToken({ userId }) {
    const json = await plaid('/link/token/create', {
      user: { client_user_id: userId },
      client_name: 'Rent Payments',
      products: ['financial_connections'],
      country_codes: ['US'],
      language: 'en',
    });
    return { linkToken: json.link_token };
  },

  async exchangePublicToken({ publicToken, accountId }): Promise<LinkedAccount> {
    const exch = await plaid('/item/public_token/exchange', { public_token: publicToken });
    const accessToken = exch.access_token as string;

    const acct = await plaid('/accounts/get', { access_token: accessToken });
    const found = acct.accounts.find((a: { account_id: string }) => a.account_id === accountId) ?? acct.accounts[0];

    const stripeToken = await plaid('/processor/stripe/processor_token/create', {
      access_token: accessToken,
      account_id: found.account_id,
    });

    const bankAccount = await stripe('/customers', new URLSearchParams({
      'payment_method': stripeToken.stripe_bank_account_token,
    }));

    return {
      accessToken: stripeToken.stripe_bank_account_token,
      providerAccountId: bankAccount.id,
      bankName: found.name || 'Bank',
      mask: found.mask || '••••',
      accountType: found.subtype || 'checking',
    };
  },

  async initiatePayment(input: InitiateInput): Promise<InitiateResult> {
    const intent = await stripe('/payment_intents', new URLSearchParams({
      amount: input.amountCents.toString(),
      currency: 'usd',
      'payment_method_types[]': 'us_bank_account',
      'payment_method_data[type]': 'us_bank_account',
      'payment_method_data[us_bank_account][account_holder_type]': 'individual',
      'payment_method_data[us_bank_account][account_number]': input.providerAccountId,
      description: input.description,
    }));

    return {
      providerTransferId: intent.id,
      status: intent.status === 'succeeded' ? 'posted' : 'processing',
    };
  },

  async parseWebhook(req: Request): Promise<WebhookEvent[] | null> {
    const body = await req.json();
    if (body.type === 'payment_intent.succeeded') {
      return [{
        providerTransferId: body.data.object.id,
        newStatus: 'paid',
      }];
    }
    return null;
  },
};
