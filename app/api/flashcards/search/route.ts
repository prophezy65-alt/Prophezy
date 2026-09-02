import { searchService } from "@/lib/flashcards";
import { requireApiUser } from "@/lib/flashcards/http/auth";
import { ok, fail } from "@/lib/flashcards/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/flashcards/search?q=...&mode=semantic|keyword|topic|concept|formula|tag&deckId=&limit= */
export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const url = new URL(request.url);

    const results = await searchService.search({
      userId: user.id,
      query: url.searchParams.get("q") ?? "",
      mode: url.searchParams.get("mode") ?? "keyword",
      deckId: url.searchParams.get("deckId") ?? undefined,
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
    });

    return ok(results);
  } catch (error) {
    return fail(error);
  }
}
