"""
scripts/fetch-github-projects.py

Pulls REAL project metadata directly from GitHub's Search API and
writes it as project_library-shaped JSON batches, ready for
import-project-library.ts. No AI/LLM is used anywhere in this script --
every field comes straight from GitHub's own API response.

This is the actual path to 1000+ real projects: run this with your own
GitHub personal access token (5,000 requests/hour instead of the 10/hour
unauthenticated limit) across many topics, and each run adds a genuine,
verifiable batch.

Usage:
  export GITHUB_TOKEN=ghp_xxxxxxxxxxxx   # https://github.com/settings/tokens -- no scopes needed for public repo search
  python3 scripts/fetch-github-projects.py --topic machine-learning --domain "Machine Learning" --out data/github-batch-01.json
  python3 scripts/fetch-github-projects.py --topics-file scripts/topics.json --out-dir data/github/

Fields NOT available from GitHub's API (problem_statement, solution_overview,
architecture, development_steps, prerequisites, expected_output,
dataset_info, api_info, estimated_hours, team_size) are intentionally
left out of the output -- the import script's schema treats them as
optional, and the UI shows "Not provided" rather than a guess. Do not
hand these to an LLM to "fill in" -- that would silently reintroduce
exactly the fabrication this module was built to avoid.
"""

import argparse
import json
import os
import re
import sys
import time
import urllib.request
import urllib.error
import urllib.parse
from pathlib import Path

GITHUB_API = "https://api.github.com/search/repositories"
GITHUB_URL_RE = re.compile(r"^https://github\.com/[^/\s]+/[^/\s]+/?$")
HTTPS_URL_RE = re.compile(r"^https://[^\s]+$")


def safe_https_url(url: str | None) -> str | None:
    """Only pass through URLs that will actually survive the import
    script's own https-only validation (see import-project-library.ts) —
    a GitHub 'homepage' field is free text and often http://, blank, or
    not a URL at all, which would otherwise silently reject the whole
    record at import time."""
    if url and HTTPS_URL_RE.match(url):
        return url
    return None


def difficulty_from_stars(stars: int) -> str:
    # NOTE: star count is not a reliable difficulty signal -- an early
    # test run of this script labeled a large curated list of beginner
    # projects "advanced" purely because it was popular. There is no
    # trustworthy signal in the Search API response for how hard a repo
    # actually is to work with, so every fetched record defaults to
    # "intermediate" (the schema's own neutral default) rather than a
    # heuristic that can confidently mislabel exactly the repos students
    # most need correctly labeled. Curate difficulty by hand afterward if
    # it matters for a given batch -- don't trust this function for it.
    return "intermediate"


def fetch_page(topic: str, token: str | None, page: int, per_page: int = 100) -> dict:
    # archived:false excludes repos GitHub itself marks as archived/no-longer-
    # maintained -- an archived repo's own description often tells students
    # to use a different project instead, which is a bad recommendation to
    # surface as "here's a project to learn from."
    query = f"topic:{topic} archived:false"
    url = f"{GITHUB_API}?q={urllib.parse.quote(query)}&sort=stars&order=desc&per_page={per_page}&page={page}"
    req = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json"})
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req) as resp:
            remaining = resp.headers.get("X-RateLimit-Remaining")
            if remaining is not None:
                print(f"  (rate limit remaining: {remaining})", file=sys.stderr)
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"GitHub API error {e.code} for topic '{topic}' page {page}: {body}") from e


def transform(repo: dict, domain: str, subdomain: str | None) -> dict | None:
    html_url = repo.get("html_url")
    full_name = repo.get("full_name")
    if not html_url or not full_name or not GITHUB_URL_RE.match(html_url):
        return None  # skip anything that doesn't look like a real top-level repo URL
    description = repo.get("description") or ""
    if not description.strip():
        return None  # a project with literally no description isn't useful in the library yet

    tech_stack = []
    if repo.get("language"):
        tech_stack.append(repo["language"])

    return {
        "external_id": f"github:{full_name}",
        "source": "github",
        "source_url": html_url,
        "title": repo.get("name", full_name),
        "domain": domain,
        "subdomain": subdomain,
        "difficulty": difficulty_from_stars(repo.get("stargazers_count", 0)),
        "description": description.strip(),
        "tech_stack": tech_stack,
        "skills": (repo.get("topics") or [])[:8],
        "github_url": html_url,
        "demo_url": safe_https_url(repo.get("homepage")),
    }


def fetch_topic(topic: str, domain: str, subdomain: str | None, token: str | None, max_pages: int, per_page: int) -> list[dict]:
    results: list[dict] = []
    for page in range(1, max_pages + 1):
        print(f"Fetching topic='{topic}' page={page}...", file=sys.stderr)
        data = fetch_page(topic, token, page, per_page)
        items = data.get("items", [])
        if not items:
            break
        for repo in items:
            record = transform(repo, domain, subdomain)
            if record:
                results.append(record)
        if len(items) < per_page:
            break  # last page
        time.sleep(1 if token else 6)  # be polite; unauthenticated search is heavily rate-limited
    return results


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--topic", help="A single GitHub topic to search, e.g. 'machine-learning'")
    parser.add_argument("--domain", help="Domain label to store for this batch, e.g. 'Machine Learning'")
    parser.add_argument("--subdomain", default=None)
    parser.add_argument("--topics-file", help="JSON file: [{\"topic\":..., \"domain\":..., \"subdomain\":...}, ...]")
    parser.add_argument("--out", help="Output JSON file (for --topic mode)")
    parser.add_argument("--out-dir", help="Output directory, one file per topic (for --topics-file mode)")
    parser.add_argument("--max-pages", type=int, default=3, help="Pages per topic (100 repos/page). Default 3 = up to 300 repos/topic.")
    parser.add_argument("--per-page", type=int, default=100)
    args = parser.parse_args()

    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        print("WARNING: no GITHUB_TOKEN set. Unauthenticated GitHub Search API is limited to ~10 requests/hour.", file=sys.stderr)
        print("Get a token (no scopes needed for public search) at https://github.com/settings/tokens", file=sys.stderr)

    if args.topic:
        if not args.domain or not args.out:
            parser.error("--topic requires --domain and --out")
        records = fetch_topic(args.topic, args.domain, args.subdomain, token, args.max_pages, args.per_page)
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(json.dumps(records, indent=2))
        print(f"Wrote {len(records)} real project(s) to {args.out}")
    elif args.topics_file:
        if not args.out_dir:
            parser.error("--topics-file requires --out-dir")
        topics = json.loads(Path(args.topics_file).read_text())
        Path(args.out_dir).mkdir(parents=True, exist_ok=True)
        total = 0
        for entry in topics:
            records = fetch_topic(entry["topic"], entry["domain"], entry.get("subdomain"), token, args.max_pages, args.per_page)
            out_path = Path(args.out_dir) / f"{entry['topic']}.json"
            out_path.write_text(json.dumps(records, indent=2))
            print(f"Wrote {len(records)} real project(s) to {out_path}")
            total += len(records)
        print(f"\nTotal across all topics: {total}")
    else:
        parser.error("Provide either --topic (+ --domain --out) or --topics-file (+ --out-dir)")


if __name__ == "__main__":
    main()
