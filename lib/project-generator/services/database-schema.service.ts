/**
 * lib/project-generator/services/database-schema.service.ts
 *
 * Derives a `DatabaseSchema` (tables, columns, indexes, foreign keys,
 * views, triggers, RLS policies, storage buckets) from an existing
 * `ProjectSpec` via the AI Core. This describes a schema for the
 * *generated* project — it never touches Prophezy's own database.
 */

import {
  DatabaseColumnType,
  DatabaseSchema,
  ProjectSpec,
  Result,
  GenerationError,
  ok,
  err,
  validateDatabaseSchema,
} from "../models";
import { validationFailedError } from "./errors";
import { assertString, assertArray, assertObject, coerceEnum, coerceBoolean, coerceString } from "./parsing";
import type { ServiceContext } from "./types";

const FEATURE_KEY = "project-generator.database-schema";
const CACHE_TTL_SECONDS = 60 * 60;

interface RawColumn {
  readonly name: string;
  readonly type: string;
  readonly enumValues: readonly string[] | null;
  readonly nullable: boolean;
  readonly defaultValue: string | null;
  readonly isPrimaryKey: boolean;
  readonly isUnique: boolean;
  readonly description: string;
}

interface RawForeignKey {
  readonly columnName: string;
  readonly referencesTable: string;
  readonly referencesColumn: string;
  readonly onDelete: string;
  readonly onUpdate: string;
}

interface RawIndex {
  readonly name: string;
  readonly columns: readonly string[];
  readonly unique: boolean;
  readonly method: string;
}

interface RawPolicy {
  readonly name: string;
  readonly command: string;
  readonly role: string;
  readonly usingExpression: string | null;
  readonly withCheckExpression: string | null;
  readonly description: string;
}

interface RawTrigger {
  readonly name: string;
  readonly timing: string;
  readonly event: string;
  readonly functionName: string;
  readonly description: string;
}

interface RawTable {
  readonly name: string;
  readonly description: string;
  readonly columns: readonly RawColumn[];
  readonly foreignKeys: readonly RawForeignKey[];
  readonly indexes: readonly RawIndex[];
  readonly policies: readonly RawPolicy[];
  readonly triggers: readonly RawTrigger[];
  readonly rlsEnabled: boolean;
}

interface RawView {
  readonly name: string;
  readonly description: string;
  readonly selectStatement: string;
  readonly sourceTables: readonly string[];
}

interface RawStorageBucket {
  readonly name: string;
  readonly public: boolean;
  readonly allowedMimeTypes: readonly string[];
  readonly maxFileSizeBytes: number;
  readonly description: string;
}

interface RawDatabaseSchemaResponse {
  readonly schemaName: string;
  readonly tables: readonly RawTable[];
  readonly views: readonly RawView[];
  readonly storageBuckets: readonly RawStorageBucket[];
}

function parseColumn(raw: unknown, path: string): RawColumn {
  const c = assertObject(raw, path);
  return {
    name: assertString(c.name, `${path}.name`),
    // type is normalized through coerceEnum downstream (see
    // normalizeTable), so tolerate a missing/blank value here rather than
    // requiring the AI to get the exact literal right up front.
    type: coerceString(c.type, ""),
    enumValues: c.enumValues ? assertArray(c.enumValues, `${path}.enumValues`).map((v, i) => assertString(v, `${path}.enumValues[${i}]`)) : null,
    nullable: coerceBoolean(c.nullable, true),
    defaultValue: c.defaultValue === null || c.defaultValue === undefined ? null : assertString(c.defaultValue, `${path}.defaultValue`),
    isPrimaryKey: coerceBoolean(c.isPrimaryKey, false),
    isUnique: coerceBoolean(c.isUnique, false),
    description: coerceString(c.description, "No description provided."),
  };
}

