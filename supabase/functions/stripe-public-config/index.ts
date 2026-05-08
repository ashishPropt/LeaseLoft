// Returns the Stripe publishable key for client-side embeds (e.g. Pricing Table).
import { corsHeaders, json } from '../_shared/auth.ts';

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const publishableKey = Deno.env.get('STRIPE_PUBLISHABLE_KEY') ?? '';
  return json({ publishableKey });
});
