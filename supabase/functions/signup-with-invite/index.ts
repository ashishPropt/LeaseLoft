import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone_e164: string;
  invite_code: string;
}

function isE164(phone: string) {
  return /^\+[1-9]\d{6,14}$/.test(phone);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = (await req.json()) as Body;

    // Validation
    if (!body.email || !body.password || !body.first_name || !body.last_name || !body.phone_e164 || !body.invite_code) {
      return json({ error: "Missing required fields" }, 400);
    }
    if (body.password.length < 8) return json({ error: "Password must be at least 8 characters" }, 400);
    if (!isE164(body.phone_e164)) return json({ error: "Phone must be in E.164 format (e.g. +15558675310)" }, 400);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Pre-validate invite without consuming
    const { data: invite, error: inviteErr } = await admin
      .from("invite_codes")
      .select("*")
      .eq("code", body.invite_code.trim().toUpperCase())
      .maybeSingle();
    if (inviteErr) return json({ error: "Database error" }, 500);
    if (!invite) return json({ error: "This invite code is not valid." }, 400);
    if (invite.used_count >= invite.max_uses) return json({ error: "This invite code has already been used." }, 400);
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) return json({ error: "This invite code has expired." }, 400);
    if (invite.email && invite.email.toLowerCase() !== body.email.toLowerCase()) {
      return json({ error: "This invite was sent to a different email address." }, 400);
    }

    // Create user (auto-confirm so they can sign in; phone still needs SMS verification gate)
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
      user_metadata: {
        first_name: body.first_name,
        last_name: body.last_name,
        phone_e164: body.phone_e164,
      },
    });
    if (createErr || !created.user) {
      return json({ error: createErr?.message || "Could not create account" }, 400);
    }

    // Redeem invite atomically
    const { data: redeem, error: redeemErr } = await admin.rpc("redeem_invite_code", {
      _code: body.invite_code,
      _user_id: created.user.id,
    });
    if (redeemErr || !redeem?.[0]?.success) {
      // Rollback user
      await admin.auth.admin.deleteUser(created.user.id);
      return json({ error: redeem?.[0]?.message || "Could not redeem invite" }, 400);
    }

    return json({
      success: true,
      user_id: created.user.id,
      role: redeem[0].role,
    });
  } catch (e) {
    console.error("signup-with-invite error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
