import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  MAX_FILE_BYTES,
  MAX_EXTRACTED_CHARS,
  resolveMime,
  extractTextFromBuffer,
} from "@/lib/extract";

export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req, { windowMs: 60_000, max: 20 });
  if (limited) return limited;

  try {
    // Fast-path size rejection using the Content-Length header
    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (contentLength > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File too large. Maximum allowed size is ${MAX_FILE_BYTES / 1024 / 1024} MB.` },
        { status: 413 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { error: 'Missing "file" field in multipart form data.' },
        { status: 400 }
      );
    }

    const mime = resolveMime(file.type ?? "", file.name);
    if (!mime) {
      return NextResponse.json(
        { error: "Unsupported file type. Please upload a .txt, .md, .pdf, or .docx file." },
        { status: 415 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();

    // Double-check actual size (Content-Length may be absent or wrong)
    if (arrayBuffer.byteLength > MAX_FILE_BYTES) {
      return NextResponse.json(
        { error: `File too large. Maximum allowed size is ${MAX_FILE_BYTES / 1024 / 1024} MB.` },
        { status: 413 }
      );
    }

    const buffer = Buffer.from(arrayBuffer);
    const raw = await extractTextFromBuffer(buffer, mime);
    const text = raw.slice(0, MAX_EXTRACTED_CHARS);

    if (!text.trim()) {
      return NextResponse.json(
        { error: "No text could be extracted from the uploaded file." },
        { status: 422 }
      );
    }

    return NextResponse.json({ text, truncated: raw.length > MAX_EXTRACTED_CHARS });
  } catch (err) {
    console.error("[/api/extract]", err);
    return NextResponse.json({ error: "Failed to extract text from the file." }, { status: 500 });
  }
}
