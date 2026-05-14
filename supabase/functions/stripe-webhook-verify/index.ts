// Admin-only diagnostics: verifies that the Stripe webhook endpoints required for
// ACH (platform + Connect) are configured with the right event types AND that
// recently received webhook events have actually been written to the payments
// table (status / paid_at / connected_account_id / failure_reason).
//
// Returns a structured report so the dashboard / CI can fail fast on drift.

import { corsHeaders, getUser, json, serviceClient } from '../_shared/auth.ts';

const STRIPE_SECRET_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';

// Events the parseWebhook handler in stripe-fc-ach.ts maps to payment status.
const REQUIRED_PAYMENT_EVENTS = [
  'payment_intent.succeeded',
  'payment_intent.processing',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
  'charge.refunded',
  'charge.dispute.created',
];

// Events strongly recommended for ACH lifecycle visibility (mandate + connected
// account health). Missing these is a WARNING, not a hard failure.
const RECOMMENDED_PAYMENT_EVENTS = [
  'payment_intent.requires_action',
  'mandate.updated',
];

const REQUIRED_CONNECT_EVENTS = [
  'account.updated',
  'account.application.deauthorized',
];

async function stripeGet(path: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: { Authorization: `Bearer ${STRIPE_SECRET_KEY}` },
  });
  const j = await res.json();
  if (!res.ok) throw new Error(j.error?.message || `Stripe ${path} failed`);
  return j;
}

type Endpoint = {
  id: string;
  url: string;
  status: string;
  enabled_events: string[];
  api_version?: string;
  description?: string;
  metadata?: Record<string, string>;
  application?: string | null;
};

type EndpointReport = {
  endpoint_id: string;
  url: string;
  status: string;
  enabled_events: string[];
  is_wildcard: boolean;
  missing_required: string[];
  missing_recommended: string[];
};

