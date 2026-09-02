/**
 * lib/flashcards/analytics/
 * Required by the architecture spec as a top-level folder. The actual
 * implementation lives in services/analytics.service.ts (it needs
 * flashcardsService + conceptService, so co-locating with the other
 * services avoids a circular-import edge between analytics/ and services/).
 * This barrel just re-exports so `import { analyticsService } from
 * "@/lib/flashcards/analytics"` works per the spec's folder layout.
 */
export * from "../services/analytics.service";
