/**
 * Tests for the LLM parser path (GEMINI_API_KEY set).
 *
 * This is the path that actually has to cope with arbitrary user phrasing —
 * the regex heuristic in parser.test.ts is only the offline safety net. The
 * Gemini SDK is replaced by the manual mock in `__mocks__/@google/genai.ts`,
 * so these tests are deterministic and never touch the network.
 */
import { parseMissionDescription } from "@/lib/parser";
import {
  __lastApiKey,
  __lastRequest,
  __queueError,
  __queueJson,
  __queueText,
  __requestCount,
  __reset,
  parsedMissionJson,
} from "./helpers/genaiMock";

beforeEach(() => {
  __reset();
  process.env.GEMINI_API_KEY = "test-key";
});

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
});

// ---------------------------------------------------------------------------
// Request shape
// ---------------------------------------------------------------------------
describe("parseMissionDescription — request sent to Gemini", () => {
  it("passes the description through verbatim as the prompt contents", async () => {
    const input = "Roughly a quarter-tonne bus, polar, sometime next year.";
    __queueJson(parsedMissionJson());

    await parseMissionDescription(input);

    expect(__lastRequest()?.contents).toBe(input);
  });

  it("constructs the client with the configured API key", async () => {
    __queueJson(parsedMissionJson());
    await parseMissionDescription("anything");
    expect(__lastApiKey()).toBe("test-key");
  });

  it("requests deterministic JSON output", async () => {
    __queueJson(parsedMissionJson());
    await parseMissionDescription("anything");

    const config = __lastRequest()?.config;
    expect(config?.responseMimeType).toBe("application/json");
    expect(config?.temperature).toBe(0);
    expect(config?.systemInstruction).toMatch(/payload_mass_kg/);
  });

  it("calls the model exactly once per parse", async () => {
    __queueJson(parsedMissionJson());
    await parseMissionDescription("anything");
    expect(__requestCount()).toBe(1);
  });

  it("never calls the model when no API key is configured", async () => {
    delete process.env.GEMINI_API_KEY;
    await parseMissionDescription("150 kg to SSO");
    expect(__requestCount()).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Freeform input — the whole reason the LLM path exists
// ---------------------------------------------------------------------------
describe("parseMissionDescription — freeform phrasing the heuristic cannot reach", () => {
  const cases: Array<{
    label: string;
    input: string;
    model: Record<string, unknown>;
  }> = [
    {
      label: "imperial units and a vague deadline",
      input:
        "We've got a 220 lb bird that has to be in a sun-sync orbit sometime in the next year and a half. Budget's around two and a half million.",
      model: parsedMissionJson({
        payload_mass_kg: 99.8,
        orbit_type: "SSO",
        budget_usd: 2_500_000,
        schedule_months: 18,
        parse_confidence: "medium",
      }),
    },
    {
      label: "conversational, no numerals at all",
      input:
        "Small cubesat, nothing fancy — just needs to get to low earth orbit. We can spend about half a million and we're not in a rush.",
      model: parsedMissionJson({
        payload_mass_kg: null,
        orbit_type: "LEO",
        budget_usd: 500_000,
        parse_confidence: "low",
      }),
    },
    {
      label: "requirements buried in prose",
      input:
        "Our comms platform masses just under one and a half tonnes and needs a geostationary transfer injection. The programme office has authorised fifteen million dollars and wants it flying inside two years, with the inclination left to us.",
      model: parsedMissionJson({
        payload_mass_kg: 1450,
        orbit_type: "GTO",
        budget_usd: 15_000_000,
        schedule_months: 24,
        inclination_flexibility_required: "customer-defined",
        parse_confidence: "high",
      }),
    },
    {
      label: "altitude in miles",
      input: "Put 60 kilos at about 340 miles up, we don't care about inclination.",
      model: parsedMissionJson({
        payload_mass_kg: 60,
        orbit_type: "LEO",
        target_altitude_km: 547,
        inclination_flexibility_required: "any",
        parse_confidence: "medium",
      }),
    },
  ];

  it.each(cases)("returns the model's structured reading — $label", async ({ input, model }) => {
    __queueJson(model);

    const result = await parseMissionDescription(input);

    expect(result).toEqual({ ...model, raw_input: input });
  });

  it("preserves raw_input even though the model never returns it", async () => {
    const input = "something the model paraphrases heavily";
    __queueJson(parsedMissionJson({ payload_mass_kg: 10 }));

    const result = await parseMissionDescription(input);

    expect(result.raw_input).toBe(input);
  });
});

// ---------------------------------------------------------------------------
// Degradation — bad model output must never reach the caller
// ---------------------------------------------------------------------------
describe("parseMissionDescription — falls back when the model misbehaves", () => {
  it("falls back to the heuristic when the response is not JSON", async () => {
    __queueText("Sure! Here's your mission: 150 kg to SSO.");

    const result = await parseMissionDescription("150 kg to SSO");

    expect(result.payload_mass_kg).toBe(150);
    expect(result.orbit_type).toBe("SSO");
    expect(result.parse_confidence).toBe("low");
  });

  it("falls back when the JSON violates the schema", async () => {
    __queueJson(parsedMissionJson({ orbit_type: "MOON", payload_mass_kg: "heavy" }));

    const result = await parseMissionDescription("150 kg to SSO");

    expect(result.orbit_type).toBe("SSO");
    expect(result.parse_confidence).toBe("low");
  });

  it("falls back when the model returns an empty body", async () => {
    __queueText(undefined);

    const result = await parseMissionDescription("150 kg to SSO");

    expect(result.payload_mass_kg).toBe(150);
    expect(result.parse_confidence).toBe("low");
  });

  it("falls back when the SDK throws", async () => {
    __queueError("503 Service Unavailable");

    const result = await parseMissionDescription("budget $5M, 100 kg SSO");

    expect(result.budget_usd).toBe(5_000_000);
    expect(result.parse_confidence).toBe("low");
  });

  it("still preserves raw_input on the fallback path", async () => {
    const input = "totally unparseable gibberish";
    __queueError("network down");

    const result = await parseMissionDescription(input);

    expect(result.raw_input).toBe(input);
  });
});
