import { corsHeaders, getUser, json } from '../_shared/auth.ts';
import { getProvider } from '../_shared/payments/index.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const user = await getUser(req);
    if (!user) return json({ error: 'Unauthorized' }, 401);

    const provider = getProvider();
    const { linkToken } = await provider.createLinkToken({ userId: user.id });
    return json({ link_token: linkToken });
  } catch (e) {
    console.error('[payment-link-token]', e);
    return json({ error: (e as Error).message }, 500);
  }
});
