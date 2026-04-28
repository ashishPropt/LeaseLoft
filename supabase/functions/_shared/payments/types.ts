// Provider-agnostic payment interface. Implementations live alongside this file.
// Swap providers by changing the PAYMENT_PROVIDER env var — no caller changes.

export type ProviderName = 'plaid_transfer' | 'plaid_stripe_fc';

export interface LinkedAccount {
  accessToken: string;
  providerAccountId: string;
  bankName: string;
  mask: string;
  accountType: string;
}

export interface InitiateInput {
  accessToken: string;
  providerAccountId: string;
  amountCents: number;
  description: string;
  idempotencyKey: string;
  userId: string;
  userName: string;
}

export interface InitiateResult {
  providerTransferId: string;
  status: 'processing' | 'posted' | 'failed';
  failureReason?: string;
}

export interface WebhookEvent {
  providerTransferId: string;
  newStatus: 'processing' | 'paid' | 'failed' | 'returned';
  failureReason?: string;
}

export interface PaymentProvider {
  name: ProviderName;
  createLinkToken(input: { userId: string }): Promise<{ linkToken: string }>;
  exchangePublicToken(input: { publicToken: string; accountId: string }): Promise<LinkedAccount>;
  initiatePayment(input: InitiateInput): Promise<InitiateResult>;
  parseWebhook(req: Request, rawBody: string): Promise<WebhookEvent[] | null>;
}
