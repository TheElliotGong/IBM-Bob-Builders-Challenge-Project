import { NextRequest, NextResponse } from "next/server";
import { filterCatalog } from "@/lib/filter";
import { LAUNCH_CATALOG } from "@/data/index";
import type { ParsedMission } from "@/lib/types";
import { checkRateLimit } from "@/lib/rateLimit";

const MAX_BODY_BYTES = 16_384;

export async function POST(req: NextRequest) {
  const limited = checkRateLimit(req, { windowMs: 60_000, max: 30 });
  if (limited) return limited;

  try {
    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 });
    }

    const body = await req.json();
    const mission: ParsedMission = body?.mission;

    if (!mission || typeof mission !== "object") {
      return NextResponse.json(
        { error: "Missing required field: mission (ParsedMission)" },
        { status: 400 }
      );
    }

    const matches = filterCatalog(mission, LAUNCH_CATALOG);
    return NextResponse.json({ matches });
  } catch (err) {
    console.error("[/api/filter]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
