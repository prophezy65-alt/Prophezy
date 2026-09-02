import { mnemonicService } from "@/lib/flashcards";
import { requireApiUser } from "@/lib/flashcards/http/auth";
import { requireOwnedCard } from "@/lib/flashcards/http/ownership";
import { ok, fail } from "@/lib/flashcards/http/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/flashcards/cards/:cardId/mnemonic — generates (if not already set) and returns a mnemonic. */
export async function POST(_request: Request, context: { params: Promise<{ cardId: string }> }) {
  try {
    const user = await requireApiUser();
    const { cardId } = await context.params;
    const card = await requireOwnedCard(cardId, user.id);

    if (card.mnemonic) {
      return ok({ mnemonic: card.mnemonic, memoryTrick: null, analogy: null, generated: false });
    }

    const result = await mnemonicService.generateAndSaveMnemonic(cardId, user.id);
    return ok({ ...result, generated: true });
  } catch (error) {
    return fail(error);
  }
}
