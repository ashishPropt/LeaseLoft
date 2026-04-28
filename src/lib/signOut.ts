import { supabase } from "@/integrations/supabase/client";

/**
 * Fully end the current user session in a single navigation:
 *  1. Purge sb-* / supabase auth artifacts from local + session storage so any
 *     in-flight re-renders see no session.
 *  2. Fire a local sign-out (no network) — this clears the in-memory client
 *     session without emitting a SIGNED_OUT round-trip that would cause
 *     RequireAuth to <Navigate> before our hard redirect.
 *  3. Kick off a background global revoke (fire-and-forget) so refresh tokens
 *     are invalidated server-side across devices.
 *  4. Hard-redirect once to drop all in-memory state.
 */
let signingOut = false;

export async function signOutCompletely(redirectTo: string = "/signin") {
  if (signingOut) return;
  signingOut = true;

  try {
    const purge = (storage: Storage) => {
      const keys: string[] = [];
      for (let i = 0; i < storage.length; i++) {
        const k = storage.key(i);
        if (k && (k.startsWith("sb-") || k.includes("supabase"))) keys.push(k);
      }
      keys.forEach((k) => storage.removeItem(k));
    };
    purge(localStorage);
    purge(sessionStorage);
  } catch (err) {
    console.error("Storage purge error", err);
  }

  // Local sign-out: clears in-memory session without a network call.
  // This avoids emitting a SIGNED_OUT event that would race our redirect.
  try {
    void supabase.auth.signOut({ scope: "local" });
  } catch (err) {
    console.error("Local sign out error", err);
  }

  // Background server-side revoke. Don't await — we're navigating away.
  try {
    void fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/logout?scope=global`, {
      method: "POST",
      keepalive: true,
      headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY },
    }).catch(() => {});
  } catch {
    /* noop */
  }

  // Single hard navigation — drops all in-memory state.
  window.location.replace(redirectTo);
}
