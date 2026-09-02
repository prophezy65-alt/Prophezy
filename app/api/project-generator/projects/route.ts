/**
 * app/api/project-generator/projects/route.ts
 *
 * GET  - list/search/filter the current user's saved projects
 * POST - generate a new project: creates a draft row, runs the real
 *        generation pipeline (lib/project-generator/services/generation-orchestrator.service.ts),
 *        persists every artifact, and returns the saved project.
 */

import { randomUUID } from "node:crypto";
import {
  DEFAULT_GENERATION_PREFERENCES,
  GenerationSourceType,
  isGenerationComplete,
  type GenerationRequest,
} from "@/lib/project-generator/models";
import {
  EngineAICoreClient,
  createDefaultServiceContext,
  LocalFilesystemBundleUploader,
  runGenerationPipeline,
} from "@/lib/project-generator/services";
import { projectPersistenceService } from "@/lib/project-generator/services/project-persistence.service";
import { requireApiUser } from "@/lib/project-generator/http/auth";
import { ok, fail } from "@/lib/project-generator/http/response";
import { ValidationHttpError } from "@/lib/project-generator/http/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const url = new URL(request.url);

    const projects = await projectPersistenceService.list(user.id, {
      search: url.searchParams.get("search") ?? undefined,
      domain: url.searchParams.get("domain") ?? undefined,
      status: (url.searchParams.get("status") as never) ?? undefined,
      favoriteOnly: url.searchParams.get("favorite") === "true",
      archivedOnly: url.searchParams.get("archived") === "true",
      limit: url.searchParams.get("limit") ? Number(url.searchParams.get("limit")) : undefined,
      cursor: url.searchParams.get("cursor") ?? undefined,
    });

    return ok({ projects });
  } catch (error) {
    return fail(error);
  }
}

interface GenerateProjectRequestBody {
  idea: string;
  title?: string;
  preferredDomains?: string[];
  targetDifficulty?: string;
  targetScale?: string;
  maxModules?: number;
}

export async function POST(request: Request) {
  let user;
  try {
    user = await requireApiUser();
  } catch (error) {
    return fail(error);
  }

  let body: GenerateProjectRequestBody;
  try {
    body = (await request.json()) as GenerateProjectRequestBody;
  } catch {
    return fail(new ValidationHttpError("Request body must be valid JSON."));
  }

  if (!body.idea || body.idea.trim().length === 0) {
    return fail(new ValidationHttpError("`idea` is required and must be non-empty."));
  }

  const draft = await projectPersistenceService.createDraft({
    userId: user.id,
    title: body.title?.trim() || "Generating project...",
    domains: body.preferredDomains ?? [],
  });

  try {
    const generationRequest: GenerationRequest = {
      id: randomUUID(),
      userId: user.id,
      source: { type: GenerationSourceType.IDEA, text: body.idea },
      preferences: {
        ...DEFAULT_GENERATION_PREFERENCES,
        preferredDomains: (body.preferredDomains as never) ?? DEFAULT_GENERATION_PREFERENCES.preferredDomains,
        targetDifficulty: (body.targetDifficulty as never) ?? null,
        targetScale: (body.targetScale as never) ?? null,
        maxModules: body.maxModules ?? null,
      },
      createdAt: new Date().toISOString(),
    };

    const defaults = createDefaultServiceContext("project-generator");
    const context = { ...defaults, aiCore: new EngineAICoreClient(defaults.cache, defaults.logger) };
    // NOTE: LocalFilesystemBundleUploader writes to /tmp, which is ephemeral
    // in serverless deployments (fine for a single request's lifetime, but
    // won't survive between invocations). Swap for a Supabase Storage-backed
    // BundleUploader before relying on export downloads working later.
    const uploader = new LocalFilesystemBundleUploader("/tmp/project-generator-exports");

    const result = await runGenerationPipeline(generationRequest, { context, uploader });

    if (!isGenerationComplete(result) || !result.projectSpec || !result.exportBundle) {
      const message = result.error?.message ?? "Generation did not complete successfully.";
      await projectPersistenceService.markFailed(draft.id, message);
      return fail(new Error(message));
    }

    const saved = await projectPersistenceService.saveGeneratedResult(draft.id, {
      spec: result.projectSpec,
      databaseSchema: result.databaseSchema!,
      apiDesign: result.apiDesign!,
      roadmap: result.roadmap!,
      diagrams: result.diagrams!,
      deploymentPlan: result.deploymentPlan!,
      testingPlan: result.testingPlan!,
      securityPlan: result.securityPlan!,
      estimation: result.estimation!,
      exportBundlePath: result.exportBundle.storagePath,
    });

    return ok({ project: saved });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await projectPersistenceService.markFailed(draft.id, message).catch(() => {
      /* best-effort — don't mask the original error if this write also fails */
    });
    return fail(error);
  }
}
