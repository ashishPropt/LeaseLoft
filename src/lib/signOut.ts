import { supabase } from "@/integrations/supabase/client";

/**
 * Fully end the current user session:
 * - Sign out globally (revoke refresh tokens on the server across all devices/tabs)
 * - Clear any sb-* auth artifacts from localStorage and sessionStorage
 * - Hard-redirect to /signin so all in-memory state is dropped
 */
export async function signOutCompletely(redirectTo: string = "/signin") {
  // Purge local auth artifacts FIRST so any in-flight re-renders see no session
  // and can't trigger an interim <Navigate> before the hard redirect.
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

  // Fire global sign-out but do NOT await it — we don't want the SIGNED_OUT
  // event to cause RequireAuth to render a <Navigate> before our hard redirect.
  // The server-side revoke will complete in the background; tokens are already
  // gone from local storage above.
  try {
    void supabase.auth.signOut({ scope: "global" });
  } catch (err) {
    console.error("Sign out error", err);
  }

  // Single hard navigation — drops all in-memory state.
  window.location.replace(redirectTo);
}

