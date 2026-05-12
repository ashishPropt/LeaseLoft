import { corsHeaders, json, serviceClient } from '../_shared/auth.ts';
import { getProvider } from '../_shared/payments/index.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const rawBody = await req.text();
    const provider = getProvider();
    const events = await provider.parseWebhook(req, rawBody);
    if (!events || events.length === 0) return json({ ok: true, processed: 0 });

    const sb = serviceClient();
    let processed = 0;
    for (const ev of events) {
      const update: Record<string, unknown> = { status: ev.newStatus };
      if (ev.newStatus === 'paid') update.paid_at = new Date().toISOString();
      if (ev.failureReason) update.failure_reason = ev.failureReason;
      if (ev.connectedAccountId) update.connected_account_id = ev.connectedAccountId;

      const { data: updatedRows, error } = await sb
        .from('payments')
        .update(update)
        .eq('provider_transfer_id', ev.providerTransferId)
        .select('id, status');
      if (error) {
        console.error('[payment-webhook] update error', error);
        continue;
      }
      processed += updatedRows?.length ?? 0;
    }
    return json({ ok: true, processed });
  } catch (e) {
    console.error('[payment-webhook]', e);
    return json({ error: (e as Error).message }, 500);
  }
});
