# Opaque slugs for record URLs

## Goal

Stop exposing guessable/memorable UUIDs in the address bar. Today URLs look like:

```
/landlord/leases/8b1c...-uuid
/landlord/properties/2f9e...-uuid
```

After this change they look like:

```
/landlord/leases/k7Qx9pLm2vRt
/landlord/properties/aH3wYz8nB1cD
```

The route shape (`/landlord/leases/...`) stays the same — only the record identifier becomes a short, random, non-sequential token. Refresh, deep links, sharing, and React Router all keep working. Real access control stays where it belongs: `RequireAuth` + role checks + RLS.

Out of scope: section names like `/admin`, `/landlord`, `/tenant` stay readable. Encrypting those would force a HashRouter rewrite and break too much (we discussed this trade-off).

## Routes affected

Only two routes embed a record ID today:

- `/landlord/leases/:id` (and `/edit`)
- `/landlord/properties/:id`

Everything else (`/landlord/payments`, `/admin/requests`, etc.) is already a fixed path and needs no change.

## Approach

1. Add a `public_slug TEXT UNIQUE` column to `leases` and `properties`.
2. Backfill existing rows with a 12-char random slug (nanoid-style, URL-safe alphabet, no lookalikes).
3. Add a Postgres trigger to auto-generate `public_slug` on INSERT if not provided.
4. Update the two pages and all `<Link>` / `navigate()` call sites to use `public_slug` instead of `id`.
5. Update detail-page loaders to look up by `public_slug` instead of `id`.
6. Keep RLS exactly as it is — slug is just a lookup key, not a permission.

A 12-char slug from a 58-char alphabet is ~70 bits of entropy — not guessable, and short enough to look clean.

## Technical details

**Migration**

```sql
alter table public.leases     add column public_slug text unique;
alter table public.properties add column public_slug text unique;

create or replace function public.gen_public_slug()
returns text language plpgsql as $$
declare
  alphabet text := '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  result text := '';
  i int;
begin
  for i in 1..12 loop
    result := result || substr(alphabet, 1 + floor(random()*length(alphabet))::int, 1);
  end loop;
  return result;
end $$;

-- Backfill
update public.leases     set public_slug = public.gen_public_slug() where public_slug is null;
update public.properties set public_slug = public.gen_public_slug() where public_slug is null;

alter table public.leases     alter column public_slug set not null;
alter table public.properties alter column public_slug set not null;

-- Auto-assign on insert
create or replace function public.set_public_slug()
returns trigger language plpgsql as $$
begin
  if new.public_slug is null then
    new.public_slug := public.gen_public_slug();
  end if;
  return new;
end $$;

create trigger leases_set_public_slug     before insert on public.leases     for each row execute function public.set_public_slug();
create trigger properties_set_public_slug before insert on public.properties for each row execute function public.set_public_slug();
```

(Collision risk at 70 bits is effectively zero at our scale; the unique constraint will surface it if it ever happens.)

**Frontend changes**

- `src/pages/landlord/LeaseDetail.tsx` — read `:id` param as `slug`, query `leases` by `public_slug`. Update internal navigates (`/edit`, sibling lease links) to use `public_slug`.
- `src/pages/landlord/LeaseForm.tsx` — after save, navigate to `/landlord/leases/${row.public_slug}`.
- `src/pages/landlord/RentRoll.tsx` — link rows by `public_slug` instead of `leaseId`. Include `public_slug` in the select.
- `src/pages/landlord/Properties.tsx` — link rows by `public_slug`. Include in select.
- `src/pages/landlord/PropertyDetail.tsx` — load by `public_slug`; update any child links.
- `src/integrations/supabase/types.ts` regenerates automatically from the migration.

Route definitions in `App.tsx` stay the same (`:id` becomes the slug param — no rename needed, but I'll rename it to `:slug` in the two affected routes for clarity).

## What this does not do (and why)

- Does not hide `/admin`, `/landlord`, `/tenant` segment names. Those are fixed paths shared by everyone in that role; they aren't memorable secrets and access is gated by `RequireAuth` + roles.
- Does not encrypt the URL. The slug is opaque, not encrypted — there's no key to leak, nothing to decrypt client-side, and it's resistant to enumeration.
- Does not break existing bookmarks of UUID-based URLs by silent redirect. Old UUID links will simply 404 on the detail pages after this change. If you want a grace-period redirect (try slug first, fall back to id lookup for 30 days), say so and I'll add it.

## Deliverables

- 1 migration adding `public_slug` columns, backfill, and insert trigger
- Edits to 5 frontend files listed above
- No RLS changes, no auth changes, no new env vars