/**
 * Manual mock for the @google/genai SDK.
 *
 * Because this lives in a root-level `__mocks__` directory adjacent to
 * node_modules, Jest substitutes it for the real package automatically — no
 * `jest.mock("@google/genai")` call is needed in individual test files. That
 * means no test can ever open a network connection or need a real API key.
 *
 * Tests drive it through the `__`-prefixed helpers: queue one behaviour per
 * expected `generateContent` call, then assert on what the module under test
 * sent via `__lastRequest()`.
 *
 * Import the helpers through `src/__tests__/helpers/genaiMock.ts` so the typed
 * handle refers to the same module instance the code under test receives.
 */

export interface GenerateContentRequest {
  model: string;
  contents: string;
  config?: {
    systemInstruction?: string;
    temperature?: number;
    maxOutputTokens?: number;
    responseMimeType?: string;
  };
}

export interface GenerateContentResponse {
  text: string | undefined;
}

type Behavior =
  | { kind: "text"; text: string | undefined }
  | { kind: "error"; error: Error };

const queue: Behavior[] = [];
const requests: GenerateContentRequest[] = [];
const apiKeys: Array<string | undefined> = [];

export const generateContent = jest.fn(
  async (request: GenerateContentRequest): Promise<GenerateContentResponse> => {
    requests.push(request);

    const behavior = queue.shift();
    if (!behavior) {
      throw new Error(
        "[@google/genai mock] generateContent() was called but no response was queued. " +
          "Queue one with __queueText / __queueJson / __queueError before exercising the LLM path."
      );
    }
    if (behavior.kind === "error") throw behavior.error;
    return { text: behavior.text };
  }
);

export class GoogleGenAI {
  readonly models = { generateContent };

  constructor(readonly options: { apiKey?: string }) {
    apiKeys.push(options?.apiKey);
  }
}

// ---------------------------------------------------------------------------
// Test controls
// ---------------------------------------------------------------------------

/** Queue a raw text response (what Gemini would put in `response.text`). */
export function __queueText(text: string | undefined): void {
  queue.push({ kind: "text", text });
}

/** Queue a JSON response — the shape the parser/improver prompts ask for. */
export function __queueJson(value: unknown): void {
  queue.push({ kind: "text", text: JSON.stringify(value) });
}

/** Queue a thrown error (network failure, bad key, quota, …). */
export function __queueError(error: Error | string): void {
  queue.push({
    kind: "error",
    error: typeof error === "string" ? new Error(error) : error,
  });
}

/** Clear queued behaviour and recorded calls. Call in `beforeEach`. */
export function __reset(): void {
  queue.length = 0;
  requests.length = 0;
  apiKeys.length = 0;
  generateContent.mockClear();
}

/** The most recent request the code under test sent to Gemini. */
export function __lastRequest(): GenerateContentRequest | undefined {
  return requests[requests.length - 1];
}

/** How many times the model was called since the last `__reset()`. */
export function __requestCount(): number {
  return requests.length;
}

/** The API key the most recently constructed client was given. */
export function __lastApiKey(): string | undefined {
  return apiKeys[apiKeys.length - 1];
}
