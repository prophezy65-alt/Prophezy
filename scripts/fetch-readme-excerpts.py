"""
scripts/fetch-readme-excerpts.py

Fetches each project's REAL README file from GitHub and stores a verbatim
excerpt of it (not a summary, not an interpretation -- the project's own
words, lightly trimmed of badge/image clutter). This is what actually
belongs in "Overview" when GitHub's short one-line description isn't
enough -- NOT an AI-written summary. No AI/LLM is used anywhere in this
script.

Usage:
  export GITHUB_TOKEN=ghp_xxxxxxxxxxxx
  python3 scripts/fetch-readme-excerpts.py --in data/github/*.json --out data/readme-excerpts.json

Then generate the SQL update from the output:
  python3 scripts/gen-readme-update-sql.py data/readme-excerpts.json > update_readmes.sql

At GitHub's unauthenticated limit (10/hour) this is impractical past a
handful of repos -- with a personal access token it's 5,000/hour, so
~1,800 repos takes well under an hour.
"""

import argparse
import glob
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request

README_API = "https://api.github.com/repos/{owner}/{repo}/readme"
MAX_EXCERPT_CHARS = 1200
MAX_IMAGES = 2
# Real images the README author actually embedded (screenshots, demo GIFs,
# diagrams) -- never a fabricated or stock image standing in for a
# specific project. Captures both absolute URLs and relative paths (very
# common in real READMEs, e.g. ![Screenshot](docs/shot.png)) -- relative
# paths get resolved against the repo's raw-content base URL below.
IMAGE_MD_RE = re.compile(r'!\[[^\]]*\]\(([^\s)]+)\)')
IMAGE_HTML_RE = re.compile(r'<img\b[^>]*\bsrc=["\']([^"\']+)["\']', re.IGNORECASE)
# Badge/shield hosts to exclude -- these ARE images, but they're build
# status icons and logos, not screenshots of the actual project.
BADGE_HOST_RE = re.compile(r'(shields\.io|badge\.fury\.io|img\.shields|travis-ci|circleci\.com|codecov\.io|coveralls\.io|snyk\.io|opencollective\.com/.*/badge)', re.IGNORECASE)

# Lines that are just badges/shields/logos at the top of a README -- real
# content, technically, but not useful as an "overview" excerpt and would
# make every excerpt start with a wall of build-status icons.
BADGE_LINE_RE = re.compile(
    r'^\s*(\[!\[.*?\]\(.*?\)\]\(.*?\)|!\[.*?\]\(.*?\)|<img\b[^>]*>|<p\s+align=[\'"]center[\'"]>|</p>|<hr\s*/?>|\|[\w\s.-]+\|)\s*$',
    re.IGNORECASE,
)
BLOCKQUOTE_RE = re.compile(r'^>')
HEADING_RE = re.compile(r'^#+\s*')
RST_UNDERLINE_RE = re.compile(r'^[=\-~^"\'`]{3,}$')  # reStructuredText title underlines (e.g. "=====")


def fetch_default_branch(owner: str, repo: str, token: str | None) -> str:
    """The repo's actual default branch (main/master/etc.) -- needed to
    build correct raw.githubusercontent.com URLs for relative-path images.
    Falls back to 'main' (the modern GitHub default) if this call fails,
    which is a reasonable guess but can occasionally 404 for older repos
    still on 'master' -- a known, disclosed limitation, not a fabrication."""
    url = f"https://api.github.com/repos/{owner}/{repo}"
    req = urllib.request.Request(url, headers={"Accept": "application/vnd.github+json"})
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req) as resp:
            data = json.loads(resp.read())
            return data.get("default_branch", "main")
    except Exception:
        return "main"


def fetch_readme(owner: str, repo: str, token: str | None) -> str | None:
    url = README_API.format(owner=owner, repo=repo)
    req = urllib.request.Request(url, headers={"Accept": "application/vnd.github.raw"})
    if token:
        req.add_header("Authorization", f"Bearer {token}")
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None  # no README -- honest, not an error
        raise


def find_raw_image_refs(readme_text: str) -> list[str]:
    """First pass: just find the raw image references in the README, with
    no network calls yet -- lets the caller skip fetching the repo's
    default branch entirely when there's nothing to resolve."""
    urls = []
    for line in readme_text.splitlines():
        for match in IMAGE_MD_RE.finditer(line):
            urls.append(match.group(1))
        for match in IMAGE_HTML_RE.finditer(line):
            urls.append(match.group(1))
    return urls


def resolve_images(raw_refs: list[str], owner: str, repo: str, default_branch: str) -> list[str]:
    resolved = []
    for u in raw_refs:
        if u.startswith("http://") or u.startswith("https://"):
            resolved.append(u)
        elif not u.startswith("data:"):
            clean_path = u.lstrip("./")
            resolved.append(f"https://raw.githubusercontent.com/{owner}/{repo}/{default_branch}/{clean_path}")

    real_images = [u for u in resolved if not BADGE_HOST_RE.search(u)]
    seen = set()
    deduped = []
    for u in real_images:
        if u not in seen:
            seen.add(u)
            deduped.append(u)
    return deduped[:MAX_IMAGES]


