import { NextRequest, NextResponse } from "next/server";
import { filterCatalog } from "@/lib/filter";
import { rankVehicles } from "@/lib/ranker";
import { LAUNCH_CATALOG } from "@/data/index";
import type { ParsedMission, PriorityWeights } from "@/lib/types";
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
    const weights: PriorityWeights = body?.weights ?? {
      cost: 1,
      schedule: 1,
      orbit_precision: 1,
    };

    if (!mission || typeof mission !== "object") {
      return NextResponse.json(
        { error: "Missing required field: mission (ParsedMission)" },
        { status: 400 }
      );
    }

    const matches = filterCatalog(mission, LAUNCH_CATALOG);
    const { ranked, eliminated } = rankVehicles(matches, mission, weights);

    return NextResponse.json({ ranked, eliminated });
  } catch (err) {
    console.error("[/api/rank]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