function evaluateEndpoint(
  ep: Endpoint,
  required: string[],
  recommended: string[],
): EndpointReport {
  const enabled = new Set(ep.enabled_events ?? []);
  const isWildcard = enabled.has('*');
  const missingRequired = isWildcard ? [] : required.filter((e) => !enabled.has(e));
  const missingRecommended = isWildcard ? [] : recommended.filter((e) => !enabled.has(e));
  return {
    endpoint_id: ep.id,
    url: ep.url,
    status: ep.status,
    enabled_events: ep.enabled_events ?? [],
    is_wildcard: isWildcard,
    missing_required: missingRequired,
    missing_recommended: missingRecommended,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const sb = serviceClient();
    const { data: roleRow } = await sb
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle();
    if (!roleRow) return json({ error: 'Admin only' }, 403);

    if (!STRIPE_SECRET_KEY) return json({ error: 'STRIPE_SECRET_KEY not configured' }, 500);

    // 1. Fetch all webhook endpoints from Stripe.
    const list = await stripeGet('/webhook_endpoints?limit=100');
    const endpoints: Endpoint[] = list.data ?? [];

    // Connect-flagged endpoints have application set; account-only endpoints don't.
    const platformEndpoints = endpoints.filter((e) => !e.application);
    const connectEndpoints = endpoints.filter((e) => !!e.application);

    const platformReports = platformEndpoints.map((ep) =>
      evaluateEndpoint(ep, REQUIRED_PAYMENT_EVENTS, RECOMMENDED_PAYMENT_EVENTS),
    );
    const connectReports = connectEndpoints.map((ep) =>
      evaluateEndpoint(ep, [...REQUIRED_PAYMENT_EVENTS, ...REQUIRED_CONNECT_EVENTS], RECOMMENDED_PAYMENT_EVENTS),
    );

    // An event is "covered" if at least one healthy (enabled) endpoint of the
    // right kind subscribes to it (or to '*').
    const coverFn = (reports: EndpointReport[], event: string) =>
      reports.some((r) => r.status === 'enabled' && (r.is_wildcard || r.enabled_events.includes(event)));

    const platformCoverage = REQUIRED_PAYMENT_EVENTS.map((e) => ({
      event: e,
      covered: coverFn(platformReports, e),
    }));
    const connectCoverage = [...REQUIRED_PAYMENT_EVENTS, ...REQUIRED_CONNECT_EVENTS].map((e) => ({
      event: e,
      covered: coverFn(connectReports, e),
    }));

    const missingPlatform = platformCoverage.filter((c) => !c.covered).map((c) => c.event);
    const missingConnect = connectCoverage.filter((c) => !c.covered).map((c) => c.event);

    // 2. Probe the database to confirm recent webhook writes have landed.
    // Look at the last 30 days of payments that have a provider_transfer_id (i.e.
    // went through Stripe) and bucket them by status to surface any stuck rows.
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data: recentPayments, error: recentErr } = await sb
      .from('payments')
      .select('id, status, paid_at, provider_transfer_id, connected_account_id, failure_reason, updated_at, created_at')
      .not('provider_transfer_id', 'is', null)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(500);

    const buckets = { paid: 0, processing: 0, failed: 0, returned: 0, pending: 0, other: 0 };
    const stuckProcessing: Array<Record<string, unknown>> = [];
    const missingConnectedAccount: Array<Record<string, unknown>> = [];
    const paidWithoutTimestamp: Array<Record<string, unknown>> = [];

    const fortyEightHoursAgo = Date.now() - 48 * 60 * 60 * 1000;

    for (const p of recentPayments ?? []) {
      const s = (p.status as string) ?? 'other';
      if (s in buckets) (buckets as Record<string, number>)[s]++;
      else buckets.other++;

      if (p.status === 'processing' && new Date(p.updated_at as string).getTime() < fortyEightHoursAgo) {
        stuckProcessing.push({
          payment_id: p.id,
          provider_transfer_id: p.provider_transfer_id,
          updated_at: p.updated_at,
        });
      }
      if (!p.connected_account_id) {
        missingConnectedAccount.push({ payment_id: p.id, provider_transfer_id: p.provider_transfer_id });
      }
      if (p.status === 'paid' && !p.paid_at) {
        paidWithoutTimestamp.push({ payment_id: p.id, provider_transfer_id: p.provider_transfer_id });
      }
    }

    // 3. Optional spot-check: verify the most recent succeeded PI's row in DB
    // matches what Stripe says (proves the webhook wrote the right thing).
    let liveSpotCheck: Record<string, unknown> | null = null;
    const lastPaid = (recentPayments ?? []).find((p) => p.status === 'paid' && p.provider_transfer_id);
    if (lastPaid?.provider_transfer_id && lastPaid.connected_account_id) {
      try {
        const res = await fetch(
          `https://api.stripe.com/v1/payment_intents/${lastPaid.provider_transfer_id}`,
          {
            headers: {
              Authorization: `Bearer ${STRIPE_SECRET_KEY}`,
              'Stripe-Account': lastPaid.connected_account_id as string,
            },
          },
        );
        const pi = await res.json();
        liveSpotCheck = {
          payment_id: lastPaid.id,
          provider_transfer_id: lastPaid.provider_transfer_id,
          db_status: lastPaid.status,
          stripe_status: pi?.status,
          matches: pi?.status === 'succeeded',
        };
      } catch (e) {
        liveSpotCheck = { error: (e as Error).message };
      }
    }

    const ok = missingPlatform.length === 0
      && missingConnect.length === 0
      && stuckProcessing.length === 0
      && paidWithoutTimestamp.length === 0;

    return json({
      ok,
      generated_at: new Date().toISOString(),
      stripe: {
        platform_endpoints: platformReports,
        connect_endpoints: connectReports,
        platform_coverage: platformCoverage,
        connect_coverage: connectCoverage,
        missing_platform_events: missingPlatform,
        missing_connect_events: missingConnect,
      },
      database: {
        window_days: 30,
        sample_size: recentPayments?.length ?? 0,
        sample_error: recentErr?.message ?? null,
        status_buckets: buckets,
        stuck_processing_over_48h: stuckProcessing,
        paid_without_paid_at: paidWithoutTimestamp,
        missing_connected_account: missingConnectedAccount.slice(0, 25),
        missing_connected_account_count: missingConnectedAccount.length,
      },
      live_spot_check: liveSpotCheck,
      required_events: {
        platform: REQUIRED_PAYMENT_EVENTS,
        connect: [...REQUIRED_PAYMENT_EVENTS, ...REQUIRED_CONNECT_EVENTS],
        recommended: RECOMMENDED_PAYMENT_EVENTS,
      },
    });
  } catch (e) {
    console.error('[stripe-webhook-verify]', e);
    return json({ error: (e as Error).message }, 500);
  }
});
