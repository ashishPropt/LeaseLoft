import { corsHeaders, getUser, json } from '../_shared/auth.ts';
import { getProvider } from '../_shared/payments/index.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const provider = getProvider();
    const { linkToken } = await provider.createLinkToken({ userId: user.id });
    const publishableKey = Deno.env.get('STRIPE_PUBLISHABLE_KEY') ?? '';
    return json({ link_token: linkToken, publishable_key: publishableKey });
  } catch (e) {
    console.error('[payment-link-token]', e);
    return json({ error: (e as Error).message }, 500);
  }
});
