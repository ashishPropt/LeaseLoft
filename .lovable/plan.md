# Secure Document Sharing — Landlord + Tenant Uploads

Build a complete document upload + sharing system scoped per-lease. Landlord and tenant on the same lease can both upload and view; nobody else can (admins read-only). Enforce size and MIME limits in the DB, in storage policies, and in the UI.

## What we'll build

### 1. Private storage bucket + RLS
Create a private `documents` bucket (no public URLs — all access via 60-second signed URLs). Path convention: `lease/<lease_id>/<uuid>-<filename>`.

Policies on `storage.objects` (scoped to bucket `documents`):
- **INSERT**: caller is the lease's landlord OR tenant (joined via path's `lease_id` segment → `public.leases`)
- **SELECT**: landlord, tenant, or admin
- **DELETE**: only the original uploader (matched via owner_id on the documents row) or admin

### 2. DB-level validation (authoritative)
`BEFORE INSERT` trigger on `public.documents`:
- Reject if `size_bytes > 25 MB`
- Reject if `mime_type` not in allow-list
- Reject if caller is neither landlord nor tenant of `lease_id`

This guarantees limits hold even if a client bypasses UI checks.

### 3. RLS update for tenant uploads
Current `documents` table only allows owners to INSERT. Add policy so a tenant on the lease can also INSERT (with `owner_id = auth.uid()` and a valid `lease_id`).

### 4. Landlord UI — `src/pages/landlord/LeaseDetail.tsx`
Add a Documents card:
- Drag-and-drop / file picker (multi-file)
- Client pre-check (size + MIME); reject with toast before upload
- Upload → insert documents row → refresh list
- List with name, size, date, uploader badge ("You" / tenant name)
- Download (60s signed URL), delete (own uploads only)
- Helper text: "Max 25 MB. PDF, images, Word, Excel, text, CSV."

### 5. Tenant UI — `src/pages/tenant/Documents.tsx`
Add upload control mirroring landlord side:
- Same client pre-checks and helper text
- Uploader badge ("You" / "Landlord")
- Tenant can delete only files they uploaded
- Empty-state copy clarifying files are private to tenant + landlord

### 6. Shared client helper
New `src/lib/documentLimits.ts` exporting `MAX_BYTES = 25 * 1024 * 1024` and `ALLOWED_MIME` array, plus a `validateFile(file)` helper used by both pages.

## Security model

| Actor | Upload | View | Delete |
|---|---|---|---|
| Landlord on lease | yes | yes | own uploads |
| Tenant on lease | yes | yes | own uploads |
| Other users | no | no | no |
| Admin | no | yes | yes |

All file access via short-lived signed URLs only — bucket is private.

## Allow-list (initial)
`application/pdf`, `image/png`, `image/jpeg`, `image/webp`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` (.docx), `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` (.xlsx), `text/plain`, `text/csv`.

## Files touched
- New migration: bucket + storage policies + `validate_document_upload()` trigger + tenant INSERT policy on `public.documents` + landlord/admin DELETE policies
- New: `src/lib/documentLimits.ts`
- Edit: `src/pages/landlord/LeaseDetail.tsx` — add Documents card with upload/list/delete
- Edit: `src/pages/tenant/Documents.tsx` — add upload control + delete-own