/**
 * Returns null (rather than throwing) when a foreign key is missing a
 * structurally load-bearing field (columnName/referencesTable/
 * referencesColumn). Unlike `description` or `role`, these fields define
 * what the FK actually IS — fabricating a fake column name would produce
 * broken SQL, which is worse than simply dropping that one malformed FK
 * entry and keeping the rest of the schema intact. The caller filters out
 * the nulls.
 */
function tryParseForeignKey(raw: unknown, path: string): RawForeignKey | null {
  const fk = assertObject(raw, path);
  const columnName = typeof fk.columnName === "string" && fk.columnName.trim().length > 0 ? fk.columnName : null;
  const referencesTable =
    typeof fk.referencesTable === "string" && fk.referencesTable.trim().length > 0 ? fk.referencesTable : null;
  const referencesColumn =
    typeof fk.referencesColumn === "string" && fk.referencesColumn.trim().length > 0 ? fk.referencesColumn : null;

  if (!columnName || !referencesTable || !referencesColumn) return null;

  return {
    columnName,
    referencesTable,
    referencesColumn,
    onDelete: coerceString(fk.onDelete, "RESTRICT"),
    onUpdate: coerceString(fk.onUpdate, "RESTRICT"),
  };
}

/**
 * Returns null (rather than throwing) when an index is missing its
 * load-bearing fields (name/columns) — same rationale as
 * tryParseForeignKey: an index with no real columns isn't valid SQL, so
 * dropping just this one index keeps the rest of the table intact instead
 * of failing the whole schema.
 */
function tryParseIndex(raw: unknown, path: string): RawIndex | null {
  const idx = assertObject(raw, path);
  const name = typeof idx.name === "string" && idx.name.trim().length > 0 ? idx.name : null;
  const columns = Array.isArray(idx.columns) ? idx.columns.filter((c): c is string => typeof c === "string" && c.trim().length > 0) : [];
  if (!name || columns.length === 0) return null;
  return {
    name,
    columns,
    unique: coerceBoolean(idx.unique, false),
    // method is normalized through coerceEnum downstream (see
    // normalizeTable), so pass an empty string through rather than
    // requiring the AI to get this exactly right up front.
    method: coerceString(idx.method, ""),
  };
}

/**
 * Returns null when a policy is missing its name — a nameless RLS policy
 * isn't valid SQL and can't be reliably referenced, so it's dropped rather
 * than failing the whole schema (same rationale as tryParseForeignKey).
 */
function tryParsePolicy(raw: unknown, path: string): RawPolicy | null {
  const p = assertObject(raw, path);
  const name = typeof p.name === "string" && p.name.trim().length > 0 ? p.name : null;
  if (!name) return null;
  return {
    name,
    // command is normalized through coerceEnum downstream, so tolerate a
    // missing/blank value here instead of requiring it up front.
    command: coerceString(p.command, ""),
    role: coerceString(p.role, "authenticated"),
    usingExpression: p.usingExpression === null || p.usingExpression === undefined ? null : assertString(p.usingExpression, `${path}.usingExpression`),
    withCheckExpression: p.withCheckExpression === null || p.withCheckExpression === undefined ? null : assertString(p.withCheckExpression, `${path}.withCheckExpression`),
    description: coerceString(p.description, "No description provided."),
  };
}

/**
 * Returns null when a trigger is missing its name or target function —
 * both are load-bearing (the function must exist for the trigger to mean
 * anything), so an incomplete trigger is dropped rather than failing the
 * whole schema.
 */
function tryParseTrigger(raw: unknown, path: string): RawTrigger | null {
  const t = assertObject(raw, path);
  const name = typeof t.name === "string" && t.name.trim().length > 0 ? t.name : null;
  const functionName = typeof t.functionName === "string" && t.functionName.trim().length > 0 ? t.functionName : null;
  if (!name || !functionName) return null;
  return {
    name,
    // timing/event are normalized through coerceEnum downstream.
    timing: coerceString(t.timing, ""),
    event: coerceString(t.event, ""),
    functionName,
    description: coerceString(t.description, "No description provided."),
  };
}

