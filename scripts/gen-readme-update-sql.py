"""
scripts/gen-readme-update-sql.py

Turns the output of fetch-readme-excerpts.py into a SQL UPDATE script.

Usage:
  python3 scripts/gen-readme-update-sql.py data/readme-excerpts.json > update_readmes.sql
"""

import json
import sys

if len(sys.argv) != 2:
    print("Usage: gen-readme-update-sql.py <excerpts.json>", file=sys.stderr)
    sys.exit(1)

records = json.load(open(sys.argv[1]))


def sql_str(v: str) -> str:
    return "'" + v.replace("'", "''") + "'"


def sql_array(items: list[str]) -> str:
    if not items:
        return "ARRAY[]::text[]"
    escaped = [i.replace("'", "''") for i in items]
    return "ARRAY[" + ",".join(f"'{i}'" for i in escaped) + "]"


print("-- Backfill readme_excerpt and readme_images with verbatim README content.")
print("-- Safe to re-run: overwrites only the rows listed below with their own real data.\n")

for r in records:
    sets = []
    if r.get("readme_excerpt"):
        sets.append(f"readme_excerpt = {sql_str(r['readme_excerpt'])}")
    if r.get("images"):
        sets.append(f"readme_images = {sql_array(r['images'])}")
    if not sets:
        continue
    print(f"update public.project_library set {', '.join(sets)} where external_id = {sql_str(r['external_id'])};")
