/**
 * Tests for the fallback improvement path (no GEMINI_API_KEY set).
 */
import { improveMissionDescription } from "@/lib/improver";
import { __queueError, __reset } from "./helpers/genaiMock";

beforeAll(() => {
  delete process.env.GEMINI_API_KEY;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("improveMissionDescription — fallback (no API key)", () => {
  it("sets fallback: true when no API key", async () => {
    const { fallback } = await improveMissionDescription(
      "small sat, cheap, soon",
      ["payload_mass_kg", "orbit_type", "budget_usd", "schedule_months"]
    );
    expect(fallback).toBe(true);
  });

  it("returns suggested_rewrite: null in fallback mode", async () => {
    const { suggested_rewrite } = await improveMissionDescription(
      "50 kg LEO satellite",
      ["budget_usd", "schedule_months"]
    );
    expect(suggested_rewrite).toBeNull();
  });

  it("echoes back the supplied missing fields", async () => {
    const missing = ["payload_mass_kg", "budget_usd"];
    const { missing_fields } = await improveMissionDescription(
      "some description",
      missing
    );
    expect(missing_fields).toEqual(missing);
  });

  it("returns empty missing_fields when none are supplied", async () => {
    const { missing_fields } = await improveMissionDescription(
      "100 kg SSO 550 km $2M 12 months fixed inclination",
      []
    );
    expect(missing_fields).toHaveLength(0);
  });

  it("does not flag a field as missing when it was not in the supplied list", async () => {
    const { missing_fields } = await improveMissionDescription(
      "45 kg LEO 400 km satellite",
      ["budget_usd"]
    );
    // payload_mass_kg and orbit_type were not passed in missing — should not appear
    expect(missing_fields).not.toContain("payload_mass_kg");
    expect(missing_fields).not.toContain("orbit_type");
  });

  it("handles an empty description gracefully", async () => {
    const result = await improveMissionDescription("", ["payload_mass_kg", "orbit_type"]);
    expect(result.fallback).toBe(true);
    expect(result.suggested_rewrite).toBeNull();
  });

  it("handles malformed/missing missing array (empty) gracefully", async () => {
    const result = await improveMissionDescription("some text", []);
    expect(result.fallback).toBe(true);
    expect(result.missing_fields).toHaveLength(0);
  });

  it("returns clarifying_questions array (fallback)", async () => {
    const result = await improveMissionDescription(
      "small sat, cheap, soon",
      ["payload_mass_kg", "budget_usd"]
    );
    expect(Array.isArray(result.clarifying_questions)).toBe(true);
  });

  it("returns one clarifying question per known missing field (fallback)", async () => {
    const missing = ["payload_mass_kg", "orbit_type", "budget_usd"];
    const { clarifying_questions } = await improveMissionDescription(
      "some description",
      missing
    );
    expect(clarifying_questions).toHaveLength(missing.length);
    expect(clarifying_questions.map((q) => q.field)).toEqual(missing);
  });

  it("returns empty clarifying_questions when no fields are missing", async () => {
    const { clarifying_questions } = await improveMissionDescription("some text", []);
    expect(clarifying_questions).toHaveLength(0);
  });

  it("each clarifying question has field, question, and placeholder strings", async () => {
    const { clarifying_questions } = await improveMissionDescription(
      "some description",
      ["schedule_months", "inclination_flexibility_required"]
    );
    for (const q of clarifying_questions) {
      expect(typeof q.field).toBe("string");
      expect(typeof q.question).toBe("string");
      expect(typeof q.placeholder).toBe("string");
      expect(q.question.length).toBeGreaterThan(0);
      expect(q.placeholder.length).toBeGreaterThan(0);
    }
  });
});

describe("improveMissionDescription — Gemini error fallback", () => {
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

  it("falls back to the static questions when the Gemini call throws", async () => {
    __queueError("401 Unauthorized — invalid API key");

    const result = await improveMissionDescription("small sat cheap soon", [
      "payload_mass_kg",
      "budget_usd",
    ]);

    expect(result.fallback).toBe(true);
    expect(result.suggested_rewrite).toBeNull();
    expect(result.missing_fields).toEqual(["payload_mass_kg", "budget_usd"]);
    expect(result.clarifying_questions).toHaveLength(2);
    expect(result.error).toMatch(/401/);
  });
});
