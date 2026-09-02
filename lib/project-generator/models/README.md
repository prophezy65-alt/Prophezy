# `lib/project-generator/models/`

Type definitions and structural validators for the Project Generator backend.
This module has **zero runtime dependencies**, calls no APIs, and touches no
database — it is pure TypeScript types plus small, pure validation
functions. Every other Project Generator module (`services/`, `prompts/`,
`validation/`, `export/`, etc.) imports from here rather than from each
other's internals, so this is the single source of truth for shapes.

## Files

| File | Purpose |
|---|---|
| `enums.ts` | Every shared string-literal union (project domains, source types, difficulty, auth strategy, diagram type, deployment target, etc.) |
| `shared.model.ts` | Cross-cutting primitives: `Result<T,E>`, `GenerationError`, `ScoreValue`, `NumericRange`, pagination, type guards |
| `generation-request.model.ts` | The raw input a user submits (idea / prompt / PDF / image / voice / flowchart) plus generation preferences |
| `project-spec.model.ts` | The central aggregate: title, objectives, scope, modules, features, folder structure, tech stack, difficulty/complexity |
| `database-schema.model.ts` | Tables, columns, indexes, foreign keys, views, triggers, RLS policies, storage buckets |
| `api-design.model.ts` | REST resources/endpoints, request/response field schemas, error responses, auth requirements |
| `roadmap.model.ts` | Phases, tasks, dependencies, milestones, timeline — includes a dependency-cycle detector |
| `diagram.model.ts` | Mermaid-source-backed diagrams (flowchart, ER, class, sequence, use case, architecture, folder) |
| `deployment.model.ts` | Per-target deployment guides (Vercel/Railway/Render/Docker/AWS/Azure/GCP/Supabase) + CI/CD pipeline |
| `testing.model.ts` | Test suites/cases across unit, integration, API, edge-case and e2e |
| `security.model.ts` | Rate limits, input validation rules, auth flow, RBAC roles/permissions, sanitization rules |
| `estimation.model.ts` | Cost/effort/difficulty/complexity estimates derived from a spec + roadmap |
| `export.model.ts` | README rendering, GitHub templates, and the export manifest (md/pdf/docx/html/json/zip) |
| `generation-result.model.ts` | Top-level aggregate returned to callers: every artifact for one generation run, plus progress/status tracking and cross-artifact referential validation |
| `index.ts` | Barrel export — import from `lib/project-generator/models`, not individual files |

## Design principles

- **Immutable by default.** Every field is `readonly`; arrays are
  `readonly T[]`. Services build new objects rather than mutating shared state.
- **IDs are UUID strings**, validated with `isUUID()` from `shared.model.ts`.
- **No `any`.** Discriminated unions (`GenerationSource`, `Result<T,E>`) are
  used wherever a field's shape depends on another field's value.
- **Self-validating.** Every aggregate model exports a `validateX()` function
  that checks structural invariants (referential integrity between IDs,
  numeric ranges, sequential ordering, cycle detection for task
  dependencies, Mermaid directive matching, etc.). These are intentionally
  *not* the full business-rule validation layer (see `validation/`) — they
  only guard the invariants a model owns about its own shape.
- **Diagrams are Mermaid-first.** `Diagram.mermaidSource` is always the
  rendering source of truth; `nodes`/`edges` are a structured mirror kept in
  sync for programmatic use (search, layout, diffing).
- **Cross-artifact integrity.** `generation-result.model.ts` re-validates
  every populated artifact and additionally confirms each artifact's
  `projectSpecId` matches the result's own `ProjectSpec.id`, preventing
  artifacts from one generation run leaking into another.

## Usage

```typescript
import {
  ProjectSpec,
  validateProjectSpec,
  GenerationSourceType,
  type GenerationSource,
} from "lib/project-generator/models";

const source: GenerationSource = {
  type: GenerationSourceType.IDEA,
  text: "A habit tracker with AI-generated weekly insights",
};

// ...pass to services/ to build a full ProjectSpec, then:
const problems = validateProjectSpec(spec);
if (problems.length > 0) {
  throw new Error(`Invalid ProjectSpec: ${problems.join("; ")}`);
}
```

## Verified

This module was compiled with `tsc --strict --noUnusedLocals
--noUnusedParameters --noImplicitReturns --noFallthroughCasesInSwitch` and
passes with zero errors.

## What's next

`models/` has no dependents yet inside this backend — it's the foundation.
The next module to build on top of it is `validation/` (Zod-free, but
richer business-rule checks than the structural guards here) or
`services/` (e.g. `project-spec.service.ts`, which will call the AI Core
via `lib/ai/engine.ts` to turn a `GenerationRequest` into a `ProjectSpec`).