def extract_excerpt(readme_text: str) -> str | None:
    """Verbatim excerpt: skip the "preamble" (badges, images, the title
    heading, leading blockquote notices, RST title underlines) until real
    prose starts, then take that prose up to MAX_EXCERPT_CHARS. No
    rewording, no summarizing -- only trimming structural noise that isn't
    actually part of the project's own description."""
    lines = readme_text.splitlines()
    content_lines = []
    content_started = False
    i = 0
    while i < len(lines):
        stripped = lines[i].strip()
        if not stripped:
            if content_started:
                content_lines.append("")
            i += 1
            continue
        # A pure badge/image/shield line is never meaningful prose,
        # wherever it appears in the document -- unlike headings or
        # blockquotes (which can be legitimate content once the real
        # description has started), so this check is unconditional.
        if BADGE_LINE_RE.match(stripped):
            i += 1
            continue
        if not content_started:
            if BLOCKQUOTE_RE.match(stripped) or RST_UNDERLINE_RE.match(stripped):
                i += 1
                continue
            if HEADING_RE.match(stripped):
                i += 1
                continue  # markdown title heading -- redundant with our own title field
            # RST-style heading: a title line immediately followed by an
            # underline of repeated symbols roughly matching its length
            # (e.g. "Home Assistant\n===============").
            next_line = lines[i + 1].strip() if i + 1 < len(lines) else ""
            if RST_UNDERLINE_RE.match(next_line) and len(next_line) >= len(stripped) * 0.5:
                i += 2
                continue
            content_started = True
        content_lines.append(stripped)
        i += 1

    text = "\n".join(content_lines).strip()
    if not text:
        return None

    if len(text) <= MAX_EXCERPT_CHARS:
        return text

    # Cut at the last paragraph break before the limit, else last sentence,
    # else just hard-cut -- always add an explicit ellipsis so it's clear
    # this is a real excerpt, not the whole document.
    cut = text[:MAX_EXCERPT_CHARS]
    para_break = cut.rfind("\n\n")
    if para_break > MAX_EXCERPT_CHARS * 0.4:
        return cut[:para_break].strip() + "\n\n[…continued on GitHub]"
    sentence_end = max(cut.rfind(". "), cut.rfind(".\n"))
    if sentence_end > MAX_EXCERPT_CHARS * 0.4:
        return cut[: sentence_end + 1].strip() + " […continued on GitHub]"
    return cut.strip() + "… […continued on GitHub]"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--in", dest="input_glob", required=True, help="Glob of the project JSON batch files (with external_id fields)")
    parser.add_argument("--out", required=True)
    parser.add_argument("--limit", type=int, default=None, help="Stop after N repos (useful for testing budget)")
    args = parser.parse_args()

    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        print("WARNING: no GITHUB_TOKEN set -- limited to ~10 requests/hour. Get one at https://github.com/settings/tokens", file=sys.stderr)

    records = []
    for path in glob.glob(args.input_glob):
        records.extend(json.loads(open(path).read()))

    seen = set()
    results = []
    count = 0
    for r in records:
        eid = r["external_id"]
        if eid in seen:
            continue
        seen.add(eid)
        if args.limit and count >= args.limit:
            break
        owner_repo = eid.replace("github:", "", 1)
        owner, repo = owner_repo.split("/", 1)
        print(f"Fetching README for {owner_repo}...", file=sys.stderr)
        try:
            readme = fetch_readme(owner, repo, token)
        except Exception as e:
            print(f"  ERROR: {e}", file=sys.stderr)
            readme = None
        excerpt = extract_excerpt(readme) if readme else None
        images: list[str] = []
        if readme:
            raw_refs = find_raw_image_refs(readme)
            if raw_refs:
                needs_branch_lookup = any(not (u.startswith("http://") or u.startswith("https://")) for u in raw_refs)
                default_branch = fetch_default_branch(owner, repo, token) if needs_branch_lookup else "main"
                images = resolve_images(raw_refs, owner, repo, default_branch)
        if excerpt or images:
            record = {"external_id": eid}
            if excerpt:
                record["readme_excerpt"] = excerpt
            if images:
                record["images"] = images
            results.append(record)
            print(f"  got {len(excerpt) if excerpt else 0} chars, {len(images)} real image(s)", file=sys.stderr)
        else:
            print("  no usable README", file=sys.stderr)
        count += 1
        time.sleep(0.3 if token else 6)

    with open(args.out, "w") as f:
        json.dump(results, f, indent=2)
    print(f"\nWrote {len(results)} README excerpts to {args.out}")


if __name__ == "__main__":
    main()
