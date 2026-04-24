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
      return json({ error: "Please fill in all required fields." });
    }
    if (body.password.length < 8) return json({ error: "Password must be at least 8 characters." });
    if (!isE164(body.phone_e164)) return json({ error: "Phone must be a valid mobile number." });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const normalizedCode = body.invite_code.trim().toUpperCase();

    // Pre-validate invite without consuming
    const { data: invite, error: inviteErr } = await admin
      .from("invite_codes")
      .select("*")
      .eq("code", normalizedCode)
      .maybeSingle();
    if (inviteErr) return json({ error: "We couldn't verify your invite right now. Please try again." });
    if (!invite) return json({ error: "This invite code is not valid." });
    if (invite.used_count >= invite.max_uses) return json({ error: "This invite code has already been used." });
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) return json({ error: "This invite code has expired." });
    if (invite.email && invite.email.toLowerCase() !== body.email.toLowerCase()) {
      return json({ error: "This invite was sent to a different email address." });
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
      const msg = createErr?.message || "Could not create account";
      const friendly = /already registered|already exists|duplicate/i.test(msg)
        ? "An account with this email already exists. Try signing in instead."
        : msg;
      return json({ error: friendly });
    }

    // Redeem invite atomically
    const { data: redeem, error: redeemErr } = await admin.rpc("redeem_invite_code", {
      _code: normalizedCode,
      _user_id: created.user.id,
    });
    if (redeemErr || !redeem?.[0]?.success) {
      // Rollback user
      await admin.auth.admin.deleteUser(created.user.id);
      console.error("redeem failed", { redeemErr, redeem, normalizedCode });
      return json({ error: redeem?.[0]?.message || "We couldn't redeem your invite. Please try again or contact support." });
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
