// Disconnects the landlord's Stripe Connect account from this app.
// Clears stored Stripe Connect fields on the profile. Does NOT delete the
// account in Stripe (Express accounts are managed by Stripe and the user
// can manage/close them from their Stripe dashboard).
import { corsHeaders, getUser, json, serviceClient } from '../_shared/auth.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const sb = serviceClient();
    const { error } = await sb.from('profiles').update({
      stripe_connect_account_id: null,
      stripe_connect_charges_enabled: false,
      stripe_connect_payouts_enabled: false,
      stripe_connect_details_submitted: false,
      stripe_connect_updated_at: new Date().toISOString(),
    }).eq('id', user.id);
    if (error) throw error;

    return json({ disconnected: true });
  } catch (e) {
    console.error('[stripe-connect-disconnect]', e);
    return json({ error: (e as Error).message }, 500);
  }
});
