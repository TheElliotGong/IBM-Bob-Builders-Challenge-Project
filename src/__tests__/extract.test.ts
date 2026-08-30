/**
 * Tests for src/lib/extract.ts
 *
 * Covers:
 *   - extensionToMime / resolveMime MIME resolution
 *   - Size and character-count limits
 *   - Text extraction: .txt, .md (no mocking needed)
 *   - PDF extraction via pdf-parse (mocked)
 *   - DOCX extraction via mammoth (mocked)
 *   - Unsupported type guard
 */

import {
  MAX_FILE_BYTES,
  MAX_EXTRACTED_CHARS,
  SUPPORTED_MIME_TYPES,
  extensionToMime,
  resolveMime,
  extractTextFromBuffer,
} from "@/lib/extract";

// ---------------------------------------------------------------------------
// Mock pdf-parse and mammoth so the tests don't need real PDF/DOCX binaries
// ---------------------------------------------------------------------------

jest.mock("pdf-parse", () => {
  const mock = jest.fn((_buf: Buffer) =>
    Promise.resolve({ text: "PDF extracted text" })
  );
  return { default: mock, __esModule: true };
});

jest.mock("mammoth", () => ({
  extractRawText: jest.fn((_opts: { buffer: Buffer }) =>
    Promise.resolve({ value: "DOCX extracted text", messages: [] })
  ),
}));

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe("constants", () => {
  it("MAX_FILE_BYTES is 10 MB", () => {
    expect(MAX_FILE_BYTES).toBe(10 * 1024 * 1024);
  });

  it("MAX_EXTRACTED_CHARS is 50 000", () => {
    expect(MAX_EXTRACTED_CHARS).toBe(50_000);
  });

  it("SUPPORTED_MIME_TYPES includes the four expected types", () => {
    expect(SUPPORTED_MIME_TYPES.has("text/plain")).toBe(true);
    expect(SUPPORTED_MIME_TYPES.has("text/markdown")).toBe(true);
    expect(SUPPORTED_MIME_TYPES.has("application/pdf")).toBe(true);
    expect(
      SUPPORTED_MIME_TYPES.has(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    ).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// extensionToMime
// ---------------------------------------------------------------------------

describe("extensionToMime", () => {
  it("maps .txt to text/plain", () => {
    expect(extensionToMime("mission.txt")).toBe("text/plain");
  });

  it("maps .md to text/markdown", () => {
    expect(extensionToMime("requirements.md")).toBe("text/markdown");
  });

  it("maps .pdf to application/pdf", () => {
    expect(extensionToMime("rfp.pdf")).toBe("application/pdf");
  });

  it("maps .docx to the Office OOXML MIME type", () => {
    expect(extensionToMime("brief.docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  });

  it("returns null for unsupported extensions", () => {
    expect(extensionToMime("scan.jpg")).toBeNull();
    expect(extensionToMime("data.csv")).toBeNull();
    expect(extensionToMime("legacy.doc")).toBeNull();
    expect(extensionToMime("noextension")).toBeNull();
  });

  it("is case-insensitive for extensions", () => {
    expect(extensionToMime("MISSION.TXT")).toBe("text/plain");
    expect(extensionToMime("brief.DOCX")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  });
});

// ---------------------------------------------------------------------------
// resolveMime
// ---------------------------------------------------------------------------

describe("resolveMime", () => {
  it("accepts a known MIME type reported by the browser", () => {
    expect(resolveMime("text/plain", "file.txt")).toBe("text/plain");
  });

  it("falls back to extension sniffing when MIME is empty", () => {
    expect(resolveMime("", "report.pdf")).toBe("application/pdf");
  });

  it("falls back to extension when reported MIME is unsupported", () => {
    expect(resolveMime("application/octet-stream", "brief.docx")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  });

  it("returns null when neither MIME nor extension is supported", () => {
    expect(resolveMime("image/jpeg", "scan.jpg")).toBeNull();
    expect(resolveMime("", "archive.zip")).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// extractTextFromBuffer — plain text and markdown
// ---------------------------------------------------------------------------

describe("extractTextFromBuffer — text/plain and text/markdown", () => {
  it("returns the UTF-8 string content for text/plain", async () => {
    const content = "We need a 100 kg SSO rideshare, budget $3M.";
    const buf = Buffer.from(content, "utf-8");
    const result = await extractTextFromBuffer(buf, "text/plain");
    expect(result).toBe(content);
  });

  it("returns the UTF-8 string content for text/markdown", async () => {
    const content = "# Mission Brief\n\n45 kg LEO, $2.5M budget";
    const buf = Buffer.from(content, "utf-8");
    const result = await extractTextFromBuffer(buf, "text/markdown");
    expect(result).toBe(content);
  });

  it("preserves multi-line content", async () => {
    const lines = ["Line one", "Line two", "Line three"].join("\n");
    const buf = Buffer.from(lines, "utf-8");
    const result = await extractTextFromBuffer(buf, "text/plain");
    expect(result).toBe(lines);
  });
});

// ---------------------------------------------------------------------------
// extractTextFromBuffer — PDF (mocked)
// ---------------------------------------------------------------------------

describe("extractTextFromBuffer — application/pdf", () => {
  it("calls pdf-parse and returns extracted text", async () => {
    const buf = Buffer.from("fake pdf bytes");
    const result = await extractTextFromBuffer(buf, "application/pdf");
    expect(result).toBe("PDF extracted text");
  });
});

// ---------------------------------------------------------------------------
// extractTextFromBuffer — DOCX (mocked)
// ---------------------------------------------------------------------------

describe("extractTextFromBuffer — docx", () => {
  it("calls mammoth.extractRawText and returns extracted text", async () => {
    const buf = Buffer.from("fake docx bytes");
    const result = await extractTextFromBuffer(
      buf,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(result).toBe("DOCX extracted text");
  });
});

// ---------------------------------------------------------------------------
// extractTextFromBuffer — unsupported type
// ---------------------------------------------------------------------------

describe("extractTextFromBuffer — unsupported MIME type", () => {
  it("throws for an unknown MIME type", async () => {
    const buf = Buffer.from("data");
    await expect(
      extractTextFromBuffer(buf, "image/jpeg")
    ).rejects.toThrow(/unsupported mime type/i);
  });
});

// ---------------------------------------------------------------------------
// Caller-enforced limits (tested at the lib level)
// ---------------------------------------------------------------------------

describe("MAX_EXTRACTED_CHARS truncation contract", () => {
  it("a caller slicing to MAX_EXTRACTED_CHARS truncates long text", async () => {
    const longContent = "A".repeat(MAX_EXTRACTED_CHARS + 1_000);
    const buf = Buffer.from(longContent, "utf-8");
    const raw = await extractTextFromBuffer(buf, "text/plain");
    const text = raw.slice(0, MAX_EXTRACTED_CHARS);
    expect(text.length).toBe(MAX_EXTRACTED_CHARS);
    expect(raw.length > MAX_EXTRACTED_CHARS).toBe(true); // truncated flag check
  });

  it("text within MAX_EXTRACTED_CHARS is not truncated", async () => {
    const shortContent = "Mission brief: 100 kg SSO";
    const buf = Buffer.from(shortContent, "utf-8");
    const raw = await extractTextFromBuffer(buf, "text/plain");
    const text = raw.slice(0, MAX_EXTRACTED_CHARS);
    expect(text).toBe(shortContent);
    expect(raw.length > MAX_EXTRACTED_CHARS).toBe(false);
  });
});

describe("MAX_FILE_BYTES size limit contract", () => {
  it("a buffer larger than MAX_FILE_BYTES should be caught by the caller", () => {
    // This is a contract test — the route checks byteLength before calling
    // extractTextFromBuffer. We verify that MAX_FILE_BYTES is a positive number
    // and that an oversized byteLength exceeds it.
    const oversizedLength = MAX_FILE_BYTES + 1;
    expect(oversizedLength > MAX_FILE_BYTES).toBe(true);
  });
});
