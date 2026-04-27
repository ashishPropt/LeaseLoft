import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { signOutCompletely } from "./signOut";

const DEFAULT_IDLE_MS = 10 * 60 * 1000; // 10 minutes
const STORAGE_KEY = "ll:lastActivity";

/**
 * Auto sign-out after `idleMs` of no user activity.
 * Activity is shared across tabs via localStorage so a busy tab keeps
 * an idle tab alive.
 */
export function useIdleLogout(idleMs: number = DEFAULT_IDLE_MS) {
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const logout = async () => {
      if (cancelled) return;
      toast.message("Signed out due to inactivity");
      await signOutCompletely("/signin");
    };

    const schedule = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(logout, idleMs);
    };

    const markActivity = () => {
      try { localStorage.setItem(STORAGE_KEY, String(Date.now())); } catch {}
      schedule();
    };

    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) schedule();
    };

    const events: (keyof WindowEventMap)[] = [
      "mousemove", "mousedown", "keydown", "touchstart", "scroll", "click", "visibilitychange",
    ];
    events.forEach((ev) => window.addEventListener(ev, markActivity, { passive: true }));
    window.addEventListener("storage", onStorage);

    markActivity();

    return () => {
      cancelled = true;
      if (timerRef.current) window.clearTimeout(timerRef.current);
      events.forEach((ev) => window.removeEventListener(ev, markActivity));
      window.removeEventListener("storage", onStorage);
    };
  }, [idleMs]);
}
