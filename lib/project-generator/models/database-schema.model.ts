/**
 * lib/project-generator/models/database-schema.model.ts
 *
 * Describes a generated PostgreSQL/Supabase database schema: tables,
 * columns, indexes, foreign keys, views, triggers, RLS policies and
 * storage buckets. This is a generic *description* of a schema — it
 * is never used to touch Prophezy's own database.
 */

import { DatabaseColumnType } from "./enums";
import { UUID, isNonEmptyString, isUUID } from "./shared.model";

export interface ColumnDefinition {
  readonly name: string;
  readonly type: DatabaseColumnType;
  readonly enumValues?: readonly string[]; // required when type === ENUM
  readonly nullable: boolean;
  readonly defaultValue: string | null; // raw SQL expression, e.g. "now()" or "gen_random_uuid()"
  readonly isPrimaryKey: boolean;
  readonly isUnique: boolean;
  readonly description: string;
}

export interface ForeignKeyDefinition {
  readonly columnName: string;
  readonly referencesTable: string;
  readonly referencesColumn: string;
  readonly onDelete: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
  readonly onUpdate: "CASCADE" | "SET NULL" | "RESTRICT" | "NO ACTION";
}

export interface IndexDefinition {
  readonly name: string;
  readonly columns: readonly string[];
  readonly unique: boolean;
  readonly method: "btree" | "gin" | "gist" | "hash";
}

export interface RowLevelSecurityPolicy {
  readonly name: string;
  readonly command: "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "ALL";
  readonly role: string; // e.g. "authenticated", "anon", "service_role"
  readonly usingExpression: string | null;
  readonly withCheckExpression: string | null;
  readonly description: string;
}

export interface TriggerDefinition {
  readonly name: string;
  readonly timing: "BEFORE" | "AFTER" | "INSTEAD OF";
  readonly event: "INSERT" | "UPDATE" | "DELETE";
  readonly functionName: string;
  readonly description: string;
}

export interface TableDefinition {
  readonly id: UUID;
  readonly name: string;
  readonly description: string;
  readonly columns: readonly ColumnDefinition[];
  readonly foreignKeys: readonly ForeignKeyDefinition[];
  readonly indexes: readonly IndexDefinition[];
  readonly policies: readonly RowLevelSecurityPolicy[];
  readonly triggers: readonly TriggerDefinition[];
  readonly rlsEnabled: boolean;
}

export interface ViewDefinition {
  readonly name: string;
  readonly description: string;
  readonly selectStatement: string;
  readonly sourceTables: readonly string[];
}

export interface StorageBucketDefinition {
  readonly name: string;
  readonly public: boolean;
  readonly allowedMimeTypes: readonly string[];
  readonly maxFileSizeBytes: number;
  readonly description: string;
}

export interface DatabaseSchema {
  readonly id: UUID;
  readonly projectSpecId: UUID;
  readonly schemaName: string; // e.g. "public"
  readonly tables: readonly TableDefinition[];
  readonly views: readonly ViewDefinition[];
  readonly storageBuckets: readonly StorageBucketDefinition[];
  readonly migrationFilePrefix: string; // e.g. "0001"
}

export function findTable(schema: DatabaseSchema, tableName: string): TableDefinition | undefined {
  return schema.tables.find((t) => t.name === tableName);
}

export function getPrimaryKeyColumns(table: TableDefinition): ColumnDefinition[] {
  return table.columns.filter((c) => c.isPrimaryKey);
}

/**
 * Validates referential integrity of a DatabaseSchema: foreign keys must
 * point at real tables/columns, primary keys must exist, enum columns
 * must declare their allowed values, and RLS policies require rlsEnabled.
 */
export function validateDatabaseSchema(schema: DatabaseSchema): string[] {
  const problems: string[] = [];

  if (!isUUID(schema.id)) problems.push("DatabaseSchema.id must be a UUID.");
  if (!isUUID(schema.projectSpecId)) problems.push("DatabaseSchema.projectSpecId must be a UUID.");
  if (!isNonEmptyString(schema.schemaName)) problems.push("DatabaseSchema.schemaName is required.");
  if (schema.tables.length === 0) problems.push("DatabaseSchema.tables must contain at least one table.");

  const tableNames = new Set(schema.tables.map((t) => t.name));
  const seenTableNames = new Set<string>();

  for (const table of schema.tables) {
    if (seenTableNames.has(table.name)) {
      problems.push(`Duplicate table name "${table.name}".`);
    }
    seenTableNames.add(table.name);

    if (getPrimaryKeyColumns(table).length === 0) {
      problems.push(`Table "${table.name}" has no primary key column.`);
    }

    const columnNames = new Set(table.columns.map((c) => c.name));
    for (const column of table.columns) {
      if (column.type === DatabaseColumnType.ENUM && (!column.enumValues || column.enumValues.length === 0)) {
        problems.push(`Column "${table.name}.${column.name}" is type enum but declares no enumValues.`);
      }
    }

    for (const fk of table.foreignKeys) {
      if (!columnNames.has(fk.columnName)) {
        problems.push(`Foreign key on "${table.name}" references unknown local column "${fk.columnName}".`);
      }
      if (!tableNames.has(fk.referencesTable)) {
        problems.push(`Foreign key on "${table.name}.${fk.columnName}" references unknown table "${fk.referencesTable}".`);
      }
    }

    for (const index of table.indexes) {
      for (const col of index.columns) {
        if (!columnNames.has(col)) {
          problems.push(`Index "${index.name}" on "${table.name}" references unknown column "${col}".`);
        }
      }
    }

    if (table.policies.length > 0 && !table.rlsEnabled) {
      problems.push(`Table "${table.name}" defines RLS policies but rlsEnabled is false.`);
    }
  }

  for (const view of schema.views) {
    for (const src of view.sourceTables) {
      if (!tableNames.has(src)) {
        problems.push(`View "${view.name}" references unknown source table "${src}".`);
      }
    }
  }

  return problems;
}
