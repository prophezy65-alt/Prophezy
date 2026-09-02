/**
 * lib/project-generator/services/generation-orchestrator.service.ts
 *
 * Runs the full Project Generator pipeline for one `GenerationRequest`:
 * parse source -> project spec -> database schema -> API design -> roadmap
 * -> diagrams -> deployment plan -> testing plan -> security plan ->
 * estimation -> export bundle. Emits a `GenerationProgressEvent` before
 * each step and short-circuits with a `FAILED` result on the first error,
 * preserving every artifact produced up to that point.
 */

import {
  DiagramType,
  GenerationRequest,
  GenerationResult,
  GenerationStatus,
  Result,
  err,
  ok,
} from "../models";
import type { BundleUploader } from "./export.service";
import { generateApiDesign } from "./api-design.service";
import { generateDatabaseSchema } from "./database-schema.service";
import { generateDeploymentPlan } from "./deployment.service";
import { generateDiagrams } from "./diagram.service";
import { generateEstimation } from "./estimation.service";
import { generateExportBundle } from "./export.service";
import { generateProjectSpec } from "./project-spec.service";
import { generateRoadmap } from "./roadmap.service";
import { generateSecurityPlan } from "./security.service";
import { parseGenerationSource, type DocumentExtractor } from "./source-parser.service";
import { generateTestingPlan } from "./testing.service";
import type { ServiceContext } from "./types";

export interface OrchestratorDependencies {
  readonly context: ServiceContext;
  readonly uploader: BundleUploader;
  readonly documentExtractor?: DocumentExtractor;
  readonly requestedDiagramTypes?: readonly DiagramType[];
}

type MutableResult = {
  status: GenerationStatus;
  progress: GenerationResult["progress"][number][];
  error: GenerationResult["error"];
  projectSpec: GenerationResult["projectSpec"];
  databaseSchema: GenerationResult["databaseSchema"];
  apiDesign: GenerationResult["apiDesign"];
  roadmap: GenerationResult["roadmap"];
  diagrams: GenerationResult["diagrams"];
  deploymentPlan: GenerationResult["deploymentPlan"];
  testingPlan: GenerationResult["testingPlan"];
  securityPlan: GenerationResult["securityPlan"];
  estimation: GenerationResult["estimation"];
  exportBundle: GenerationResult["exportBundle"];
};

const STEP_WEIGHT_PERCENT: Record<GenerationStatus, number> = {
  [GenerationStatus.QUEUED]: 0,
  [GenerationStatus.PARSING_SOURCE]: 5,
  [GenerationStatus.GENERATING_SPEC]: 20,
  [GenerationStatus.GENERATING_ARCHITECTURE]: 35, // reserved for a future architecture-diagram-first step
  [GenerationStatus.GENERATING_DATABASE]: 40,
  [GenerationStatus.GENERATING_API]: 55,
  [GenerationStatus.GENERATING_ROADMAP]: 65,
  [GenerationStatus.GENERATING_DIAGRAMS]: 75,
  [GenerationStatus.GENERATING_DOCS]: 90,
  [GenerationStatus.ASSEMBLING_EXPORT]: 95,
  [GenerationStatus.COMPLETED]: 100,
  [GenerationStatus.FAILED]: 100,
};

/**
 * Runs the full generation pipeline. Always returns a `GenerationResult`
 * (never throws) — check `.status` / `isGenerationComplete()` /
 * `isGenerationFailed()` from `models/generation-result.model.ts`.
 */
