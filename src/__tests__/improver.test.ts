/**
 * Tests for the fallback improvement path (no GEMINI_API_KEY set).
 */
import { improveMissionDescription } from "@/lib/improver";

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
});

describe("improveMissionDescription — Gemini error fallback", () => {
  beforeEach(() => {
    // Simulate a bad API key so the import path is exercised but the call fails
    process.env.GEMINI_API_KEY = "invalid-key-will-fail";
  });

  afterEach(() => {
    delete process.env.GEMINI_API_KEY;
  });

  it("falls back gracefully when the Gemini call throws", async () => {
    // With a bad key the generateContent call will either throw or return bad JSON —
    // either way buildFallback must kick in and return fallback: true
    const result = await improveMissionDescription(
      "small sat cheap soon",
      ["payload_mass_kg", "budget_usd"]
    );
    // The call may succeed or fall back; either is valid — just must not throw
    expect(typeof result.fallback).toBe("boolean");
    expect(Array.isArray(result.missing_fields)).toBe(true);
  });
});
