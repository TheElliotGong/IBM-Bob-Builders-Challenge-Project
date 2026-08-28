/**
 * Typed handle on the manual @google/genai mock.
 *
 * The mock is substituted automatically by Jest, so importing the package here
 * and casting gives back the *same* module instance the code under test uses.
 * (Importing `__mocks__/@google/genai` by relative path would be a different
 * registry entry, and queued responses would go nowhere.)
 */
import * as genai from "@google/genai";
import type * as GenaiMock from "../../../__mocks__/@google/genai";

const mock = genai as unknown as typeof GenaiMock;

export const {
  __queueText,
  __queueJson,
  __queueError,
  __reset,
  __lastRequest,
  __requestCount,
  __lastApiKey,
} = mock;

export type { GenerateContentRequest } from "../../../__mocks__/@google/genai";

/**
 * A syntactically valid parser response, so tests only have to spell out the
 * fields they actually care about.
 */
export function parsedMissionJson(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    payload_mass_kg: null,
    orbit_type: null,
    target_altitude_km: null,
    budget_usd: null,
    schedule_months: null,
    inclination_flexibility_required: null,
    parse_confidence: "high",
    ...overrides,
  };
}
