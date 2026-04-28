export function money(n: number | null | undefined) {
  const v = Number(n ?? 0);
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(v);
}

// Parse date-only strings (YYYY-MM-DD) as LOCAL midnight to avoid UTC→local
// shifts that can move the displayed day by ±1 in non-UTC timezones.
function toLocalDate(d: string | Date): Date {
  if (d instanceof Date) return d;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(d);
}

export function shortDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  return toLocalDate(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function monthDay(d: string | Date | null | undefined) {
  if (!d) return "—";
  return toLocalDate(d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function initials(name: string | null | undefined) {
  if (!name) return "??";
  return name.trim().split(/\s+/).map(p => p[0]).slice(0, 2).join("").toUpperCase();
}