function parseTable(raw: unknown, path: string): RawTable {
  const t = assertObject(raw, path);
  return {
    name: assertString(t.name, `${path}.name`),
    description: coerceString(t.description, "No description provided."),
    columns: assertArray(t.columns, `${path}.columns`).map((c, i) => parseColumn(c, `${path}.columns[${i}]`)),
    foreignKeys: assertArray(t.foreignKeys ?? [], `${path}.foreignKeys`)
      .map((fk, i) => tryParseForeignKey(fk, `${path}.foreignKeys[${i}]`))
      .filter((fk): fk is RawForeignKey => fk !== null),
    indexes: assertArray(t.indexes ?? [], `${path}.indexes`)
      .map((idx, i) => tryParseIndex(idx, `${path}.indexes[${i}]`))
      .filter((idx): idx is RawIndex => idx !== null),
    policies: assertArray(t.policies ?? [], `${path}.policies`)
      .map((p, i) => tryParsePolicy(p, `${path}.policies[${i}]`))
      .filter((p): p is RawPolicy => p !== null),
    triggers: assertArray(t.triggers ?? [], `${path}.triggers`)
      .map((tr, i) => tryParseTrigger(tr, `${path}.triggers[${i}]`))
      .filter((tr): tr is RawTrigger => tr !== null),
    rlsEnabled: coerceBoolean(t.rlsEnabled, true),
  };
}

/**
 * Returns null when a view is missing its name or SQL body — a view
 * without a select statement is meaningless, so it's dropped rather than
 * failing the whole schema (same rationale as tryParseForeignKey).
 */
function tryParseView(raw: unknown, path: string): RawView | null {
  const v = assertObject(raw, path);
  const name = typeof v.name === "string" && v.name.trim().length > 0 ? v.name : null;
  const selectStatement = typeof v.selectStatement === "string" && v.selectStatement.trim().length > 0 ? v.selectStatement : null;
  if (!name || !selectStatement) return null;
  return {
    name,
    description: coerceString(v.description, "No description provided."),
    selectStatement,
    sourceTables: assertArray(v.sourceTables ?? [], `${path}.sourceTables`).map((s, i) => assertString(s, `${path}.sourceTables[${i}]`)),
  };
}

function parseStorageBucket(raw: unknown, path: string): RawStorageBucket {
  const b = assertObject(raw, path);
  return {
    name: assertString(b.name, `${path}.name`),
    public: coerceBoolean(b.public, false),
    // allowedMimeTypes is supplementary detail on a real bucket (name is
    // its identity) — default to [] rather than failing the whole schema.
    allowedMimeTypes: assertArray(b.allowedMimeTypes ?? [], `${path}.allowedMimeTypes`).map((m, i) => assertString(m, `${path}.allowedMimeTypes[${i}]`)),
    maxFileSizeBytes: typeof b.maxFileSizeBytes === "number" ? b.maxFileSizeBytes : 10 * 1024 * 1024,
    description: coerceString(b.description, "No description provided."),
  };
}

function parseRawDatabaseSchemaResponse(raw: unknown): RawDatabaseSchemaResponse {
  const r = assertObject(raw, "$");
  const tables = assertArray(r.tables, "tables").map((t, i) => parseTable(t, `tables[${i}]`));
  if (tables.length === 0) throw new Error("tables must contain at least one entry.");
  return {
    // schemaName is bookkeeping (defaults to "public" in Postgres/Supabase
    // convention), not project content — tolerate its absence.
    schemaName: coerceString(r.schemaName, "public"),
    tables,
    views: assertArray(r.views ?? [], "views")
      .map((v, i) => tryParseView(v, `views[${i}]`))
      .filter((v): v is RawView => v !== null),
    storageBuckets: assertArray(r.storageBuckets ?? [], "storageBuckets").map((b, i) => parseStorageBucket(b, `storageBuckets[${i}]`)),
  };
}

