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

    it("converts '2 years' to 24 months", async () => {
      const result = await parseMissionDescription("We're looking to launch within 2 years, 70 kg MEO");
      expect(result.schedule_months).toBe(24);
    });

    it("converts '1 year' to 12 months", async () => {
      const result = await parseMissionDescription("launch within 1 year, 100 kg LEO");
      expect(result.schedule_months).toBe(12);
    });

    it("converts 'within a year' word form to 12 months", async () => {
      const result = await parseMissionDescription("launch timeline is two years, 50 kg SSO");
      expect(result.schedule_months).toBe(24);
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

    it("detects 'any' from 'inclination control is flexible'", async () => {
      const result = await parseMissionDescription("Our inclination control is flexible, 70 kg MEO");
      expect(result.inclination_flexibility_required).toBe("any");
    });

    it("detects 'any' from standalone 'flexible' keyword", async () => {
      const result = await parseMissionDescription("50 kg LEO, inclination is flexible");
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

// ---------------------------------------------------------------------------
// Paraphrased / informal phrasing
//
// The heuristic is a fallback, so it will never match the LLM path (see
// parser.llm.test.ts) — but the phrasings below are common enough that the
// offline path should still cope with them.
// ---------------------------------------------------------------------------
describe("parseMissionDescription — heuristic on informal phrasing", () => {
  const cases: Array<{
    label: string;
    input: string;
    expected: Partial<Awaited<ReturnType<typeof parseMissionDescription>>>;
  }> = [
    // --- mass units ---
    { label: "pounds → kg", input: "220 lbs payload to LEO", expected: { payload_mass_kg: 99.8 } },
    { label: "tonnes → kg", input: "payload weighs 1.5 tonnes", expected: { payload_mass_kg: 1500 } },
    { label: "bare tonne abbreviation", input: "a 2 t bus to LEO", expected: { payload_mass_kg: 2000 } },
    { label: "no space before kg", input: "around 100kg to orbit", expected: { payload_mass_kg: 100 } },
    { label: "'kilos' spelling", input: "150 kilos to SSO", expected: { payload_mass_kg: 150 } },

    // --- budget phrasings ---
    { label: "'5 mil' with no dollar sign", input: "we can spend 5 mil", expected: { budget_usd: 5_000_000 } },
    { label: "thousands suffix", input: "$750k for the launch", expected: { budget_usd: 750_000 } },
    { label: "comma-grouped figure", input: "$10,000,000 available", expected: { budget_usd: 10_000_000 } },
    { label: "word-form amount", input: "we have two million dollars", expected: { budget_usd: 2_000_000 } },
    { label: "word-form with a half", input: "two and a half million dollars", expected: { budget_usd: 2_500_000 } },

    // --- schedule phrasings ---
    { label: "hyphenated month count", input: "18-month timeline, 50 kg LEO", expected: { schedule_months: 18 } },
    { label: "'a year and a half'", input: "launch in a year and a half", expected: { schedule_months: 18 } },
    { label: "'a couple of years'", input: "flying within a couple of years", expected: { schedule_months: 24 } },
    { label: "'within a year'", input: "need it up within a year", expected: { schedule_months: 12 } },
    { label: "'half a year'", input: "half a year out from launch", expected: { schedule_months: 6 } },

    // --- orbit phrasings ---
    { label: "'sun-sync' abbreviation", input: "60 kg to a sun-sync orbit", expected: { orbit_type: "SSO" } },
    { label: "'geosynchronous'", input: "geosynchronous slot needed", expected: { orbit_type: "GEO" } },
    {
      label: "'geostationary transfer orbit' is GTO, not GEO",
      input: "1200 kg to a geostationary transfer orbit",
      expected: { orbit_type: "GTO" },
    },
    { label: "hyphenated 'low-earth'", input: "cubesat to low-earth orbit", expected: { orbit_type: "LEO" } },
    { label: "hyphenated 'medium-earth'", input: "nav payload to medium-earth orbit", expected: { orbit_type: "MEO" } },

    // --- altitude ---
    { label: "miles → km", input: "60 kg at about 340 miles up", expected: { target_altitude_km: 547.2 } },

    // --- inclination ---
    {
      label: "'don't care about inclination'",
      input: "50 kg LEO, we don't care about the inclination",
      expected: { inclination_flexibility_required: "any" },
    },
  ];

  it.each(cases)("$label", async ({ input, expected }) => {
    const result = await parseMissionDescription(input);
    expect(result).toMatchObject(expected);
  });

  // -------------------------------------------------------------------------
  // Whole-description round trips
  // -------------------------------------------------------------------------
  it("parses a fully informal description", async () => {
    const result = await parseMissionDescription(
      "We have a 220 lb smallsat headed for a sun-sync orbit at 550 km. Budget is 5 mil and we need to fly inside 18 months."
    );
    expect(result).toMatchObject({
      payload_mass_kg: 99.8,
      orbit_type: "SSO",
      target_altitude_km: 550,
      budget_usd: 5_000_000,
      schedule_months: 18,
    });
  });

  it("parses a prose description with word-form numbers", async () => {
    const result = await parseMissionDescription(
      "Comms bird, just under 1.5 tonnes, geostationary transfer orbit, two and a half million dollars, a couple of years out, inclination is fixed."
    );
    expect(result).toMatchObject({
      payload_mass_kg: 1500,
      orbit_type: "GTO",
      budget_usd: 2_500_000,
      schedule_months: 24,
      inclination_flexibility_required: "fixed",
    });
  });

  // -------------------------------------------------------------------------
  // False positives — units that look like money scales
  // -------------------------------------------------------------------------
  it("does not read 'km' or 'kg' as a thousands budget suffix", async () => {
    const result = await parseMissionDescription("500 km orbit, 300 kg, 12 months");
    expect(result.budget_usd).toBeNull();
  });

  it("does not read 'months' as a millions budget suffix", async () => {
    const result = await parseMissionDescription("launch within 6 months");
    expect(result.budget_usd).toBeNull();
  });

  it("does not read a cubesat unit count as a payload mass", async () => {
    const result = await parseMissionDescription("6U cubesat to low-earth orbit");
    expect(result.payload_mass_kg).toBeNull();
  });
});
