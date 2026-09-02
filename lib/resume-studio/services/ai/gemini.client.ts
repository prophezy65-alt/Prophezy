/**
 * gemini.client.ts
 * Thin, typed wrapper around the Gemini API.
 * Every AI-powered service in Resume Studio goes through this single
 * client so retries, JSON-mode parsing, and error handling live in one place.
 *
 * Never use OpenAI in this module per project constraints.
 *
 * Env required: GEMINI_API_KEY
 */

const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent";

export interface GeminiCallOptions {
  temperature?: number;
  maxOutputTokens?: number;
  jsonMode?: boolean;
}

export class GeminiClientError extends Error {
  constructor(message: string, public readonly status?: number) {
    super(message);
    this.name = "GeminiClientError";
  }
}

function getApiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new GeminiClientError(
      "GEMINI_API_KEY is not set. Add it to your environment before calling AI features."
    );
  }
  return key;
}

/**
 * Sends a single-turn prompt to Gemini and returns the raw text response.
 * Retries once on transient (5xx) failures.
 */
export async function callGemini(
  prompt: string,
  options: GeminiCallOptions = {}
): Promise<string> {
  const apiKey = getApiKey();
  const { temperature = 0.7, maxOutputTokens = 1024, jsonMode = false } = options;

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature,
      maxOutputTokens,
      ...(jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  };

  const attempt = async (): Promise<Response> => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25_000);
    try {
      return await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw new GeminiClientError("Gemini API request timed out after 25s.");
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
  };

  let response = await attempt();

  if (!response.ok && response.status >= 500) {
    // one retry for transient server errors
    response = await attempt();
  }

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new GeminiClientError(
      `Gemini API request failed (${response.status}): ${errorText}`,
      response.status
    );
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts
    ?.map((p: { text?: string }) => p.text ?? "")
    .join("")
    .trim();

  if (!text) {
    throw new GeminiClientError("Gemini returned an empty response.");
  }

  return text;
}

/**
 * Calls Gemini in JSON mode and parses the result into type T.
 * Throws GeminiClientError with a clear message if parsing fails, rather
 * than silently returning malformed data to the caller.
 */
export async function callGeminiJson<T>(
  prompt: string,
  options: Omit<GeminiCallOptions, "jsonMode"> = {}
): Promise<T> {
  const raw = await callGemini(prompt, { ...options, jsonMode: true });
  try {
    return JSON.parse(raw) as T;
  } catch {
    // Some responses wrap JSON in markdown fences despite jsonMode; strip and retry.
    const stripped = raw.replace(/^```json\s*/i, "").replace(/```\s*$/i, "").trim();
    try {
      return JSON.parse(stripped) as T;
    } catch {
      throw new GeminiClientError(
        `Failed to parse Gemini JSON response: ${raw.slice(0, 200)}`
      );
    }
  }
}
