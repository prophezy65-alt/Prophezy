/**
 * Research module URL ingestion.
 *
 * Fetches an arbitrary URL and returns cleaned text. Authored to fill the
 * gap referenced by the Quiz generator (`fetchAndExtractUrlText`), which the
 * Research module was expected to own but never exported. Logic mirrors the
 * existing fetch-and-strip helper in the Flashcards ingestion provider.
 */
export async function fetchAndExtractUrlText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch URL for research ingestion: ${url} (${res.status})`);
  }
  const contentType = res.headers.get("content-type") ?? "";
  const raw = await res.text();
  if (contentType.includes("html")) {
    return raw
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }
  return raw;
}
