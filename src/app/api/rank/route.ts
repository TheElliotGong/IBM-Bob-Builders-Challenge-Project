import { NextRequest, NextResponse } from "next/server";
import { filterCatalog } from "@/lib/filter";
import { rankVehicles } from "@/lib/ranker";
import { LAUNCH_CATALOG } from "@/data/index";
import type { ParsedMission, PriorityWeights } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
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
