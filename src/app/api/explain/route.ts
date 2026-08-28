import { NextRequest, NextResponse } from "next/server";
import { explainRecommendation } from "@/lib/explainer";
import type { RankedVehicle, ParsedMission, PriorityWeights } from "@/lib/types";
import { checkRateLimit } from "@/lib/rateLimit";

const MAX_BODY_BYTES = 32_768;

export async function POST(req: NextRequest) {
  // Explain calls Gemini — use a stricter per-minute cap
  const limited = checkRateLimit(req, { windowMs: 60_000, max: 10 });
  if (limited) return limited;

  try {
    const contentLength = Number(req.headers.get("content-length") ?? 0);
    if (contentLength > MAX_BODY_BYTES) {
      return NextResponse.json({ error: "Request body too large" }, { status: 413 });
    }

    const body = await req.json();
    const ranked: RankedVehicle[] = body?.ranked;
    const mission: ParsedMission = body?.mission;
    const weights: PriorityWeights = body?.weights ?? {
      cost: 1,
      schedule: 1,
      orbit_precision: 1,
    };
    const model: string = typeof body?.model === "string" ? body.model : "gemini-3.6-flash";

    if (!ranked || !Array.isArray(ranked) || !mission) {
      return NextResponse.json(
        { error: "Missing required fields: ranked (RankedVehicle[]) and mission (ParsedMission)" },
        { status: 400 }
      );
    }

    // Cap ranked array to the top 10 to prevent artificially large payloads
    const result = await explainRecommendation(ranked.slice(0, 10), mission, weights, model);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[/api/explain]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
