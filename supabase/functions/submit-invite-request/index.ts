import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function clean(v: unknown, max: number) {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    const first_name = clean(body.first_name, 100);
    const last_name = clean(body.last_name, 100);
    const email = clean(body.email, 255).toLowerCase();
    const requested_role = clean(body.requested_role, 20);
    const note = body.note ? clean(body.note, 1000) : null;
    const turnstileToken = clean(body.turnstile_token, 4096);

    if (!first_name) return json({ error: 'First name is required' }, 400);
    if (!last_name) return json({ error: 'Last name is required' }, 400);
    if (!email || !EMAIL_RE.test(email)) return json({ error: 'Valid email is required' }, 400);
    if (requested_role !== 'landlord' && requested_role !== 'tenant') {
      return json({ error: 'Role must be landlord or tenant' }, 400);
    }
    if (!turnstileToken) return json({ error: 'Human verification required' }, 400);

    const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
    if (!secret) {
      console.error('[submit-invite-request] TURNSTILE_SECRET_KEY not configured');
      return json({ error: 'Server misconfiguration' }, 500);
    }

    // Verify Turnstile token with Cloudflare
    const remoteIp = req.headers.get('cf-connecting-ip')
      || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || '';
    const verifyForm = new FormData();
    verifyForm.append('secret', secret);
    verifyForm.append('response', turnstileToken);
    if (remoteIp) verifyForm.append('remoteip', remoteIp);

    const verifyRes = await fetch(
      'https://challenges.cloudflare.com/turnstile/v0/siteverify',
      { method: 'POST', body: verifyForm },
    );
    const verifyData = await verifyRes.json() as { success: boolean; 'error-codes'?: string[] };

    if (!verifyData.success) {
      console.warn('[submit-invite-request] Turnstile failed', verifyData['error-codes']);
      return json({ error: 'Human verification failed. Please try again.' }, 400);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const sb = createClient(supabaseUrl, serviceKey);

    const { error } = await sb.from('invite_requests').insert({
      first_name,
      last_name,
      email,
      requested_role,
      note,
    });

    if (error) {
      console.error('[submit-invite-request] insert failed', error);
      return json({ error: 'Could not save request' }, 500);
    }

    // Fire-and-forget thank-you email (do not block the response on email)
    try {
      const { error: emailError } = await sb.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'invite-request-received',
          recipientEmail: email,
          idempotencyKey: `invite-received-${email}-${Date.now()}`,
          templateData: { firstName: first_name, requestedRole: requested_role },
        },
      });
      if (emailError) {
        console.warn('[submit-invite-request] email send failed', emailError);
      }
    } catch (e) {
      console.warn('[submit-invite-request] email send failed', e);
    }

    return json({ success: true });
  } catch (e) {
    console.error('[submit-invite-request]', e);
    return json({ error: (e as Error).message }, 500);
  }
});
