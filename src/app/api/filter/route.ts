import { NextRequest, NextResponse } from "next/server";
import { filterCatalog } from "@/lib/filter";
import { LAUNCH_CATALOG } from "@/data/index";
import type { ParsedMission } from "@/lib/types";

export async function POST(req: NextRequest) {
  try {
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
