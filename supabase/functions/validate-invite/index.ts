import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { invite_code } = await req.json();
    if (!invite_code || typeof invite_code !== "string") {
      return json({ error: "Missing invite code" }, 400);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    const code = invite_code.trim().toUpperCase();
    const { data: invite, error } = await admin
      .from("invite_codes")
      .select("code, role, email, first_name, last_name, max_uses, used_count, expires_at")
      .eq("code", code)
      .maybeSingle();

    if (error) return json({ error: "Database error" }, 500);
    if (!invite) return json({ error: "This invite code is not valid." }, 400);
    if (!invite.role) return json({ error: "Invite has no role assigned. Please contact support." }, 400);
    if (invite.used_count >= invite.max_uses) return json({ error: "This invite code has already been used." }, 400);
    if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
      return json({ error: "This invite code has expired." }, 400);
    }

    return json({
      success: true,
      invite: {
        code: invite.code,
        role: invite.role,
        email: invite.email ?? "",
        first_name: invite.first_name ?? "",
        last_name: invite.last_name ?? "",
      },
    });
  } catch (e) {
    console.error("validate-invite error", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
