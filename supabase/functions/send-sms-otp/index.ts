import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

async function sha256(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY")!;
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    const TWILIO_FROM = Deno.env.get("TWILIO_FROM_NUMBER");

    if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY missing" }, 500);
    if (!TWILIO_API_KEY) return json({ error: "TWILIO_API_KEY missing" }, 500);

    // Auth: identify the user from the bearer token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json({ error: "Invalid session" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const userId = userData.user.id;

    // Fetch profile for phone
    const { data: profile } = await admin.from("profiles").select("phone_e164").eq("id", userId).maybeSingle();
    if (!profile?.phone_e164) return json({ error: "No phone number on file" }, 400);

    // Rate limit: 1 send / 30s, 5 / hour
    const { data: recent } = await admin
      .from("otp_codes")
      .select("created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);
    const now = Date.now();
    if (recent && recent.length > 0) {
      const last = new Date(recent[0].created_at).getTime();
      if (now - last < 30_000) return json({ error: "Please wait before requesting another code" }, 429);
      const inLastHour = recent.filter((r) => now - new Date(r.created_at).getTime() < 3_600_000).length;
      if (inLastHour >= 5) return json({ error: "Too many requests. Try again in an hour." }, 429);
    }

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const code_hash = await sha256(code);
    const expires_at = new Date(now + 5 * 60_000).toISOString();

    const { error: insertErr } = await admin.from("otp_codes").insert({
      user_id: userId,
      code_hash,
      purpose: "login",
      expires_at,
    });
    if (insertErr) return json({ error: "Could not store code" }, 500);

    // Send via Twilio
    // Test mode: hardcoded From & To for virtual phone number testing.
    const TEST_NUMBER = "+18446439246";

    const tw = await fetch(`${GATEWAY_URL}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": TWILIO_API_KEY,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        To: TEST_NUMBER,
        From: TEST_NUMBER,
        Body: `Your LeaseLoft verification code is ${code}. It expires in 5 minutes.`,
      }),
    });
    const twData = await tw.json();
    if (!tw.ok) {
      console.error("Twilio error", twData);
      return json({ error: "SMS provider error", details: twData }, 502);
    }

    return json({ success: true });
  } catch (e) {
    console.error("send-sms-otp", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
