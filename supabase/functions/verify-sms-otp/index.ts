import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { code, device_id } = await req.json();
    if (!code || typeof code !== "string" || code.length !== 6) {
      return json({ error: "Invalid code format" }, 400);
    }
    if (!device_id || typeof device_id !== "string") {
      return json({ error: "Missing device_id" }, 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Invalid session" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const userId = userData.user.id;
    const code_hash = await sha256(code);

    // Find latest unconsumed OTP
    const { data: otp } = await admin
      .from("otp_codes")
      .select("*")
      .eq("user_id", userId)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!otp) return json({ error: "No active code. Please request a new one." }, 400);
    if (new Date(otp.expires_at) < new Date()) {
      return json({ error: "Code expired. Please request a new one." }, 400);
    }
    if (otp.attempts >= 5) {
      await admin.from("otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", otp.id);
      return json({ error: "Too many attempts. Please request a new code." }, 400);
    }

    if (otp.code_hash !== code_hash) {
      await admin.from("otp_codes").update({ attempts: otp.attempts + 1 }).eq("id", otp.id);
      return json({ error: "Incorrect code" }, 400);
    }

    // Consume
    await admin.from("otp_codes").update({ consumed_at: new Date().toISOString() }).eq("id", otp.id);

    // Mark phone verified (first time)
    await admin
      .from("profiles")
      .update({ phone_verified_at: new Date().toISOString() })
      .eq("id", userId)
      .is("phone_verified_at", null);

    // Create / refresh MFA session (30 days)
    const expires_at = new Date(Date.now() + 30 * 24 * 60 * 60_000).toISOString();
    await admin
      .from("mfa_sessions")
      .upsert(
        { user_id: userId, device_id, verified_at: new Date().toISOString(), expires_at },
        { onConflict: "user_id,device_id" },
      );

    return json({ success: true });
  } catch (e) {
    console.error("verify-sms-otp", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
