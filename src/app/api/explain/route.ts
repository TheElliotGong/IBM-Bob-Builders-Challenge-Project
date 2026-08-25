import { NextRequest, NextResponse } from "next/server";
import { explainRecommendation } from "@/lib/explainer";
import type { RankedVehicle, ParsedMission, PriorityWeights } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const ranked: RankedVehicle[] = body?.ranked;
    const mission: ParsedMission = body?.mission;
    const weights: PriorityWeights = body?.weights ?? {
      cost: 1,
      schedule: 1,
      orbit_precision: 1,
    };

    if (!ranked || !Array.isArray(ranked) || !mission) {
      return NextResponse.json(
        { error: "Missing required fields: ranked (RankedVehicle[]) and mission (ParsedMission)" },
        { status: 400 }
      );
    }

    const result = await explainRecommendation(ranked, mission, weights);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/explain]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
