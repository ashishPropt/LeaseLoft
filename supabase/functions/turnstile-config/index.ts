const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const siteKey = Deno.env.get('TURNSTILE_SITE_KEY') ?? '';
  return new Response(JSON.stringify({ site_key: siteKey }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
