-- Category coverage batch. Run AFTER 20260807b_blog_expansion.sql and
-- blog_seed_product.sql. Brings every category to at least 2 published
-- articles (several to 3+), rather than leaving 5 categories empty.

insert into blog_tags (slug, name) values
  ('data-science', 'Data Science'),
  ('placements', 'Placements'),
  ('college-life', 'College Life'),
  ('research', 'Research'),
  ('sql', 'SQL')
on conflict (slug) do nothing;

-- data-science (was 0)
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_id, read_time_minutes, is_featured, status, published_at)
values (
  'data-analyst-roadmap',
  'A Realistic Data Analyst Roadmap',
  'Data analyst roles get overshadowed by data science and ML hype, but the path to one is more direct — and the skills transfer fast.',
  $md$## Why this path gets overlooked

Most "become a data professional" content jumps straight to machine learning, but data analyst roles are more numerous, more direct to break into, and teach you the exact foundations ML work builds on anyway — you're not taking a detour.

## Stage 1: SQL, genuinely fluent

Every analyst role assumes strong SQL — joins, aggregations, window functions, and query optimization on real (not toy) datasets. This is the single highest-leverage skill in this roadmap; a analyst who's excellent at SQL and mediocre at everything else is still highly employable.

## Stage 2: Spreadsheets, properly

Pivot tables, lookup functions, and building a dashboard that a non-technical stakeholder can actually read. Don't skip this because it feels basic — a huge share of real analyst work still happens in spreadsheets, and doing it well is a distinct skill from doing it adequately.

## Stage 3: Python for analysis

`pandas` for data cleaning and transformation, `matplotlib`/`seaborn` for visualization. You're not writing production software here — you're writing clear, reproducible analysis scripts. Prioritize readability over cleverness.

## Stage 4: Statistics that inform decisions

Descriptive statistics, correlation versus causation, confidence intervals, and A/B test fundamentals. The goal isn't academic rigor — it's being able to say "is this difference real or noise" with actual justification.

## Stage 5: A BI tool

Power BI or Tableau — pick one, build two or three real dashboards from public datasets. Employers care less about which tool and more about whether you can turn raw data into something a decision-maker can act on in thirty seconds of looking at it.

## Stage 6: A portfolio project with a real question

Not "analysis of Titanic dataset" — pick a real question you're curious about, find or scrape the data, and answer it end to end, including the parts where the data was messy or the answer was less clean than you hoped. That honesty is what differentiates a portfolio project from a tutorial clone.

## Common mistakes

Learning tools in isolation without ever combining them on a real question, presenting only clean "success" analyses with no discussion of limitations, and underestimating how much of the job is communicating findings clearly — not just producing them.

## Where this leads

A strong data analyst foundation is also the fastest realistic on-ramp toward data science or ML roles later, if that's the direction you want — you'll have the statistics and data-handling fundamentals already in place.
$md$,
  (select id from blog_categories where slug = 'data-science'),
  (select id from blog_authors where slug = 'prophezy-team'),
  7,
  false,
  'published',
  now() - interval '21 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, author_id = excluded.author_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'data-analyst-roadmap' and t.slug in ('data-science', 'roadmap', 'career-trends')
on conflict do nothing;

insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_id, read_time_minutes, is_featured, status, published_at)
values (
  'sql-for-data-analysis',
  'SQL for Data Analysis: A Practical Start',
  'Most SQL tutorials teach syntax with no context. Here''s the subset that actually gets used in real analysis work, and why.',
  $md$## Why SQL is worth learning deeply, not just "enough"

Almost every data role — analyst, scientist, or ML engineer — assumes you can pull and shape your own data without waiting on someone else. Weak SQL means depending on others for basic access to what you need; strong SQL means you're self-sufficient from day one.

## Start with SELECT, WHERE, and GROUP BY — and actually understand execution order

Most beginners memorize clause order (SELECT, FROM, WHERE, GROUP BY) without understanding that SQL executes in a different order than it's written (FROM and WHERE run before SELECT). Understanding this prevents a whole category of confusing errors, like trying to filter on an aliased column in WHERE.

```sql
SELECT department, AVG(salary) as avg_salary
FROM employees
WHERE hire_date > '2023-01-01'
GROUP BY department
HAVING AVG(salary) > 60000
ORDER BY avg_salary DESC;
```

## Joins: the concept that trips up most beginners

Practice INNER, LEFT, and RIGHT joins with actual data where you can predict the output before running the query, then verify. The most common beginner mistake is a join that unintentionally duplicates rows — always sanity-check row counts before and after a join.

## Window functions: the underrated power tool

`RANK()`, `ROW_NUMBER()`, and running totals via `OVER (PARTITION BY ...)` solve problems that would otherwise need multiple queries or a script. This is the single most valuable intermediate skill — most self-taught learners skip it and hit a wall on real analysis tasks as a result.

## Common mistakes

- Not checking for NULLs before aggregating — they silently break averages and counts in ways that are easy to miss
- Writing a query that works on a small test table but breaks (or times out) on real production-scale data
- Ignoring `EXPLAIN` — never checking why a query is slow before assuming it's fine

## Best practices

Format your queries for readability even when no one's reviewing them — future-you debugging a 40-line query at 11pm will thank present-you. Comment non-obvious logic, especially around date filtering and edge cases.

## How to actually practice

Skip toy datasets where possible — pull a real, public dataset (government open data, sports statistics, anything with genuine messiness) and answer specific questions with it. The friction of real data — missing values, inconsistent formatting, ambiguous column names — is exactly what tutorial datasets don't teach you to handle.
$md$,
  (select id from blog_categories where slug = 'data-science'),
  (select id from blog_authors where slug = 'prophezy-team'),
  6,
  false,
  'published',
  now() - interval '23 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, author_id = excluded.author_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'sql-for-data-analysis' and t.slug in ('data-science', 'sql')
on conflict do nothing;

-- placements (was 0)
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_id, read_time_minutes, is_featured, status, published_at)
values (
  'how-campus-placements-actually-work',
  'How Campus Placements Actually Work (And How to Prepare on Time)',
  'Placement season feels sudden if you don''t know the structure behind it. Here''s what''s actually happening at each stage.',
  $md$## Why placement season feels chaotic

From the outside, placement season looks like a rush of deadlines and shortlists appearing with little warning. From the inside, it follows a fairly consistent structure across most colleges — knowing that structure ahead of time is most of what separates students who prepare calmly from students who scramble.

## Stage 1: Pre-placement talks and registration

Companies typically visit or present weeks before the actual process, outlining the role, eligibility criteria (CGPA cutoffs, branch restrictions), and process structure. Registering and attending these — even for companies you're unsure about — costs little and keeps options open.

## Stage 2: Online assessments

Aptitude, technical MCQs, and often a coding round, usually the first real filter. These favor consistent practice over last-minute cramming — the format (quantitative aptitude, logical reasoning, basic DSA) is predictable enough to prepare for months in advance.

## Stage 3: Technical interviews

Usually one to three rounds, covering your resume, projects, core CS fundamentals, and problem-solving. See our [DSA roadmap](/blog/dsa-complete-roadmap) and [interview questions](/blog/interview-questions-every-student-should-know) guides for direct preparation.

## Stage 4: HR / behavioral round

Often treated as a formality by students, which is a mistake — this round can and does eliminate candidates, especially when answers feel rehearsed or generic rather than specific to the company and role.

## What determines your shortlist odds before you even apply

Your resume (see our [resume guides](/blog/ats-resume-guide)), your CGPA if there's a cutoff, and — increasingly — a public GitHub or portfolio if the company looks beyond the resume. None of these can be fixed the week before placements start; they're built over the preceding semesters.

## Common mistakes during placement season

- Only preparing for the "dream company" and neglecting earlier opportunities, then having no offer if that one falls through
- Skipping practice interviews because they feel unnecessary — cold-starting your first real interview under pressure is a disadvantage you can avoid
- Not researching the specific company beyond its name — generic answers are the fastest way to lose an HR round

## A realistic timeline

Start technical and aptitude prep at least two to three months before your placement season begins, not the week registrations open. The students who feel calm during placement season aren't naturally less anxious — they front-loaded the preparation earlier.
$md$,
  (select id from blog_categories where slug = 'placements'),
  (select id from blog_authors where slug = 'prophezy-team'),
  7,
  true,
  'published',
  now() - interval '25 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, author_id = excluded.author_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'how-campus-placements-actually-work' and t.slug in ('placements', 'interviews')
on conflict do nothing;

insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_id, read_time_minutes, is_featured, status, published_at)
values (
  'placement-season-survival-guide',
  'A Placement Season Survival Guide',
  'Placement season is as much about managing your own state over several weeks as it is about any single interview. Here''s how to get through it well.',
  $md$## Why placement season is a marathon, not a single event

Unlike a single job application, placement season can mean multiple companies, multiple rounds, and multiple rejections compressed into a few intense weeks — the emotional and logistical load is different from any single interview, and most preparation advice doesn't address that.

## Track everything in one place

Company, round, date, and outcome for every process you're in. Under this volume, relying on memory alone leads to missed deadlines and confusing overlapping schedules. A simple spreadsheet is enough — the point is having one source of truth, not a sophisticated system.

## Expect rejection to be part of the process, not a signal you're behind

Most students who eventually land strong offers also collect rejections along the way — this is normal, not a sign something's wrong with your preparation. Treating every rejection as diagnostic ("what specifically should I adjust") rather than as a verdict on your worth keeps you functional across a multi-week process.

## Don't let one company's process consume your whole week

If a `dream company's` process runs long, it's tempting to pause everything else to focus on it — but that can mean falling behind on nearer-term deadlines from other companies. Keep moving on other applications in parallel; you can always decline offers if the one you wanted comes through.

## Protect basic routines during the intense weeks

Sleep, food, and at least some exercise or movement — not because it's generic wellness advice, but because cognitive performance in interviews genuinely degrades under sleep deprivation and poor nutrition. This is a practical performance issue, not just a health one.

## After an offer: it's genuinely fine to keep going

If your college's placement policy allows it, continuing to interview after an early offer (where permitted) is a legitimate strategy, not something to feel guilty about — you're allowed to want the best fit, not just the first fit.

## After a rejection: do a short, honest debrief

Spend fifteen minutes, not more, reviewing what happened — a specific question you fumbled, a gap in a technical area — and note one concrete adjustment for next time. Extended rumination past that point tends to cost more than it teaches.

## The thing that actually helps most

A support system — friends going through the same process, or a senior who's been through it — matters more during placement season than most students expect going in. You don't have to do this alone, and most of your batchmates are having a harder time than they're letting on too.
$md$,
  (select id from blog_categories where slug = 'placements'),
  (select id from blog_authors where slug = 'prophezy-team'),
  7,
  false,
  'published',
  now() - interval '27 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, author_id = excluded.author_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'placement-season-survival-guide' and t.slug in ('placements', 'career-trends')
on conflict do nothing;

-- github (was 0)
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_id, read_time_minutes, is_featured, status, published_at)
values (
  'git-and-github-for-beginners',
  'Git and GitHub for Absolute Beginners',
  'Git confuses most beginners because tutorials teach commands before concepts. Start with what a commit actually is, and the rest gets easier.',
  $md$## The mental model that makes Git click

Git isn't primarily about commands — it's a system for tracking snapshots of your project over time, with the ability to branch off and merge back. Once you picture your project history as a chain of snapshots rather than a mysterious set of commands, most Git behavior stops feeling arbitrary.

## The core loop you'll use constantly

```bash
git status        # what's changed
git add .          # stage changes
git commit -m "add login form validation"
git push            # send to GitHub
```

Learn this loop cold before anything else — branches, merges, and rebasing all build on top of it.

## Branches: why they matter

A branch lets you work on a change without affecting the main, working version of your code. Practice creating a branch for a small feature, committing to it, then merging it back — this workflow alone covers most of what you need for solo and small-team projects.

```bash
git checkout -b add-dark-mode
# make changes, commit them
git checkout main
git merge add-dark-mode
```

## GitHub versus Git — a common beginner confusion

Git is the version control system running on your machine; GitHub is a hosted service for storing and collaborating on Git repositories. You can use Git entirely locally with no GitHub account — GitHub becomes essential once you want to collaborate, back up your work remotely, or showcase projects publicly.

## Common mistakes beginners make

- Committing generated files or dependencies (like `node_modules`) — use a `.gitignore` from the start
- Writing vague commit messages ("fix", "update") that mean nothing when you're looking back later
- Panicking and deleting a repository instead of learning to undo a mistake — almost everything in Git is recoverable if you know the right command

## Best practices worth building early

Commit in small, logical chunks rather than one giant commit at the end of a session — this makes your history actually useful when you need to find when a bug was introduced. Write commit messages that explain *why*, not just *what*, when the reason isn't obvious from the diff.

## Where this connects to your job search

A clean, well-organized GitHub profile is often the first thing a recruiter checks after your resume — see our [GitHub Portfolio Guide](/blog/github-portfolio-guide) for how to make yours count once you're comfortable with the fundamentals here.
$md$,
  (select id from blog_categories where slug = 'github'),
  (select id from blog_authors where slug = 'prophezy-team'),
  6,
  false,
  'published',
  now() - interval '29 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, author_id = excluded.author_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'git-and-github-for-beginners' and t.slug in ('github', 'roadmap')
on conflict do nothing;

insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_id, read_time_minutes, is_featured, status, published_at)
values (
  'github-actions-for-student-projects',
  'GitHub Actions: Automating Your Student Projects',
  'A basic CI pipeline is one of the most impressive-for-effort things you can add to a student project. Here''s a minimal, genuinely useful setup.',
  $md$## Why this is worth learning before you "need" it

Continuous integration sounds like an enterprise concern, but even a solo student project benefits from automatically running tests and checks on every push — and having it on a project signals real engineering habits to anyone reviewing your GitHub.

## What GitHub Actions actually does

It runs scripts automatically in response to events in your repository — most commonly, running your test suite every time you push code or open a pull request, catching breakage before it reaches your main branch.

## A minimal, real workflow

```yaml
# .github/workflows/test.yml
name: Run tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm install
      - run: npm test
```

This alone — install dependencies, run tests, on every push — covers most of what a student project actually needs from CI.

## Beyond tests: linting and formatting checks

Once the test workflow is comfortable, add a lint step so style issues get caught automatically rather than in review. This is a small addition that meaningfully raises the perceived quality of a repository.

## Why this matters for your portfolio

A green checkmark next to your commits — meaning tests genuinely pass — is a concrete, verifiable signal in a way that "I tested it locally" in a README isn't. Reviewers and interviewers who look at your repo will notice.

## Common mistakes

- Setting up CI but never actually writing meaningful tests, so the pipeline passes trivially
- Overcomplicating the first workflow — start with the minimal test-on-push setup above before adding deployment or multi-environment testing
- Not checking the Actions tab when something fails — CI failures include logs that are usually the fastest way to debug the issue

## A reasonable next step

Once comfortable, add automatic deployment (e.g., to Vercel or a similar host) triggered by a successful test run on your main branch — this is the same fundamental pattern real engineering teams use, just at a smaller scale.
$md$,
  (select id from blog_categories where slug = 'github'),
  (select id from blog_authors where slug = 'prophezy-team'),
  6,
  false,
  'published',
  now() - interval '31 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, author_id = excluded.author_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'github-actions-for-student-projects' and t.slug in ('github', 'open-source')
on conflict do nothing;

-- college-life (was 0)
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_id, read_time_minutes, is_featured, status, published_at)
values (
  'navigating-college-life-beyond-academics',
  'Navigating College Life Beyond Academics',
  'Grades matter, but so does everything else college is quietly teaching you. Here''s how to take the rest of it seriously too.',
  $md$## Why "just focus on academics" is incomplete advice

Coursework is the most visible part of college, but a meaningful share of what actually shapes your next few years — habits, network, self-knowledge — happens outside the classroom. Treating those as distractions from the "real" work often means missing what college is uniquely good for.

## Clubs and societies: choose for depth, not resume padding

Joining eight clubs to list on a resume produces eight shallow lines and no real experience. Choosing two or three you're genuinely interested in, and taking on real responsibility in them, produces both a better experience and a more credible resume line.

## Building relationships with faculty

Office hours are underused by most students, and they're one of the few structured opportunities to build a relationship with someone who can later write a strong recommendation, connect you to research, or simply give real career advice. Showing up with a genuine question, not just when you need something, changes how that relationship develops.

## Managing the social and academic balance

Neither extreme — all-academics-no-social-life, or the reverse — tends to produce a good outcome. The pattern that works best for most people is protecting specific blocks of focused work time (see our [time management guide](/blog/time-management-for-college-students)) while treating social time as equally non-negotiable, not an afterthought squeezed into leftover hours.

## Handling setbacks without spiraling

A bad grade, a rejected application, or a difficult semester feels enormous in the moment and rarely is, in the context of a full college career. Talking to someone — a friend, a mentor, a counselor — about a genuine setback, rather than processing it alone, consistently helps people recover faster and make better decisions about what to do next.

## Using breaks intentionally

Summer and winter breaks are valuable time for internships, projects, or genuinely resting — but drifting through them without a plan is easy to do and hard to get back. A rough plan going into a break (even just "I want to finish X project" or "I want to actually rest") makes a real difference.

## The thing most students realize too late

The connections and habits built in college — not just the degree — are often what compounds the most in the years after. Investing real effort in both, not just coursework, is not a distraction from your future — it's part of building it.
$md$,
  (select id from blog_categories where slug = 'college-life'),
  (select id from blog_authors where slug = 'prophezy-team'),
  6,
  false,
  'published',
  now() - interval '33 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, author_id = excluded.author_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'navigating-college-life-beyond-academics' and t.slug in ('college-life')
on conflict do nothing;

insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_id, read_time_minutes, is_featured, status, published_at)
values (
  'building-a-support-network-in-college',
  'Building a Support Network in College (Beyond Just Friends)',
  'The people around you in college shape your options more than most students realize while it''s happening. Here''s how to build that intentionally.',
  $md$## Why this matters more than it seems to at the time

Opportunities — a research position, an internship referral, a heads-up about a role before it's posted — flow disproportionately through relationships, not cold applications alone. This isn't about networking in a transactional sense; it's about the ordinary fact that people help people they know.

## Seniors and alumni: an underused resource

Students one or two years ahead of you have recently gone through exactly what you're facing — placements, specific courses, specific professors — and are often genuinely willing to share what they learned if you ask directly and specifically, rather than a vague "any advice?"

## Peers in your own year

The people you're studying alongside right now become, over the following decade, colleagues, referral sources, and collaborators at a rate most students underestimate while still in college. Investing in a handful of real friendships — not just acquaintances — pays off in ways that aren't visible yet.

## Faculty and mentors

A professor or TA who knows your work, not just your name, can write a meaningfully stronger recommendation letter, point you toward a relevant opportunity, or simply give honest feedback you won't get elsewhere. This requires actually engaging in their course and office hours, not just performing engagement.

## Building this without it feeling transactional

The healthiest version of this isn't "networking" in the extractive sense — it's genuinely investing in people, being helpful when you can, and staying in touch without an immediate ask attached. People can tell the difference, and the relationships that last are the ones that weren't purely instrumental from the start.

## A concrete habit worth building

Reach out to one person a month — a senior, a professor, an alum — with a specific, genuine question, not a generic "let's connect." This small, consistent habit compounds into a real network over a few years, far more than a single networking event ever does.

## What to do with a setback in a relationship

Not every reach-out gets a response, and that's normal — professors and professionals are busy, not necessarily dismissive. Don't read too much into silence; follow up once, politely, and move on if there's still no response.
$md$,
  (select id from blog_categories where slug = 'college-life'),
  (select id from blog_authors where slug = 'prophezy-team'),
  6,
  false,
  'published',
  now() - interval '35 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, author_id = excluded.author_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'building-a-support-network-in-college' and t.slug in ('college-life', 'career-trends')
on conflict do nothing;

-- research (was 0)
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_id, read_time_minutes, is_featured, status, published_at)
values (
  'how-to-start-undergraduate-research',
  'How to Start Undergraduate Research (Even With No Prior Experience)',
  'Undergraduate research feels gatekept until you realize most professors are simply looking for someone reliable and genuinely interested.',
  $md$## Why this feels harder to break into than it is

Research can feel like it requires prior experience to get experience — a familiar catch-22. In practice, most professors running small labs or projects are far more limited by available hands than by a shortage of qualified undergraduates, and genuine interest plus reliability often matters more than a polished background.

## Finding a professor or lab to approach

Look at faculty in your department whose published work or course content genuinely interests you — not just the most famous name. Read one or two of their recent papers (even if you don't follow every detail) before reaching out, so your interest is specific rather than generic.

## How to actually reach out

A short, specific email works far better than a long, generic one: mention a specific paper or project of theirs, explain briefly why it interests you, and ask if they have any openings for an undergraduate to help with ongoing work. Attach your resume or a brief summary of relevant coursework.

## What early research work actually looks like

Rarely glamorous at first — often literature review, data collection, cleaning datasets, or running established experiments under supervision. This isn't a sign you're not doing "real" research; foundational, supporting work is how almost everyone starts, including people now running their own labs.

## What professors are actually evaluating

Reliability (do you show up and follow through), genuine curiosity (do you ask questions, not just complete tasks mechanically), and basic communication skills — far more than raw technical sophistication at the start. These are learnable habits, not fixed traits.

## Making the most of it once you're in

Ask questions about the bigger picture, not just your specific task — understanding why the research matters, not just what you're doing, is what turns a research position into genuine learning rather than just labor. Keep a running log of what you're learning; it becomes invaluable when writing about the experience later.

## What this leads to

Beyond the experience itself, undergraduate research often leads to a strong recommendation letter, sometimes co-authorship on a publication, and real clarity on whether graduate research is something you'd want to pursue further — which is valuable information even if the answer turns out to be no.
$md$,
  (select id from blog_categories where slug = 'research'),
  (select id from blog_authors where slug = 'prophezy-team'),
  6,
  false,
  'published',
  now() - interval '37 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, author_id = excluded.author_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'how-to-start-undergraduate-research' and t.slug in ('research')
on conflict do nothing;

insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_id, read_time_minutes, is_featured, status, published_at)
values (
  'research-paper-writing-guide',
  'A Research Paper Writing Guide for Students',
  'Writing up research is a different skill from doing it. Here''s how to structure a paper so your actual findings don''t get lost.',
  $md$## Why writing feels harder than the research itself

Doing the work and explaining the work clearly draw on genuinely different skills — it's common to have solid results and still struggle to write them up in a way that reads clearly to someone outside your immediate project. This is learnable, and mostly about structure.

## The structure almost every paper follows

Abstract, introduction, related work, methodology, results, discussion, conclusion. Understanding *why* this order exists — you're taking a reader from the general problem to your specific contribution to what it means — makes the structure easier to fill in than treating it as an arbitrary template.

## Write the abstract last, even though it's read first

The abstract summarizes the whole paper in a few sentences, which is far easier to do accurately once the paper is actually written. Drafting it first often leads to an abstract promising something the paper doesn't quite deliver.

## The introduction's real job

State the problem, why it matters, what's missing in existing approaches, and what your paper specifically contributes — in that order. A common mistake is spending too much of the introduction on background and too little on your paper's actual contribution.

## Methodology: write for reproducibility

A reader should be able to understand what you did well enough to attempt it themselves, even if they can't literally reproduce your exact setup. Vague methodology sections are one of the most common weaknesses in student papers — be specific about data, parameters, and process.

## Results versus discussion: keep them separate

Results should report what you found, without interpretation. Discussion is where you interpret what it means, including limitations. Mixing the two makes it hard for a reader to distinguish your actual findings from your interpretation of them.

## Common mistakes

- Overstating conclusions beyond what the data actually supports
- Citing sources you haven't actually read closely, based on a summary or abstract alone
- Inconsistent formatting and citation style, which reads as carelessness even when the underlying work is strong

## Revising: the step most students rush

A first draft is rarely close to final — read it aloud, or better, have someone unfamiliar with the project read it and tell you what's unclear. Confusion in a reader is almost always a writing problem, not a reader problem.
$md$,
  (select id from blog_categories where slug = 'research'),
  (select id from blog_authors where slug = 'prophezy-team'),
  7,
  false,
  'published',
  now() - interval '39 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, author_id = excluded.author_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'research-paper-writing-guide' and t.slug in ('research')
on conflict do nothing;

-- internships (was 1) — top up to 2
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_id, read_time_minutes, is_featured, status, published_at)
values (
  'cold-emailing-for-internships',
  'Cold Emailing for Internships That Actually Works',
  'A cold email won''t always get a reply, but a well-written one gets replies far more often than students expect — here''s what separates the two.',
  $md$## Why most cold emails get ignored

The typical student cold email is long, generic, and asks for a lot ("could you tell me about your career journey and any advice you have?") without offering the reader an easy, specific way to help. Busy people skip these, not out of unkindness, but because responding requires real effort with an unclear ask.

## The structure that actually gets responses

Keep it to four or five sentences: who you are, one specific, genuine reason you're reaching out to *them* specifically, a clear and small ask, and an easy way to say yes. Specificity is what makes an email feel worth a response instead of a mass-sent template.

## Research beats politeness

A personalized line referencing something specific — a project they worked on, a talk they gave, a post they wrote — does more than any amount of generic politeness. It signals you did real homework, which is itself a form of respect for their time.

## Make the ask small

"Would you be open to a 15-minute call" gets more yeses than "could you mentor me" or "can we discuss my career." A small, bounded ask is easy to say yes to; a large, open-ended one is easy to defer indefinitely.

## Following up, without being annoying

One follow-up after a week or so, brief and polite, is normal and expected — most professionals don't read a follow-up as pushy. Beyond two follow-ups with no response, it's time to move on; persistence has diminishing (and eventually negative) returns.

## What to do with the response, if you get one

Show up prepared if a call happens — have two or three specific questions ready, not "so, tell me about yourself." A vague, unprepared call after someone gave you their time is a worse outcome than no response at all, because it wastes the opportunity you worked to get.

## Volume versus quality

Ten thoughtful, personalized emails will outperform a hundred generic ones sent to a purchased list. Cold emailing works because it's rare to receive a genuinely well-crafted one — sending generic ones at scale defeats the exact thing that makes it work.
$md$,
  (select id from blog_categories where slug = 'internships'),
  (select id from blog_authors where slug = 'prophezy-team'),
  6,
  false,
  'published',
  now() - interval '41 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, author_id = excluded.author_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'cold-emailing-for-internships' and t.slug in ('internships', 'career-trends')
on conflict do nothing;

-- interviews (was 1) — top up to 2
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_id, read_time_minutes, is_featured, status, published_at)
values (
  'behavioral-interview-questions-guide',
  'Behavioral Interview Questions and How to Actually Answer Them',
  'Behavioral rounds are easier to prepare for than technical ones — most students just prepare for them the wrong way.',
  $md$## Why behavioral rounds trip people up

Technical questions have a right answer to aim for; behavioral questions feel vaguer, so students either wing them or over-prepare a script that comes out sounding rehearsed and hollow. Neither works well — the fix is structured, specific preparation, not memorization.

## The STAR structure, used properly

Situation, Task, Action, Result — most people have heard of this, but use it loosely. The part most answers are missing is a *specific, measurable result* at the end; without it, the story doesn't land as evidence of anything.

## Build a bank of five or six stories, not one per question type

Rather than preparing a separate answer for every possible question, prepare five or six strong stories from your real experience, each of which can flex to answer multiple question types (a challenge, a failure, a leadership moment, a conflict) depending on how you frame it.

## "Tell me about a conflict with a teammate"

Interviewers are listening for how you handled disagreement productively, not for you to prove the other person was wrong. A story where you acknowledge your own part in the friction, and describe a concrete resolution, reads far better than one that's purely about someone else's fault.

## "Tell me about a failure"

The instinct to pick a fake-failure ("I worked too hard") is transparent and usually backfires. A genuine failure, with a clear, specific lesson and evidence you actually changed your approach afterward, demonstrates far more maturity.

## Common mistakes

- Answers with no specific result or outcome — "we worked through it" isn't a result
- Stories that are technically true but don't actually answer the question asked
- Rambling for three minutes when the interviewer wanted ninety seconds — practice trimming your stories to a tight, complete version

## How to practice without sounding scripted

Practice the *structure* and key details of each story out loud, not a word-for-word script — this keeps the delivery natural while ensuring you hit the specific, concrete details that make a story convincing.

## The test worth applying

After telling a story, ask: does this give the interviewer a specific, checkable fact about how I actually behave under pressure, in conflict, or after a mistake? If it's vague enough to apply to anyone, it needs another pass.
$md$,
  (select id from blog_categories where slug = 'interviews'),
  (select id from blog_authors where slug = 'prophezy-team'),
  6,
  false,
  'published',
  now() - interval '43 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, author_id = excluded.author_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'behavioral-interview-questions-guide' and t.slug in ('interviews')
on conflict do nothing;

-- career-trends (was 1) — top up to 2
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_id, read_time_minutes, is_featured, status, published_at)
values (
  'how-ai-is-changing-hiring',
  'How AI Is Changing How Companies Hire',
  'AI isn''t just changing what jobs exist — it''s changing how the hiring process itself works, on both sides of the table.',
  $md$## Both sides of the interview are using AI now

It's not just candidates using AI to prep or write resumes — companies increasingly use AI-assisted screening for resumes, and in some cases, AI-assisted evaluation of coding assessments. Understanding both sides changes how you should prepare, not just what you should prepare for.

## What this means for your resume

Resume screening increasingly involves automated keyword and relevance matching before a human ever sees it — see our [ATS Resume Guide](/blog/ats-resume-guide) for the practical implications. The bar for a resume that even reaches a human has shifted toward clean, parseable, keyword-aligned content.

## Assessments are getting harder to game generically

As AI-assisted cheating on take-home assessments and coding tests has become common, many companies have shifted toward live, proctored, or interactive technical rounds specifically to verify real-time understanding — meaning genuine fluency matters more, not less, than it used to.

## New roles are appearing, and old ones are shifting

Roles explicitly focused on AI evaluation, prompt engineering, and human-AI workflow design didn't really exist a few years ago and now do — while some traditional roles are absorbing AI-fluency as a baseline expectation rather than a specialization. See our [Future of AI Careers](/blog/future-of-ai-careers) piece for more on this shift.

## What doesn't change

Companies still ultimately hire for judgment, communication, and the ability to solve problems that don't have a clean, pre-defined answer — AI tools change the mechanics of the process but haven't replaced what's actually being evaluated underneath.

## How to prepare given this shift

Build genuine fluency, not just AI-assisted output you can't defend under questioning — interviewers increasingly probe specifically to check whether a candidate actually understands what they submitted, precisely because AI-assisted submissions have become common enough to warrant it.

## The practical takeaway

Use AI tools to learn faster and prepare more efficiently, but make sure what you can demonstrate live — in an interview, on a whiteboard, in a follow-up question — genuinely reflects your own understanding. That gap is exactly what modern hiring processes are increasingly designed to catch.
$md$,
  (select id from blog_categories where slug = 'career-trends'),
  (select id from blog_authors where slug = 'prophezy-team'),
  6,
  false,
  'published',
  now() - interval '45 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, author_id = excluded.author_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'how-ai-is-changing-hiring' and t.slug in ('career-trends', 'ai')
on conflict do nothing;

-- ai-tools (was 1) — top up to 2
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_id, read_time_minutes, is_featured, status, published_at)
values (
  'best-ai-tools-for-students',
  'The AI Tools Actually Worth Using as a Student Right Now',
  'There are hundreds of "AI tools for students" listicles. Here''s a shorter, more honest list of what''s actually worth your time.',
  $md$## The problem with most "AI tools for students" lists

Most roundups list twenty tools with no real evaluation of which ones are genuinely useful versus which just have good marketing. This is a shorter, more opinionated list, organized by the actual problem each tool solves.

## For understanding dense material

A general-purpose AI chat assistant, used well, is genuinely good at explaining a concept multiple ways until one clicks, or working through a proof or derivation step by step. The skill here isn't the tool — it's asking for reasoning, not just answers, and pushing back when an explanation doesn't fully make sense.

## For turning your own material into study content

Tools that generate quizzes and flashcards *from documents you upload* (rather than generic content about a topic) save real time over manually writing cards — see our piece on [how Study Hub does this](/blog/how-study-hub-turns-a-pdf-into-a-quiz) for the specific approach.

## For code

AI coding assistants are genuinely useful for boilerplate, explaining unfamiliar code, and catching obvious bugs — but the skill of reading and understanding what they generate matters more as you rely on them more. Treat suggested code as a draft to review, not a final answer to paste blindly.

## For research and literature review

Tools that summarize and let you query your own uploaded papers (grounded in the actual text, not generic knowledge about the topic) meaningfully speed up the "is this paper relevant" filtering stage of a literature review — see [Inside Research Lab](/blog/inside-research-lab).

## For resumes

Grounded, resume-specific feedback tools that explain *why* a score is what it is — not just a number — are far more useful than generic "resume checker" tools that return a vague grade with no actionable detail.

## What to be skeptical of

Tools promising to fully automate work you're supposed to be learning from (writing entire essays, solving entire assignments) — beyond the academic integrity risk, you lose the actual skill-building the assignment existed to provide. Speed isn't the only variable that matters.

## The actual skill worth building

Not "using AI tools" as an abstract skill, but knowing specifically when a tool helps you learn faster versus when it lets you skip learning entirely. That judgment call, made honestly, is what separates AI use that compounds your ability from AI use that quietly erodes it.
$md$,
  (select id from blog_categories where slug = 'ai-tools'),
  (select id from blog_authors where slug = 'prophezy-team'),
  6,
  false,
  'published',
  now() - interval '47 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, author_id = excluded.author_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'best-ai-tools-for-students' and t.slug in ('ai', 'product')
on conflict do nothing;

-- python (was 1) — top up to 2
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_id, read_time_minutes, is_featured, status, published_at)
values (
  'python-libraries-every-data-student-should-know',
  'Python Libraries Every Data Student Should Know',
  'Past the basics, a handful of libraries cover almost everything you''ll actually use in data-focused coursework and projects.',
  $md$## Why library fluency matters more than syntax mastery at this stage

Once you're comfortable with core Python (see [Python for Beginners](/blog/python-for-beginners)), most real productivity gains come from knowing which library solves which problem — not from deeper knowledge of the language itself.

## NumPy: the foundation underneath everything else

Array operations, broadcasting, and vectorized math. Even if you never call NumPy directly in a given project, pandas and most ML libraries are built on top of it — understanding arrays and vectorization here pays off everywhere else.

```python
import numpy as np
scores = np.array([88, 74, 92, 65])
normalized = (scores - scores.mean()) / scores.std()
```

## pandas: for anything tabular

DataFrames, filtering, grouping, and merging datasets — this is what you'll use for the large majority of real data cleaning and analysis work. Learn `.groupby()`, `.merge()`, and boolean filtering deeply; they cover most practical needs.

## matplotlib and seaborn: for visualization

matplotlib gives you full control but requires more code; seaborn is built on top of it with better defaults for common statistical plots. Learn matplotlib's basics first so you understand what seaborn is doing underneath its simpler syntax.

## scikit-learn: for classical machine learning

Consistent API across models means once you understand the `fit`/`predict` pattern for one model, most others follow the same shape. This is the right entry point before deep learning frameworks — see the [Machine Learning Roadmap](/blog/machine-learning-roadmap).

## requests: for pulling data from the web

Fetching data from APIs is a common need once you move past pre-packaged datasets — `requests` is the standard, simple way to do this, worth learning even at a basic level.

## Common mistakes

- Learning a library's full API before you need most of it — learn incrementally, driven by actual project needs
- Not reading error messages from these libraries carefully — pandas and NumPy errors are often more informative than they first appear
- Reinventing functionality that already exists in the standard library or a well-known package, out of not knowing to look first

## How to actually build fluency

Pick a real, messy dataset and use each library to answer a genuine question with it, rather than working through isolated syntax exercises — the friction of real, imperfect data is where the actual learning happens.
$md$,
  (select id from blog_categories where slug = 'python'),
  (select id from blog_authors where slug = 'prophezy-team'),
  6,
  false,
  'published',
  now() - interval '49 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, author_id = excluded.author_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'python-libraries-every-data-student-should-know' and t.slug in ('data-science', 'machine-learning')
on conflict do nothing;

-- web-development (was 1) — top up to 2
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_id, read_time_minutes, is_featured, status, published_at)
values (
  'backend-roadmap-for-beginners',
  'A Backend Roadmap for Beginners',
  'Backend development has more moving parts than frontend, which makes an unordered learning path especially costly. Here''s a sequence that holds up.',
  $md$## Why backend feels harder to get started with

Frontend gives you immediate visual feedback — you see what you built. Backend work is more abstract at first: databases, APIs, and server logic you can't "see" the same way, which makes it harder to know if you're actually making progress. A clear sequence helps more here than almost anywhere else.

## Stage 1: HTTP and how the web actually works

Requests, responses, status codes, headers — understand what actually happens when a browser talks to a server before writing any backend code yourself. This context makes everything afterward click faster.

## Stage 2: Build a basic API

Pick a framework (Node/Express, Python/FastAPI, or similar) and build simple CRUD endpoints — create, read, update, delete — against an in-memory data structure first, before adding a real database. Isolate one new concept at a time.

```javascript
app.get("/students/:id", (req, res) => {
  const student = students.find(s => s.id === req.params.id);
  if (!student) return res.status(404).json({ error: "Not found" });
  res.json(student);
});
```

## Stage 3: Databases

SQL fundamentals (see our [SQL for Data Analysis](/blog/sql-for-data-analysis) guide for the query side), then connecting your API to a real database — schema design, relationships, and basic query optimization. Understand the difference between SQL and NoSQL databases and when each fits.

## Stage 4: Authentication

Sessions versus tokens, password hashing, and why you should essentially never write your own authentication from scratch — using well-established libraries and patterns is a deliberate, correct choice, not a shortcut.

## Stage 5: Testing and error handling

Writing tests for your endpoints, and handling failure cases explicitly (what happens when the database is down, when input is malformed) rather than only building the happy path. This is what separates a tutorial project from something resembling production code.

## Stage 6: Deployment

Getting your API running somewhere reachable — a small VPS, or a platform-as-a-service option — and understanding environment variables, basic logging, and what happens when your server restarts.

## Common mistakes

Skipping straight to a framework's "magic" features before understanding what they're abstracting away, and building an API with no error handling or validation, which works fine until real (messy) input arrives.

## A realistic first project

A small API with authentication, a real database, and at least one relationship between resources (users and their posts, for example) — deployed somewhere real, not just running locally — demonstrates the full stack of backend fundamentals in one project.
$md$,
  (select id from blog_categories where slug = 'web-development'),
  (select id from blog_authors where slug = 'prophezy-team'),
  8,
  false,
  'published',
  now() - interval '51 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, author_id = excluded.author_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'backend-roadmap-for-beginners' and t.slug in ('roadmap')
on conflict do nothing;

-- career-guidance (was 1) — top up to 2
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_id, read_time_minutes, is_featured, status, published_at)
values (
  'freelancing-as-a-student',
  'Freelancing as a Student: What Actually Works',
  'Freelancing while studying can genuinely build both skills and income — but most students approach it in ways that waste effort. Here''s a more realistic path.',
  $md$## Why freelancing appeals to students, and where it goes wrong

The appeal is real: flexible hours, real client work, and income alongside coursework. Where it commonly goes wrong is students spreading themselves across too many platforms and skill areas at once, competing on price against people doing this full-time, and burning out before building any real momentum.

## Pick one narrow skill to start

"I do web design, writing, video editing, and social media" reads as unfocused to a potential client. Picking one specific, in-demand skill — even something narrow like "landing pages for small businesses" — makes it far easier to build a portfolio and reputation than spreading thin across many services.

## Your first few clients matter more than your first few dollars

Early on, prioritize building a genuine portfolio and testimonials over maximizing hourly rate — a slightly underpaid project with a happy client who'll refer you or leave a strong review compounds faster than a slightly better-paid one that goes nowhere afterward.

## Where to actually find early work

Platforms like Upwork or Fiverr work, but expect significant competition on price starting out. Referrals from people you know, local small businesses, and student organizations needing specific work done are often lower-competition starting points, even if less structured than a platform.

## Pricing: don't underprice as much as instinct suggests

New freelancers consistently underprice out of fear of rejection — but a client who only says yes because of an extremely low price is often a worse client (more demanding, less respectful of your time) than one who pays a fair rate for real value. Research typical rates for your specific skill and region before setting yours.

## Managing scope and client expectations

Get the scope of work in writing before starting, even informally over email — "unlimited revisions" and vague deliverables are the most common source of freelance conflict and unpaid extra work. A clear, written scope protects both sides.

## Balancing it with coursework

Treat client deadlines with the same seriousness as academic ones — a blown deadline damages a professional reputation in a way a late assignment usually doesn't. If you can't realistically commit to a deadline given your academic schedule, negotiate it up front rather than after the fact.

## What this builds beyond income

Real client communication experience, a portfolio of shipped work, and — importantly — direct evidence you can handle deadlines and ambiguous requirements independently, which is exactly what internship and job interviews probe for.
$md$,
  (select id from blog_categories where slug = 'career-guidance'),
  (select id from blog_authors where slug = 'prophezy-team'),
  7,
  false,
  'published',
  now() - interval '53 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, author_id = excluded.author_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'freelancing-as-a-student' and t.slug in ('career-trends')
on conflict do nothing;

-- machine-learning (was 1) — top up to 2
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_id, read_time_minutes, is_featured, status, published_at)
values (
  'ai-engineer-career-path',
  'The AI Engineer Career Path, Realistically',
  '"AI Engineer" means different things at different companies. Here''s what the role actually involves, and how the path there differs from a pure ML research track.',
  $md$## Why this title is confusing right now

"AI Engineer" is a relatively new, fast-spreading title that means genuinely different things depending on the company — sometimes it's applied ML, sometimes it's building products on top of foundation models, sometimes it's closer to backend engineering with an AI-shaped API layer. Understanding which flavor a specific role is matters more than the title itself.

## The most common shape of the role today

At most companies (outside dedicated AI research labs), "AI Engineer" increasingly means building and integrating AI-powered features into products — calling and orchestrating LLM APIs, designing prompts and evaluation systems, and handling the engineering around reliability, cost, and latency — more than training models from scratch.

## How this differs from an ML research path

ML research roles focus on developing new models or techniques, usually requiring deeper theoretical grounding and often a graduate degree. The applied AI engineer path leans more on strong software engineering fundamentals plus practical AI-integration skills — a different, more accessible on-ramp for most students.

## The skills that actually matter for this path

Strong general software engineering (APIs, databases, testing, deployment) first — AI-specific skills layer on top of that foundation, not instead of it. Then: prompt engineering and evaluation design, understanding of embeddings and retrieval-augmented generation, and enough ML fundamentals to reason about model behavior and limitations, even without training models yourself.

## Building a portfolio for this specific path

A project that goes beyond a basic chatbot wrapper — something involving real evaluation (how do you know it works well), grounding in real data, and a genuine deployed product, not just a notebook — see [Best AI Projects for Resume](/blog/best-ai-projects-for-resume) for more on what distinguishes a strong AI project.

## Where the jobs actually are right now

More often at product companies building AI-powered features than at dedicated AI research labs, which have fewer, more research-focused openings with a higher academic bar. Most students' realistic path into "AI Engineer" work runs through general software engineering roles that increasingly include AI-integration work, not through research labs directly.

## What to watch for in a job posting

If a posting for "AI Engineer" is mostly generic software engineering with occasional mention of "AI-powered features," that's the applied, more accessible flavor. If it requires a PhD and lists specific research publications as a plus, that's the research flavor — a different, longer path.

## A realistic starting point

Strong general software engineering fundamentals, one or two genuinely well-built AI-integrated projects, and familiarity with how modern LLM-powered products are actually built and evaluated — that combination covers most of what applied AI engineering roles are actually looking for from early-career candidates.
$md$,
  (select id from blog_categories where slug = 'machine-learning'),
  (select id from blog_authors where slug = 'prophezy-team'),
  7,
  false,
  'published',
  now() - interval '55 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, author_id = excluded.author_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'ai-engineer-career-path' and t.slug in ('ai', 'machine-learning', 'career-trends')
on conflict do nothing;
