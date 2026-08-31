/**
 * Tests for the LLM improvement path (GEMINI_API_KEY set).
 *
 * The fallback path (improver.test.ts) can only ever hand back the static
 * question table; this path is what turns a vague description into concrete
 * follow-up questions and a rewrite. The SDK is replaced by the manual mock in
 * `__mocks__/@google/genai.ts`.
 */
import { improveMissionDescription } from "@/lib/improver";
import {
  __lastRequest,
  __queueError,
  __queueJson,
  __queueText,
  __requestCount,
  __reset,
} from "./helpers/genaiMock";

let consoleError: jest.SpyInstance;

beforeEach(() => {
  __reset();
  process.env.GEMINI_API_KEY = "test-key";
  consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  delete process.env.GEMINI_API_KEY;
  consoleError.mockRestore();
});

function improveJson(overrides: Record<string, unknown> = {}) {
  return {
    missing_fields: [],
    clarifying_questions: [],
    suggested_rewrite: "rewritten description",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Request shape
// ---------------------------------------------------------------------------
describe("improveMissionDescription — request sent to Gemini", () => {
  it("includes both the description and the caller's missing-field list", async () => {
    __queueJson(improveJson());

    await improveMissionDescription("70 kg smallsat, sun-sync", [
      "budget_usd",
      "schedule_months",
    ]);

    const contents = __lastRequest()?.contents ?? "";
    expect(contents).toContain("70 kg smallsat, sun-sync");
    expect(contents).toContain("budget_usd, schedule_months");
  });

  it("tells the model when the caller identified no missing fields", async () => {
    __queueJson(improveJson());

    await improveMissionDescription("100 kg SSO 550 km $2M 12 months fixed", []);

    expect(__lastRequest()?.contents).toContain("none identified");
  });

  it("requests JSON output", async () => {
    __queueJson(improveJson());
    await improveMissionDescription("anything", []);
    expect(__lastRequest()?.config?.responseMimeType).toBe("application/json");
  });

  it("never calls the model when no API key is configured", async () => {
    delete process.env.GEMINI_API_KEY;
    await improveMissionDescription("anything", ["budget_usd"]);
    expect(__requestCount()).toBe(0);
  });

  it("uses the caller-supplied model — matches the model picked in Settings", async () => {
    __queueJson(improveJson());
    await improveMissionDescription("anything", [], "gemini-3.1-flash-lite");
    expect(__lastRequest()?.model).toBe("gemini-3.1-flash-lite");
  });

  it("falls back to the default model when none is supplied", async () => {
    __queueJson(improveJson());
    await improveMissionDescription("anything", []);
    expect(__lastRequest()?.model).toBe("gemini-3.5-flash-lite");
  });
});

// ---------------------------------------------------------------------------
// What the LLM path can do that the static fallback cannot
// ---------------------------------------------------------------------------
describe("improveMissionDescription — model-driven response", () => {
  it("returns the model's output with fallback: false", async () => {
    __queueJson(
      improveJson({
        missing_fields: ["budget_usd"],
        clarifying_questions: [
          {
            field: "budget_usd",
            question: "Roughly what launch budget has been approved?",
            placeholder: "e.g. $4M",
          },
        ],
        suggested_rewrite:
          "70 kg smallsat to SSO at 550 km, [budget not specified — add a $ ceiling], launch within 12 months.",
      })
    );

    const result = await improveMissionDescription("70 kg smallsat to SSO", [
      "budget_usd",
    ]);

    expect(result.fallback).toBe(false);
    expect(result.missing_fields).toEqual(["budget_usd"]);
    expect(result.suggested_rewrite).toMatch(/budget not specified/);
    expect(result.error).toBeUndefined();
  });

  it("drops a field the model could infer, even though the caller flagged it as missing", async () => {
    // The caller's heuristic missed "a couple of years"; the model did not.
    __queueJson(
      improveJson({
        missing_fields: ["budget_usd"],
        clarifying_questions: [
          {
            field: "budget_usd",
            question: "What is your ceiling?",
            placeholder: "e.g. $4M",
          },
        ],
      })
    );

    const { missing_fields } = await improveMissionDescription(
      "70 kg to sun-sync within a couple of years",
      ["budget_usd", "schedule_months"]
    );

    expect(missing_fields).toEqual(["budget_usd"]);
    expect(missing_fields).not.toContain("schedule_months");
  });

  it("uses the model's tailored question rather than the static one", async () => {
    __queueJson(
      improveJson({
        missing_fields: ["payload_mass_kg"],
        clarifying_questions: [
          {
            field: "payload_mass_kg",
            question:
              "You mentioned a 6U cubesat — roughly what does the flight unit mass?",
            placeholder: "e.g. 12 kg",
          },
        ],
      })
    );

    const { clarifying_questions } = await improveMissionDescription(
      "6U cubesat to LEO",
      ["payload_mass_kg"]
    );

    expect(clarifying_questions[0].question).toContain("6U cubesat");
    // The static fallback wording, for contrast:
    expect(clarifying_questions[0].question).not.toBe(
      "What is the mass of your payload?"
    );
  });

  it("can surface a field that has no entry in the static question table", async () => {
    // buildFallback() silently drops unknown keys; the LLM path keeps them.
    __queueJson(
      improveJson({
        missing_fields: ["launch_site_constraint"],
        clarifying_questions: [
          {
            field: "launch_site_constraint",
            question: "Are you restricted to a particular launch site?",
            placeholder: "e.g. US soil only",
          },
        ],
      })
    );

    const result = await improveMissionDescription("ITAR-controlled payload", [
      "launch_site_constraint",
    ]);

    expect(result.missing_fields).toEqual(["launch_site_constraint"]);
    expect(result.clarifying_questions).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Degradation
// ---------------------------------------------------------------------------
describe("improveMissionDescription — falls back when the model misbehaves", () => {
  it("falls back and records the error when the SDK throws", async () => {
    __queueError("429 Too Many Requests");

    const result = await improveMissionDescription("small sat cheap soon", [
      "payload_mass_kg",
      "budget_usd",
    ]);

    expect(result.fallback).toBe(true);
    expect(result.suggested_rewrite).toBeNull();
    expect(result.missing_fields).toEqual(["payload_mass_kg", "budget_usd"]);
    expect(result.error).toMatch(/429/);
  });

  it("falls back when the response is not JSON", async () => {
    __queueText("Sorry, I can't help with that.");

    const result = await improveMissionDescription("small sat", ["budget_usd"]);

    expect(result.fallback).toBe(true);
    expect(result.clarifying_questions).toHaveLength(1);
    expect(result.clarifying_questions[0].field).toBe("budget_usd");
  });

  it("falls back when the JSON is missing a required key", async () => {
    __queueJson({ missing_fields: ["budget_usd"] }); // no clarifying_questions / rewrite

    const result = await improveMissionDescription("small sat", ["budget_usd"]);

    expect(result.fallback).toBe(true);
    expect(result.suggested_rewrite).toBeNull();
  });
});
