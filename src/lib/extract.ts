/**
 * Server-side text extraction utilities for uploaded documents.
 *
 * Supports .txt, .md, .pdf, and .docx files.
 * PDF and DOCX extraction is handled by pdf-parse and mammoth respectively,
 * loaded via dynamic imports so they stay out of the Edge runtime / browser bundle.
 */

/** Maximum file size in bytes (10 MB). */
export const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Maximum characters returned after extraction (50 k). */
export const MAX_EXTRACTED_CHARS = 50_000;

/** MIME types we accept. */
export const SUPPORTED_MIME_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

/**
 * Map a file extension to its canonical MIME type.
 * Returns null for unrecognised extensions.
 */
export function extensionToMime(filename: string): string | null {
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "txt":  return "text/plain";
    case "md":   return "text/markdown";
    case "pdf":  return "application/pdf";
    case "docx": return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default:     return null;
  }
}

/**
 * Resolve the effective MIME type for an uploaded file.
 * Prefers the MIME type reported by the browser; falls back to extension sniffing.
 * Returns null if neither produces a supported type.
 */
export function resolveMime(reportedMime: string, filename: string): string | null {
  if (reportedMime && SUPPORTED_MIME_TYPES.has(reportedMime)) return reportedMime;
  const guessed = extensionToMime(filename);
  if (guessed && SUPPORTED_MIME_TYPES.has(guessed)) return guessed;
  return null;
}

/**
 * Extract plain text from a buffer given its resolved MIME type.
 *
 * Throws if the MIME type is unsupported.
 */
export async function extractTextFromBuffer(
  buffer: Buffer,
  mime: string
): Promise<string> {
  if (mime === "text/plain" || mime === "text/markdown") {
    return buffer.toString("utf-8");
  }

  if (mime === "application/pdf") {
    // pdf-parse ships both CJS and ESM builds; the default export location differs
    const mod = await import("pdf-parse");
    const pdfParse = (mod as { default?: (buf: Buffer) => Promise<{ text: string }> }).default ?? (mod as unknown as (buf: Buffer) => Promise<{ text: string }>);
    const data = await pdfParse(buffer);
    return data.text;
  }

  if (
    mime ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  throw new Error(`Unsupported MIME type: ${mime}`);
}