export async function runGenerationPipeline(
  request: GenerationRequest,
  deps: OrchestratorDependencies
): Promise<GenerationResult> {
  const { context } = deps;
  const startedAtMs = context.clock.nowMs();

  const state: MutableResult = {
    status: GenerationStatus.QUEUED,
    progress: [],
    error: null,
    projectSpec: null,
    databaseSchema: null,
    apiDesign: null,
    roadmap: null,
    diagrams: null,
    deploymentPlan: null,
    testingPlan: null,
    securityPlan: null,
    estimation: null,
    exportBundle: null,
  };

  const emit = (status: GenerationStatus, message: string): void => {
    state.status = status;
    state.progress.push({
      status,
      message,
      occurredAt: context.clock.nowISO(),
      percentComplete: STEP_WEIGHT_PERCENT[status],
    });
    context.logger.info(`generation-orchestrator: ${status}`, { generationRequestId: request.id, message });
  };

  function finalize(): GenerationResult {
    return {
      id: context.ids.newId(),
      generationRequestId: request.id,
      status: state.status,
      metadata: {
        generationId: request.id,
        userId: request.userId,
        createdAt: request.createdAt,
        aiModelUsed: "ai-core", // the concrete model tier is chosen internally by lib/ai/engine.ts's routing
        promptVersion: "v1",
        durationMs: context.clock.nowMs() - startedAtMs,
      },
      progress: state.progress,
      error: state.error,
      projectSpec: state.projectSpec,
      databaseSchema: state.databaseSchema,
      apiDesign: state.apiDesign,
      roadmap: state.roadmap,
      diagrams: state.diagrams,
      deploymentPlan: state.deploymentPlan,
      testingPlan: state.testingPlan,
      securityPlan: state.securityPlan,
      estimation: state.estimation,
      exportBundle: state.exportBundle,
    };
  }

  function fail(step: string, result: Result<unknown, GenerationResult["error"]>): GenerationResult {
    if (result.ok) throw new Error(`fail() called with an ok result at step "${step}".`); // defensive; never reached in practice
    state.error = result.error;
    emit(GenerationStatus.FAILED, `${step} failed: ${result.error?.message ?? "unknown error"}`);
    return finalize();
  }

  // 1. Parse source
  emit(GenerationStatus.PARSING_SOURCE, "Extracting plain text from the submitted source.");
  const sourceResult = await parseGenerationSource(request.source, context, request.userId, deps.documentExtractor);
  if (!sourceResult.ok) return fail("parseGenerationSource", sourceResult);

  // 2. Project spec
  emit(GenerationStatus.GENERATING_SPEC, "Generating the project specification.");
  const specResult = await generateProjectSpec(request, sourceResult.value, context);
  if (!specResult.ok) return fail("generateProjectSpec", specResult);
  state.projectSpec = specResult.value;

  // 3. Database schema
  emit(GenerationStatus.GENERATING_DATABASE, "Designing the database schema.");
  const schemaResult = await generateDatabaseSchema(specResult.value, context);
  if (!schemaResult.ok) return fail("generateDatabaseSchema", schemaResult);
  state.databaseSchema = schemaResult.value;

  // 4. API design
  emit(GenerationStatus.GENERATING_API, "Designing the REST API surface.");
  const apiResult = await generateApiDesign(specResult.value, schemaResult.value, context);
  if (!apiResult.ok) return fail("generateApiDesign", apiResult);
  state.apiDesign = apiResult.value;

  // 5. Roadmap
  emit(GenerationStatus.GENERATING_ROADMAP, "Building the phased roadmap.");
  const roadmapResult = await generateRoadmap(specResult.value, context);
  if (!roadmapResult.ok) return fail("generateRoadmap", roadmapResult);
  state.roadmap = roadmapResult.value;

  // 6. Diagrams
  emit(GenerationStatus.GENERATING_DIAGRAMS, "Rendering architecture and flow diagrams.");
  const diagramsResult = await generateDiagrams(
    specResult.value,
    schemaResult.value,
    context,
    deps.requestedDiagramTypes
  );
  if (!diagramsResult.ok) return fail("generateDiagrams", diagramsResult);
  state.diagrams = diagramsResult.value;

  // 7. Deployment plan
  emit(GenerationStatus.GENERATING_DOCS, "Writing deployment guides and CI/CD pipeline.");
  const deploymentResult = await generateDeploymentPlan(specResult.value, context);
  if (!deploymentResult.ok) return fail("generateDeploymentPlan", deploymentResult);
  state.deploymentPlan = deploymentResult.value;

  // 8. Testing plan
  const testingResult = await generateTestingPlan(specResult.value, apiResult.value, context);
  if (!testingResult.ok) return fail("generateTestingPlan", testingResult);
  state.testingPlan = testingResult.value;

  // 9. Security plan
  const securityResult = await generateSecurityPlan(specResult.value, apiResult.value, context);
  if (!securityResult.ok) return fail("generateSecurityPlan", securityResult);
  state.securityPlan = securityResult.value;

  // 10. Estimation (deterministic, no AI call)
  const estimationResult = await generateEstimation(specResult.value, roadmapResult.value, context);
  if (!estimationResult.ok) return fail("generateEstimation", estimationResult);
  state.estimation = estimationResult.value;

  // 11. Export bundle
  emit(GenerationStatus.ASSEMBLING_EXPORT, "Packaging the export bundle.");
  const exportResult = await generateExportBundle(
    {
      spec: specResult.value,
      schema: schemaResult.value,
      apiDesign: apiResult.value,
      roadmap: roadmapResult.value,
      diagrams: diagramsResult.value,
      deploymentPlan: deploymentResult.value,
      testingPlan: testingResult.value,
      securityPlan: securityResult.value,
      estimation: estimationResult.value,
    },
    context,
    deps.uploader
  );
  if (!exportResult.ok) return fail("generateExportBundle", exportResult);
  state.exportBundle = exportResult.value;

  emit(GenerationStatus.COMPLETED, "Generation completed successfully.");
  return finalize();
}

/** Convenience re-export so callers only need one import for the whole pipeline result type. */
export type { GenerationResult } from "../models";
export { ok, err };
