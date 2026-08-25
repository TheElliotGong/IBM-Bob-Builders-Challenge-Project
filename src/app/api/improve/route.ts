import { NextRequest, NextResponse } from "next/server";
import { improveMissionDescription } from "@/lib/improver";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const description: unknown = body?.description;
    const missing: unknown = body?.missing ?? [];

    if (!description || typeof description !== "string") {
      return NextResponse.json(
        { error: "Missing required field: description (string)" },
        { status: 400 }
      );
    }

    if (!Array.isArray(missing)) {
      return NextResponse.json(
        { error: "Optional field missing must be an array of strings" },
        { status: 400 }
      );
    }

    const result = await improveMissionDescription(
      description,
      (missing as unknown[]).filter((x): x is string => typeof x === "string")
    );
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/improve]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
