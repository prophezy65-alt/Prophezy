/**
 * lib/document/services/document.service.ts
 *
 * THE entry point: `documentService.process(file)`. Every other Prophezy
 * module (Resume Studio, Research AI, Flashcards AI, Quiz AI, etc.) should
 * call this instead of parsing files itself. Orchestrates:
 *
 *   validate -> parse -> (deterministic extraction) -> smart AI extraction
 *   -> analysis -> chunk -> embed -> index -> persist -> return
 *
 * ASSUMPTION: `getSupabaseServerClient()` at `@/lib/supabase/server`, same
 * as every other module built so far. One import line to fix if the real
 * export differs.
 */

import type { Json } from "@/lib/supabase/types";
import { createClient as getSupabaseServerClient } from "@/lib/supabase/server";
import { validationService } from "./validation.service";
import { assertValidFile } from "../validation/file-security";
import { parserService } from "../parser/parser.service";
import { extractorService } from "../extractor/extractor.service";
import { detectTablesInPlainText } from "../extractor/table-extractor";
import { detectCodeBlocks } from "../extractor/code-extractor";
import { detectFormulas } from "../extractor/formula-extractor";
import { analysisService } from "../analysis/analysis.service";
import { chunkingService } from "../chunking/chunking.service";
import { embeddingService } from "../embeddings/embedding.service";
import { indexingService } from "../embeddings/indexing.service";
import { analyticsService } from "../analytics/analytics.service";
import { cacheService, hashFileContent, cacheKey } from "../cache/cache.service";
import { DocumentError } from "../errors/document-errors";
import { cleanTitle, cleanAuthors, cleanDateString } from "../utils/metadata-cleaner";
import type { ProphezyDocument, DocumentRow } from "../models/document.model";
import type { Page } from "../models/page.model";
import type { TableBlock, CodeBlock, Formula } from "../models/content-block.model";

export interface ProcessDocumentInput {
  userId: string;
  ownerModule?: string | null;
  filename: string;
  format: string;
  buffer: Buffer;
  mimeType: string;
  chunkStrategy?: "recursive" | "semantic" | "sliding_window";
  extractTables?: boolean;
  extractTopics?: boolean;
  runOcr?: boolean;
  skipCache?: boolean;
}

