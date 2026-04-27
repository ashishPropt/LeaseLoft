import { supabase } from "@/integrations/supabase/client";

/**
 * Fully end the current user session:
 * - Sign out globally (revoke refresh tokens on the server across all devices/tabs)
 * - Clear any sb-* auth artifacts from localStorage and sessionStorage
 * - Hard-redirect to /signin so all in-memory state is dropped
 */
export async function signOutCompletely(redirectTo: string = "/signin") {
  try {
    await supabase.auth.signOut({ scope: "global" });
  } catch (err) {
    console.error("Sign out error", err);
  }

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

  window.location.replace(redirectTo);
}