const COLUMN_TYPE_VALUES = Object.values(DatabaseColumnType);
const ON_ACTION_VALUES = ["CASCADE", "SET NULL", "RESTRICT", "NO ACTION"] as const;
const INDEX_METHOD_VALUES = ["btree", "gin", "gist", "hash"] as const;
const POLICY_COMMAND_VALUES = ["SELECT", "INSERT", "UPDATE", "DELETE", "ALL"] as const;
const TRIGGER_TIMING_VALUES = ["BEFORE", "AFTER", "INSTEAD OF"] as const;
const TRIGGER_EVENT_VALUES = ["INSERT", "UPDATE", "DELETE"] as const;

function buildSystemPrompt(): string {
  return [
    "You are the Database Schema generator inside Prophezy's Project Generator.",
    "Given a software ProjectSpec, design a normalized PostgreSQL schema (Supabase-compatible) covering every module.",
    "",
    "Rules:",
    "- Every table needs exactly one primary key column, conventionally a uuid column named \"id\" with defaultValue \"gen_random_uuid()\".",
    "- Use snake_case for all table and column names.",
    "- foreignKeys[].referencesTable/referencesColumn MUST reference tables/columns that exist elsewhere in your own output.",
    "- Set rlsEnabled=true and include at least one policy for every table that stores user-owned data.",
    "- column type MUST be one of: " + COLUMN_TYPE_VALUES.join(", ") + ".",
    "- If column type is \"enum\", you MUST also provide a non-empty enumValues array — an enum column with no",
    "  declared values is invalid and will be silently downgraded to plain text, losing the constraint you intended.",
    "- index method MUST be one of: " + INDEX_METHOD_VALUES.join(", ") + ".",
    "- policy command MUST be one of: " + POLICY_COMMAND_VALUES.join(", ") + ".",
    "- trigger timing MUST be one of: " + TRIGGER_TIMING_VALUES.join(", ") + ", event MUST be one of: " + TRIGGER_EVENT_VALUES.join(", ") + ".",
    "",
    "Respond with ONLY a single JSON object (no prose, no Markdown fences) shaped as:",
    '{ "schemaName": string, "tables": [...], "views": [...], "storageBuckets": [...] }',
  ].join("\n");
}

function buildUserPrompt(spec: ProjectSpec): string {
  const moduleSummaries = spec.modules
    .map((m) => `- ${m.name}: ${m.description} (features: ${spec.features.filter((f) => f.moduleId === m.id).map((f) => f.name).join(", ") || "none"})`)
    .join("\n");

  return [
    `Project: ${spec.title}`,
    spec.description,
    "",
    "Modules and features:",
    moduleSummaries,
    "",
    `Tech stack includes: ${spec.techStack.map((t) => `${t.name} (${t.category})`).join(", ")}.`,
    `Project scale: ${spec.scale}.`,
  ].join("\n");
}

