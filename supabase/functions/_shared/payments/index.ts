import type { PaymentProvider, ProviderName } from './types.ts';
import { stripeFcAchProvider } from './stripe-fc-ach.ts';

export function getProvider(): PaymentProvider {
  const name = (Deno.env.get('PAYMENT_PROVIDER') ?? 'stripe_fc_ach') as ProviderName;
  switch (name) {
    case 'stripe_fc_ach':
    default:
      return stripeFcAchProvider;
  }
}

export type { PaymentProvider } from './types.ts';
