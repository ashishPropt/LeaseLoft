// Provider-agnostic payment interface.

export type ProviderName = 'stripe_fc_ach';

export interface LinkedAccount {
  accessToken: string;
  providerAccountId: string;
  bankName: string;
  mask: string;
  accountType: string;
  connectedAccountId?: string;
}

export interface InitiateInput {
  accessToken: string;
  providerAccountId: string;
  amountCents: number;
  description: string;
  idempotencyKey: string;
  userId: string;
  userName: string;
  stripeAccount?: string;
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
  connectedAccountId?: string;
}

export interface PaymentProvider {
  name: ProviderName;
  createLinkToken(input: { userId: string; userName?: string; stripeAccount?: string }): Promise<{ linkToken: string; connectedAccountId?: string }>;
  exchangePublicToken(input: { publicToken?: string; accountId: string; stripeAccount?: string }): Promise<LinkedAccount>;
  initiatePayment(input: InitiateInput): Promise<InitiateResult>;
  parseWebhook(req: Request, rawBody: string): Promise<WebhookEvent[] | null>;
}