function normalizeTable(raw: RawTable, newId: () => string): DatabaseSchema["tables"][number] {
  return {
    id: newId(),
    name: raw.name,
    description: raw.description,
    columns: raw.columns.map((c) => {
      const requestedType = coerceEnum(c.type, COLUMN_TYPE_VALUES, DatabaseColumnType.TEXT);
      const hasEnumValues = Array.isArray(c.enumValues) && c.enumValues.length > 0;
      // A column declared "enum" with no actual values isn't valid SQL —
      // downgrading to plain text keeps the schema usable instead of
      // failing the whole generation over one column's missing constraint.
      // See buildSystemPrompt(): the AI is told this will happen, so a
      // downgraded column is a visible signal something was incomplete,
      // not a silent data-quality regression.
      const type = requestedType === DatabaseColumnType.ENUM && !hasEnumValues ? DatabaseColumnType.TEXT : requestedType;
      return {
        name: c.name,
        type,
        enumValues: hasEnumValues ? (c.enumValues as readonly string[]) : undefined,
        nullable: c.nullable,
        defaultValue: c.defaultValue,
        isPrimaryKey: c.isPrimaryKey,
        isUnique: c.isUnique,
        description: c.description,
      };
    }),
    foreignKeys: raw.foreignKeys.map((fk) => ({
      columnName: fk.columnName,
      referencesTable: fk.referencesTable,
      referencesColumn: fk.referencesColumn,
      onDelete: coerceEnum(fk.onDelete, ON_ACTION_VALUES, "RESTRICT"),
      onUpdate: coerceEnum(fk.onUpdate, ON_ACTION_VALUES, "RESTRICT"),
    })),
    indexes: raw.indexes.map((idx) => ({
      name: idx.name,
      columns: idx.columns,
      unique: idx.unique,
      method: coerceEnum(idx.method, INDEX_METHOD_VALUES, "btree"),
    })),
    policies: raw.policies.map((p) => ({
      name: p.name,
      command: coerceEnum(p.command, POLICY_COMMAND_VALUES, "SELECT"),
      role: p.role,
      usingExpression: p.usingExpression,
      withCheckExpression: p.withCheckExpression,
      description: p.description,
    })),
    triggers: raw.triggers.map((t) => ({
      name: t.name,
      timing: coerceEnum(t.timing, TRIGGER_TIMING_VALUES, "BEFORE"),
      event: coerceEnum(t.event, TRIGGER_EVENT_VALUES, "INSERT"),
      functionName: t.functionName,
      description: t.description,
    })),
    rlsEnabled: raw.rlsEnabled,
  };
}

export async function generateDatabaseSchema(
  spec: ProjectSpec,
  context: ServiceContext
): Promise<Result<DatabaseSchema, GenerationError>> {
  const aiResult = await context.aiCore.runStructured<DatabaseSchema>({
    featureKey: FEATURE_KEY,
    systemPrompt: buildSystemPrompt(),
    userPrompt: buildUserPrompt(spec),
    userId: spec.generationRequestId,
    cacheTtlSeconds: CACHE_TTL_SECONDS,
    // A real schema (multiple tables x columns/indexes/FKs/RLS policies)
    // can genuinely exceed the 8192-token default and get truncated
    // mid-JSON, which no amount of field-level tolerance can recover from.
    maxOutputTokens: 16384,
    parse: (raw) => {
      const parsed = parseRawDatabaseSchemaResponse(raw);
      const schema: DatabaseSchema = {
        id: context.ids.newId(),
        projectSpecId: spec.id,
        schemaName: parsed.schemaName,
        tables: parsed.tables.map((t) => normalizeTable(t, () => context.ids.newId())),
        views: parsed.views.map((v) => ({ ...v })),
        storageBuckets: parsed.storageBuckets.map((b) => ({ ...b })),
        migrationFilePrefix: "0001",
      };

      // Validate INSIDE parse so a structurally-well-formed but
      // semantically-invalid schema (e.g. a table missing its primary key)
      // throws here and is caught by ai-core-client's corrective-retry
      // loop — which feeds the exact validation problems back to the AI —
      // instead of being a terminal failure with zero chance to fix it.
      const problems = validateDatabaseSchema(schema);
      if (problems.length > 0) {
        throw new Error(problems.join(" "));
      }

      return schema;
    },
  });

  if (!aiResult.ok) return aiResult;

  const problems = validateDatabaseSchema(aiResult.value);
  if (problems.length > 0) {
    context.logger.error("generateDatabaseSchema: validation failed", { problems });
    return err(validationFailedError("generateDatabaseSchema", problems));
  }

  context.logger.info("generateDatabaseSchema: succeeded", {
    projectSpecId: spec.id,
    tableCount: aiResult.value.tables.length,
  });
  return ok(aiResult.value);
}