export const documentService = {
  /** THE function every module calls. */
  async process(input: ProcessDocumentInput): Promise<ProphezyDocument> {
    const started = Date.now();

    const validated = validationService.validateProcessRequest({
      userId: input.userId,
      ownerModule: input.ownerModule ?? null,
      filename: input.filename,
      format: input.format,
      mimeType: input.mimeType,
      sizeBytes: input.buffer.byteLength,
      chunkStrategy: input.chunkStrategy,
      extractTables: input.extractTables,
      extractTopics: input.extractTopics,
      runOcr: input.runOcr,
    });

    assertValidFile({
      filename: validated.filename,
      format: validated.format as any,
      mimeType: validated.mimeType,
      sizeBytes: validated.sizeBytes,
      headerHex: input.buffer.subarray(0, 8).toString("hex"),
    });

    const contentHash = hashFileContent(input.buffer);
    const cacheK = cacheKey("processed", contentHash);

    if (!input.skipCache) {
      const cached = await cacheService.get<ProphezyDocument>(cacheK);
      if (cached) return cached;
    }

    const supabase = await getSupabaseServerClient();

    const { data: docRow, error: createError } = await supabase
      .from("documents")
      .insert({
        user_id: validated.userId,
        owner_module: validated.ownerModule,
        filename: validated.filename,
        format: validated.format,
        status: "processing",
        metadata: {},
      })
      .select()
      .single<DocumentRow>();

    if (createError || !docRow) {
      throw new DocumentError("Failed to create document record.", "CREATE_FAILED", { cause: createError?.message });
    }

    const documentId = docRow.id;

    try {
      // --- Parse ---------------------------------------------------------
      await analyticsService.logEvent({ documentId, event: "parsing_started" });
      const parseStarted = Date.now();

      const parsed = await parserService.parse({
        buffer: input.buffer,
        format: validated.format as any,
        fileSizeBytes: validated.sizeBytes,
        userId: validated.userId,
        runOcrOnEmptyPages: validated.runOcr,
      });

      await analyticsService.logEvent({ documentId, event: "parsing_completed", durationMs: Date.now() - parseStarted });

      // --- Deterministic extraction (tables/code/formulas the provider missed) ---
      const extraTables: TableBlock[] = validated.extractTables
        ? parsed.pages.flatMap((p) => (p.hasTables ? [] : detectTablesInPlainText(p.text, p.index)))
        : [];
      const extraCode: CodeBlock[] = parsed.pages.flatMap((p) => detectCodeBlocks(p.text, p.index));
      const formulas: Formula[] = parsed.pages.flatMap((p) => detectFormulas(p.text, p.index));

      // --- Smart AI extraction (topics/keywords/definitions/summary/type) ---
      let smart;
      if (validated.extractTopics && parsed.rawText.trim().length > 0) {
        smart = await extractorService.extractSmart(parsed.rawText, validated.userId);
        await analyticsService.logEvent({ documentId, event: "extraction_completed" });
      } else {
        smart = {
          summary: "",
          title: null,
          authors: [],
          topics: [],
          keywords: [],
          definitions: [],
          documentType: "unknown" as const,
          documentTypeConfidence: 0,
        };
      }

      // --- Analysis --------------------------------------------------------
      const analysis = analysisService.analyze(parsed.rawText, smart.documentType, smart.documentTypeConfidence);
      const readingTimeMinutes = analysisService.estimateReadingTimeMinutes(analysis.wordCount, analysis.complexityScore);

      // --- Chunk + embed + index --------------------------------------------
      const chunks = chunkingService.buildDocumentChunks({
        documentId,
        text: parsed.rawText,
        sections: parsed.sections,
        strategy: validated.chunkStrategy,
      });

      await analyticsService.logEvent({ documentId, event: "chunking_completed", metadata: { chunkCount: chunks.length } });

      const embeddings = await embeddingService.embedChunks(chunks, validated.userId);
      await analyticsService.logEvent({ documentId, event: "embedding_completed" });

      await indexingService.indexChunks(chunks, embeddings);
      await analyticsService.logEvent({ documentId, event: "indexing_completed" });

      // --- Persist final metadata -------------------------------------------
      //
      // FIX: authors previously came straight from parsed.metadata.authors —
      // the PDF's embedded /Author metadata field (see pdf.provider.ts),
      // which reflects whichever account exported the file, NOT who wrote
      // the paper. That's precisely why unrelated papers were showing the
      // same person's name as "author": it was the uploader's own export
      // metadata, not a real byline.
      //
      // Authors now come ONLY from the AI extraction step above (smart.authors)
      // — which reads the actual visible document text and is explicitly
      // instructed to return an empty array rather than guess (see
      // extraction.prompts.ts). The unreliable file-metadata authors field
      // is no longer used as a fallback; an empty array is the correct,
      // honest result when no real byline was found, not a bug to work
      // around with a wrong guess.
      //
      // Title keeps the file-metadata fallback — a PDF's /Title field is
      // far less identity-sensitive than /Author (getting a document's
      // title mildly wrong is a much smaller problem than attributing a
      // paper to the wrong real person), so it's fine as a fallback when
      // the AI pass didn't find one printed on the page either.
      const cleanedMetadata = {
        ...parsed.metadata,
        title: cleanTitle(smart.title || parsed.metadata.title),
        authors: cleanAuthors(smart.authors),
        createdDate: cleanDateString(parsed.metadata.createdDate),
        modifiedDate: cleanDateString(parsed.metadata.modifiedDate),
      };

      const { data: updatedRow, error: updateError } = await supabase
        .from("documents")
        .update({
          status: "completed",
          metadata: cleanedMetadata as unknown as Json,
          summary: smart.summary || null,
          language: analysis.language,
          reading_time_minutes: readingTimeMinutes,
          processed_at: new Date().toISOString(),
        })
        .eq("id", documentId)
        .select()
        .single<DocumentRow>();

      if (updateError || !updatedRow) {
        throw new DocumentError("Failed to finalize document record.", "UPDATE_FAILED", { cause: updateError?.message });
      }

      await analyticsService.logEvent({ documentId, event: "processing_completed", durationMs: Date.now() - started });

      const document: ProphezyDocument = {
        id: updatedRow.id,
        userId: updatedRow.user_id,
        ownerModule: updatedRow.owner_module,
        filename: updatedRow.filename,
        format: updatedRow.format as any,
        status: "completed",
        metadata: cleanedMetadata,
        pages: parsed.pages,
        sections: parsed.sections,
        tables: [...parsed.tables, ...extraTables],
        figures: [],
        images: [],
        codeBlocks: [...parsed.codeBlocks, ...extraCode],
        formulas,
        topics: smart.topics.map((t) => ({ name: t.name, weight: t.weight, pageIndexes: t.pageIndexes })),
        keywords: smart.keywords.map((k) => ({ term: k.term, frequency: k.frequency, weight: k.weight })),
        chunks,
        analysis,
        summary: smart.summary || null,
        language: analysis.language,
        readingTimeMinutes,
        createdAt: updatedRow.created_at,
        updatedAt: updatedRow.updated_at,
        processedAt: updatedRow.processed_at,
        errorMessage: null,
      };

      if (!input.skipCache) {
        await cacheService.set(cacheK, document);
      }

      return document;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await analyticsService.logEvent({ documentId, event: "processing_failed", metadata: { error: message } });

      await supabase
        .from("documents")
        .update({ status: "failed", error_message: message })
        .eq("id", documentId);

      throw err;
    }
  },

  async getDocument(documentId: string): Promise<ProphezyDocument | null> {
    const supabase = await getSupabaseServerClient();
    const { data, error } = await supabase.from("documents").select().eq("id", documentId).maybeSingle<DocumentRow>();
    if (error) throw new DocumentError("Failed to fetch document.", "FETCH_ERROR", { cause: error.message });
    if (!data) return null;

    const { data: chunkRows } = await supabase.from("document_chunks").select().eq("document_id", documentId).order("chunk_index");

    // NOTE: pages/sections/tables/etc. aren't currently persisted as
    // separate rows (only chunks + top-level document metadata are, per
    // the migration) — a full re-fetch of the structural breakdown needs
    // either re-parsing or a `processed_files` blob read. This returns the
    // durable parts (metadata, summary, chunks) needed for RAG/search use
    // cases; extend the migration with page/section tables if callers need
    // the full structural breakdown back without re-processing.
    return {
      id: data.id,
      userId: data.user_id,
      ownerModule: data.owner_module,
      filename: data.filename,
      format: data.format as any,
      status: data.status as any,
      metadata: data.metadata as any,
      pages: [],
      sections: [],
      tables: [],
      figures: [],
      images: [],
      codeBlocks: [],
      formulas: [],
      topics: [],
      keywords: [],
      chunks: (chunkRows as any[])?.map((r) => ({
        id: r.id,
        documentId: r.document_id,
        index: r.chunk_index,
        text: r.text,
        strategy: r.strategy,
        startPageIndex: r.start_page_index,
        endPageIndex: r.end_page_index,
        tokenEstimate: r.token_estimate,
        metadata: r.metadata,
      })) ?? [],
      analysis: null,
      summary: data.summary,
      language: data.language,
      readingTimeMinutes: data.reading_time_minutes,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      processedAt: data.processed_at,
      errorMessage: data.error_message,
    };
  },

  async deleteDocument(documentId: string): Promise<void> {
    const supabase = await getSupabaseServerClient();
    const { error } = await supabase.from("documents").delete().eq("id", documentId);
    if (error) throw new DocumentError("Failed to delete document.", "DELETE_ERROR", { cause: error.message });
  },
};
