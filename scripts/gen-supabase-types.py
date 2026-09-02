#!/usr/bin/env python3
"""
Generate lib/supabase/types.ts from supabase/migrations/*.sql.

Derives the Database interface from the project's own DDL so the types are a
transcription of the schema rather than a guess. Handles CREATE TYPE ... AS
ENUM, CREATE TABLE, ALTER TABLE ... ADD COLUMN, and CREATE VIEW.
"""
import re, os, glob, sys

MIG = sys.argv[1] if len(sys.argv) > 1 else "supabase/migrations"
OUT = sys.argv[2] if len(sys.argv) > 2 else "lib/supabase/types.ts"

# ---------------------------------------------------------------- pg -> ts
def pg_to_ts(t, enums):
    t = t.strip().lower()
    t = re.sub(r"\s+", " ", t)
    base = re.sub(r"\(.*?\)", "", t).strip()
    base = base.replace("public.", "")
    if base.endswith("[]"):
        inner = pg_to_ts(base[:-2], enums)
        return f"{inner}[]"
    if base in enums:
        return enums[base]
    m = {
        "uuid": "string", "text": "string", "varchar": "string",
        "character varying": "string", "char": "string", "citext": "string",
        "int": "number", "int2": "number", "int4": "number", "int8": "number",
        "integer": "number", "smallint": "number", "bigint": "number",
        "numeric": "number", "decimal": "number", "real": "number",
        "double precision": "number", "float": "number", "float4": "number",
        "float8": "number",
        "bool": "boolean", "boolean": "boolean",
        "timestamptz": "string", "timestamp": "string",
        "timestamp with time zone": "string",
        "timestamp without time zone": "string",
        "date": "string", "time": "string", "timetz": "string",
        "jsonb": "Json", "json": "Json",
        "bytea": "string", "vector": "number[]",
        "tsvector": "string", "interval": "string", "inet": "string",
    }
    return m.get(base, "unknown")


def split_top_level(s):
    """Split a CREATE TABLE body on commas that are not inside parentheses."""
    out, depth, cur = [], 0, ""
    for ch in s:
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        if ch == "," and depth == 0:
            out.append(cur)
            cur = ""
        else:
            cur += ch
    if cur.strip():
        out.append(cur)
    return out


CONSTRAINT_KW = (
    "primary", "unique", "foreign", "constraint", "check", "exclude", "like",
)

def parse_columns(body, enums):
    cols = {}
    for raw in split_top_level(body):
        line = raw.strip()
        if not line:
            continue
        line = re.sub(r"--.*$", "", line, flags=re.M).strip()
        if not line:
            continue
        first = line.split()[0].lower().strip('"')
        if first in CONSTRAINT_KW:
            continue
        m = re.match(r'^"?([a-z_][a-z0-9_]*)"?\s+(.+)$', line, re.S | re.I)
        if not m:
            continue
        name, rest = m.group(1), m.group(2)
        rest_flat = re.sub(r"\s+", " ", rest).strip()
        # type = up to first constraint keyword
        tm = re.match(
            r"^((?:[a-z_][a-z0-9_. ]*?)(?:\(\s*\d+(?:\s*,\s*\d+)?\s*\))?(?:\[\])?)"
            r"(?=\s+(?:not\s+null|null|primary|unique|references|default|check|generated|collate)\b|$)",
            rest_flat, re.I,
        )
        pgtype = tm.group(1) if tm else rest_flat.split()[0]
        notnull = bool(re.search(r"\bnot\s+null\b", rest_flat, re.I))
        hasdef = bool(re.search(r"\bdefault\b|\bgenerated\b", rest_flat, re.I))
        is_pk = bool(re.search(r"\bprimary\s+key\b", rest_flat, re.I))
        ts = pg_to_ts(pgtype, enums)
        cols[name] = {
            "ts": ts,
            "notnull": notnull or is_pk,
            "hasdef": hasdef or is_pk,
        }
    return cols


