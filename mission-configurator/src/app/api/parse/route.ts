import { NextRequest, NextResponse } from "next/server";
import { parseMissionDescription } from "@/lib/parser";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const description: string = body?.description;

    if (!description || typeof description !== "string") {
      return NextResponse.json(
        { error: "Missing required field: description (string)" },
        { status: 400 }
      );
    }

    const parsed = await parseMissionDescription(description);
    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[/api/parse]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
