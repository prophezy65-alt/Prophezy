/**
 * lib/document/index.ts
 * Public entry point for the Document Intelligence Engine.
 *
 *   import { documentService } from "@/lib/document";
 *   const doc = await documentService.process({ ... });
 */

export * from "./models";
export * from "./types/document.types";
export * from "./validation";
export * from "./chunking";
export * from "./embeddings";
export * from "./export/formatters";
export {
  documentService,
  validationService,
  exportService,
  compressionService,
} from "./services";
export { analysisService } from "./analysis";
export { analyticsService } from "./analytics";
export { cacheService } from "./cache";
export { searchService } from "./search";
export { extractorService } from "./extractor";