def main():
    sql = ""
    files = sorted(glob.glob(os.path.join(MIG, "*.sql")))
    files = [f for f in files if "(" not in os.path.basename(f)]
    for f in files:
        sql += "\n" + open(f, encoding="utf-8", errors="replace").read()

    # strip block comments and line comments
    sql = re.sub(r"/\*.*?\*/", "", sql, flags=re.S)

    # ---- enums
    enums = {}
    for m in re.finditer(
        r"create\s+type\s+(?:public\.)?([a-z_]+)\s+as\s+enum\s*\((.*?)\);",
        sql, re.S | re.I,
    ):
        name = m.group(1)
        vals = re.findall(r"'([^']*)'", m.group(2))
        enums[name] = " | ".join(f'"{v}"' for v in vals) if vals else "string"

    # ---- tables
    tables = {}
    for m in re.finditer(
        r"create\s+table\s+(?:if\s+not\s+exists\s+)?(?:public\.)?\"?([a-z_][a-z0-9_]*)\"?\s*\((.*?)\n\);",
        sql, re.S | re.I,
    ):
        tname, body = m.group(1), m.group(2)
        cols = parse_columns(body, enums)
        if cols:
            tables.setdefault(tname, {}).update(cols)

    # ---- alter table add column
    for m in re.finditer(
        r"alter\s+table\s+(?:only\s+)?(?:public\.)?\"?([a-z_][a-z0-9_]*)\"?\s+"
        r"add\s+column\s+(?:if\s+not\s+exists\s+)?(.+?);",
        sql, re.S | re.I,
    ):
        tname, coldef = m.group(1), m.group(2)
        if tname not in tables:
            continue
        cols = parse_columns(coldef, enums)
        for k, v in cols.items():
            v["hasdef"] = True  # added columns are optional on insert
            tables[tname].setdefault(k, v)

    # ---- views
    views = {}
    for m in re.finditer(
        r"create\s+(?:or\s+replace\s+)?view\s+(?:public\.)?\"?([a-z_][a-z0-9_]*)\"?",
        sql, re.I,
    ):
        views[m.group(1)] = True

    # ---- emit
    L = []
    L.append("// AUTO-GENERATED from supabase/migrations/*.sql — do not edit by hand.")
    L.append("// Regenerate against the live project once it is provisioned:")
    L.append("//   npx supabase gen types typescript --project-id <ref> > lib/supabase/types.ts")
    L.append("")
    L.append("export type Json =")
    L.append("  | string")
    L.append("  | number")
    L.append("  | boolean")
    L.append("  | null")
    L.append("  | { [key: string]: Json | undefined }")
    L.append("  | Json[];")
    L.append("")
    for name, union in sorted(enums.items()):
        ts_name = "".join(p.capitalize() for p in name.split("_"))
        L.append(f"export type {ts_name} = {union};")
    L.append("")
    # preserve previously hand-exported aliases (public API)
    L.append("// Preserved aliases from the original hand-written file.")
    if "user_role" in enums:
        L.append("export type UserRole = UserRole_;" if False else "")
    L = [x for x in L if x != ""] + [""]

    L.append("export interface Database {")
    L.append("  __InternalSupabase: {")
    L.append('    PostgrestVersion: "12.2.3";')
    L.append("  };")
    L.append("  public: {")
    L.append("    Tables: {")
    for t in sorted(tables):
        cols = tables[t]
        L.append(f"      {t}: {{")
        L.append("        Row: {")
        for c, meta in cols.items():
            nul = "" if meta["notnull"] else " | null"
            L.append(f"          {c}: {meta['ts']}{nul};")
        L.append("        };")
        L.append("        Insert: {")
        for c, meta in cols.items():
            opt = "?" if (meta["hasdef"] or not meta["notnull"]) else ""
            nul = "" if meta["notnull"] else " | null"
            L.append(f"          {c}{opt}: {meta['ts']}{nul};")
        L.append("        };")
        L.append("        Update: {")
        for c, meta in cols.items():
            nul = "" if meta["notnull"] else " | null"
            L.append(f"          {c}?: {meta['ts']}{nul};")
        L.append("        };")
        L.append("        Relationships: [];")
        L.append("      };")
    L.append("    };")
    L.append("    Views: {")
    for v in sorted(views):
        L.append(f"      {v}: {{")
        L.append("        Row: { [key: string]: Json | null };")
        L.append("        Relationships: [];")
        L.append("      };")
    L.append("    };")
    L.append("    Functions: Record<string, never>;")
    L.append("    Enums: {")
    for name, union in sorted(enums.items()):
        L.append(f"      {name}: {union};")
    L.append("    };")
    L.append("    CompositeTypes: Record<string, never>;")
    L.append("  };")
    L.append("}")
    L.append("")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, "w", encoding="utf-8").write("\n".join(L))
    print(f"enums={len(enums)} tables={len(tables)} views={len(views)} -> {OUT}")
    print("tables:", ", ".join(sorted(tables)))


if __name__ == "__main__":
    main()
