import type { PaymentProvider, ProviderName } from './types.ts';
import { plaidTransferProvider } from './plaid-transfer.ts';
import { plaidStripeFcProvider } from './plaid-stripe-fc.ts';

export function getProvider(): PaymentProvider {
  const name = (Deno.env.get('PAYMENT_PROVIDER') ?? 'plaid_transfer') as ProviderName;
  switch (name) {
    case 'plaid_stripe_fc':
      return plaidStripeFcProvider;
    case 'plaid_transfer':
    default:
      return plaidTransferProvider;
  }
}

export type { PaymentProvider } from './types.ts';
