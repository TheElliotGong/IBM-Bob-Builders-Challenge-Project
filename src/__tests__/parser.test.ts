/**
 * Tests for the heuristic parser path (no GEMINI_API_KEY set).
 * parseMissionDescription falls back to heuristicParse when the env var is absent.
 */
import { parseMissionDescription } from "@/lib/parser";

// Ensure no API key is present for these tests
beforeAll(() => {
  delete process.env.GEMINI_API_KEY;
});

describe("parseMissionDescription — heuristic (no API key)", () => {
  // ---------------------------------------------------------------------------
  // Payload mass extraction
  // ---------------------------------------------------------------------------
  describe("payload mass", () => {
    it("extracts kg from '150 kg payload'", async () => {
      const result = await parseMissionDescription("150 kg payload to SSO");
      expect(result.payload_mass_kg).toBe(150);
    });

    it("extracts mass from 'mass: 42.5 kg'", async () => {
      const result = await parseMissionDescription("mass: 42.5 kg, LEO");
      expect(result.payload_mass_kg).toBe(42.5);
    });

    it("returns null when no mass is mentioned", async () => {
      const result = await parseMissionDescription("Need an LEO rideshare slot");
      expect(result.payload_mass_kg).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Orbit type extraction
  // ---------------------------------------------------------------------------
  describe("orbit type", () => {
    it("detects SSO from the word 'SSO'", async () => {
      const result = await parseMissionDescription("100 kg SSO orbit");
      expect(result.orbit_type).toBe("SSO");
    });

    it("detects SSO from 'sun-synchronous'", async () => {
      const result = await parseMissionDescription("100 kg sun-synchronous mission");
      expect(result.orbit_type).toBe("SSO");
    });

    it("detects GEO from 'geostationary'", async () => {
      const result = await parseMissionDescription("geostationary comsat, 500 kg");
      expect(result.orbit_type).toBe("GEO");
    });

    it("detects GTO from 'GTO'", async () => {
      const result = await parseMissionDescription("500 kg GTO transfer mission");
      expect(result.orbit_type).toBe("GTO");
    });

    it("detects LEO from 'low earth orbit'", async () => {
      const result = await parseMissionDescription("200 kg to low earth orbit");
      expect(result.orbit_type).toBe("LEO");
    });

    it("detects MEO from 'MEO'", async () => {
      const result = await parseMissionDescription("navigation satellite, MEO, 300 kg");
      expect(result.orbit_type).toBe("MEO");
    });

    it("detects HEO from 'highly elliptical'", async () => {
      const result = await parseMissionDescription("highly elliptical orbit, 200 kg, 12 months");
      expect(result.orbit_type).toBe("HEO");
    });

    it("returns null when orbit is unspecified", async () => {
      const result = await parseMissionDescription("need a launch, 100 kg");
      expect(result.orbit_type).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Budget extraction
  // ---------------------------------------------------------------------------
  describe("budget", () => {
    it("parses dollar amount '$5M'", async () => {
      const result = await parseMissionDescription("budget $5M, 100 kg SSO");
      expect(result.budget_usd).toBe(5_000_000);
    });

    it("parses 'budget 8 million'", async () => {
      const result = await parseMissionDescription("budget 8 million, LEO, 50 kg");
      expect(result.budget_usd).toBe(8_000_000);
    });

    it("parses '$1B' as one billion", async () => {
      const result = await parseMissionDescription("$1B available for this mission");
      expect(result.budget_usd).toBe(1_000_000_000);
    });

    it("returns null when no budget is mentioned", async () => {
      const result = await parseMissionDescription("100 kg SSO");
      expect(result.budget_usd).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Schedule extraction
  // ---------------------------------------------------------------------------
  describe("schedule", () => {
    it("extracts months from '6 months'", async () => {
      const result = await parseMissionDescription("need launch within 6 months, 80 kg LEO");
      expect(result.schedule_months).toBe(6);
    });

    it("returns null when schedule is not mentioned", async () => {
      const result = await parseMissionDescription("100 kg SSO");
      expect(result.schedule_months).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Inclination flexibility
  // ---------------------------------------------------------------------------
  describe("inclination flexibility", () => {
    it("detects customer-defined from 'custom inclination'", async () => {
      const result = await parseMissionDescription("need custom inclination, 100 kg LEO, 12 months");
      expect(result.inclination_flexibility_required).toBe("customer-defined");
    });

    it("detects 'any' from 'flexible orbit'", async () => {
      const result = await parseMissionDescription("flexible orbit requirements, 50 kg");
      expect(result.inclination_flexibility_required).toBe("any");
    });

    it("returns null when not specified", async () => {
      const result = await parseMissionDescription("100 kg SSO");
      expect(result.inclination_flexibility_required).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Parse confidence
  // ---------------------------------------------------------------------------
  describe("parse_confidence", () => {
    it("is 'medium' when 3+ fields are found", async () => {
      const result = await parseMissionDescription("100 kg SSO, $5M budget, 12 months");
      expect(result.parse_confidence).toBe("medium");
    });

    it("is 'low' when fewer than 3 fields are found", async () => {
      const result = await parseMissionDescription("I need a launch vehicle");
      expect(result.parse_confidence).toBe("low");
    });
  });

  // ---------------------------------------------------------------------------
  // raw_input is preserved
  // ---------------------------------------------------------------------------
  it("preserves the raw_input string verbatim", async () => {
    const input = "100 kg SSO mission, $5M budget";
    const result = await parseMissionDescription(input);
    expect(result.raw_input).toBe(input);
  });
});
