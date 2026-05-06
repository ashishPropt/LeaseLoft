export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

export const ALLOWED_DOCUMENT_MIME = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "text/csv",
] as const;

export const DOCUMENT_ACCEPT = ALLOWED_DOCUMENT_MIME.join(",");

export const DOCUMENT_LIMITS_HELP =
  "Max 25 MB. Allowed: PDF, PNG/JPEG/WEBP, Word (.docx), Excel (.xlsx), TXT, CSV.";

export function validateDocumentFile(file: File): string | null {
  if (file.size <= 0) return "File is empty.";
  if (file.size > MAX_DOCUMENT_BYTES) return "File too large (max 25 MB).";
  if (!ALLOWED_DOCUMENT_MIME.includes(file.type as typeof ALLOWED_DOCUMENT_MIME[number])) {
    return "File type not allowed.";
  }
  return null;
}

export function sanitizeFileName(name: string): string {
  return name.replace(/[^\w.\-]+/g, "_").slice(0, 120);
}
