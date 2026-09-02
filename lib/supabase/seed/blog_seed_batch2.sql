-- Second content batch. Run AFTER 20260807b_blog_expansion.sql.

-- 11. Python for Beginners
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_id, read_time_minutes, is_featured, status, published_at)
values (
  'python-for-beginners',
  'Python for Beginners: A Path That Doesn''t Waste Your Time',
  'Most "Python for beginners" content teaches syntax with no direction. Here''s an order that gets you to real, working programs fast.',
  $md$## Why Python first

If you're choosing a first language for AI, data, or general backend work, Python's syntax gets out of the way faster than most alternatives, and the ecosystem (pandas, requests, FastAPI) means you can build real things almost immediately after the basics.

## Week 1: Syntax you'll actually use daily

Variables, strings, numbers, lists, dictionaries, and control flow (`if`, `for`, `while`). Don't linger on edge cases here — you'll absorb them naturally once you're writing real code. The goal this week is fluency, not mastery.

```python
students = [{"name": "Asha", "score": 88}, {"name": "Ravi", "score": 74}]
top_students = [s["name"] for s in students if s["score"] >= 80]
print(top_students)  # ['Asha']
```

## Week 2: Functions and files

Writing your own functions, understanding return values versus print statements (a common early confusion), and reading/writing files. This is also the right time to learn how to structure a script with more than one function without it turning into spaghetti.

## Week 3: Working with real data

`csv` and `json` modules, then `pandas` once you're comfortable with plain Python data structures. Pull a real, messy CSV — attendance records, expense tracking, anything with actual gaps and inconsistencies — and practice cleaning it.

## Week 4: Errors, debugging, and reading tracebacks

This is the stage most beginner courses skip entirely, and it's the single biggest thing separating someone who can "write Python" from someone who can actually build things. Learn to read a traceback bottom-up, use `print` debugging deliberately, and understand common error types (`KeyError`, `IndexError`, `TypeError`) well enough to fix them without searching every time.

## Week 5: A first real project

Pick something with a genuine use case — a script that renames a folder of files by a pattern, a small command-line expense tracker, or a scraper for a public dataset you care about. The constraint that makes this useful: it has to solve a problem you actually have, not a tutorial's problem.

## Common mistakes beginners make

- **Copying code without running it line by line first.** You learn far less from code you didn't watch execute.
- **Skipping the standard library.** Before installing a package, check if `os`, `re`, `datetime`, or `collections` already solves it — this also teaches you to read documentation.
- **Never using a debugger.** `print` statements work, but learning your editor's breakpoint debugger early saves you enormously later, especially once programs grow past 100 lines.

## Best practices worth building early

Use meaningful variable names from day one — `student_scores` over `x`. Write a short comment explaining *why*, not *what*, when logic isn't obvious. Keep functions short enough to read without scrolling.

## Where to go next

Once you're comfortable, branch based on your goal: `pandas`/`numpy` for data work, `Flask`/`FastAPI` for backend and APIs, or straight into the [Complete AI Roadmap](/blog/complete-ai-roadmap) if machine learning is the target. Python fluency is the foundation under all three — it's worth the four to five weeks before you specialize.
$md$,
  (select id from blog_categories where slug = 'python'),
  (select id from blog_authors where slug = 'prophezy-team'),
  8,
  false,
  'published',
  now() - interval '1 day'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, author_id = excluded.author_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'python-for-beginners' and t.slug in ('roadmap')
on conflict do nothing;

-- 12. DSA Complete Roadmap
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_id, read_time_minutes, is_featured, status, published_at)
values (
  'dsa-complete-roadmap',
  'The Complete DSA Roadmap for Placements',
  'Data structures and algorithms prep, ordered by what actually shows up in interviews — not by textbook chapter order.',
  $md$## Why order matters here too

DSA has a natural dependency chain — recursion before dynamic programming, arrays before more complex structures — but most students study topics in whatever order a playlist presents them, which means gaps show up right before an interview instead of during prep.

## Phase 1: Arrays, strings, and two pointers (1–2 weeks)

This is where most easy-to-medium interview questions live. Master sliding window and two-pointer patterns specifically — they solve a disproportionate share of array and string problems once you recognize the pattern.

## Phase 2: Hashing and recursion (1–2 weeks)

Hash maps for O(1) lookups come up constantly — practice recognizing when a nested loop can become a single pass with a hash map. Recursion is the harder mental shift: practice tracing recursive calls by hand on paper before trusting yourself to write them cold.

## Phase 3: Linked lists, stacks, and queues (1 week)

Fewer questions rely purely on these structures now, but they're foundational for later topics (trees are essentially linked structures; BFS uses queues). Don't skip this phase even if it feels less "interview-relevant" — it's load-bearing for what comes next.

## Phase 4: Trees and graphs (2–3 weeks)

Binary trees, BSTs, DFS/BFS traversal, and basic graph algorithms. This phase has the steepest learning curve — budget real time for it. Draw every tree and graph problem by hand before coding; visualizing the structure is most of the battle.

## Phase 5: Dynamic programming (2–3 weeks)

The topic students fear most, usually because it's taught abstractly. Learn it through the lens of "recursion plus memoization" — solve the brute-force recursive version first, identify the repeated subproblems, then add caching. Once that clicks, DP stops feeling like magic.

## Phase 6: Greedy algorithms and heaps (1 week)

Fewer topics, but heaps specifically show up in "kth largest," scheduling, and merge-style problems often enough to be worth dedicated practice.

## How to practice, not just learn

- Time yourself on problems, even early on — interview pressure is part of what you're training for.
- After solving a problem, look at one or two other approaches, even if yours worked — pattern recognition compounds.
- Revisit topics after two weeks, not just once — spaced repetition matters more for DSA than almost any other technical skill.

## Common mistakes

Grinding random problems with no pattern focus, memorizing solutions instead of understanding the underlying technique, and skipping the "explain your approach out loud" step that interviews actually test.

## A realistic timeline

Eight to twelve weeks of consistent, focused practice (not marathon weekend sessions) will take a beginner to interview-ready for most campus placement processes. Depth on fewer patterns, practiced until automatic, beats shallow exposure to everything.
$md$,
  (select id from blog_categories where slug = 'interview-preparation'),
  (select id from blog_authors where slug = 'prophezy-team'),
  9,
  true,
  'published',
  now() - interval '3 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, author_id = excluded.author_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'dsa-complete-roadmap' and t.slug in ('roadmap', 'interviews')
on conflict do nothing;

-- 13. System Design for Beginners
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_id, read_time_minutes, is_featured, status, published_at)
values (
  'system-design-for-beginners',
  'System Design for Beginners: Where to Actually Start',
  'System design feels intimidating because most resources start in the middle. Here''s the on-ramp for someone who has never designed a system before.',
  $md$## Why this feels harder than it needs to be

Most system design content assumes you already know what a load balancer, cache, or message queue is for — and jumps straight into "design Twitter." If you're a student with mostly coursework experience, that's starting three steps ahead of where you actually are.

## Step 1: Understand what problem each building block solves

Before designing anything, know why each piece exists:

- **Load balancer** — spreads requests across multiple servers so no single one is overwhelmed
- **Cache** — stores frequently-requested data in fast memory so you're not hitting the database every time
- **Database replication** — copies of your data across multiple machines, for both speed and reliability
- **Message queue** — lets one part of a system hand off work to another without waiting for it to finish immediately

Learn these as answers to specific problems, not as abstract vocabulary.

## Step 2: Learn to estimate scale

A huge part of system design is back-of-envelope math — how many requests per second, how much storage, how much bandwidth. Practice this explicitly: "If 10 million users check this feed once a day, roughly how many reads per second is that at peak?" Getting comfortable with rough estimation is often what separates a strong answer from a vague one.

## Step 3: Practice the standard interview structure

1. Clarify requirements — what does this system actually need to do, and what can you explicitly leave out?
2. Estimate scale — rough numbers for users, requests, and data size
3. Sketch the high-level design — client, servers, database, cache, at a glance
4. Go deep on one or two components — usually whichever the interviewer probes
5. Discuss trade-offs — what would break at 10x the scale, and how you'd address it

## Step 4: Start with smaller, concrete systems

Don't start with "design Twitter." Start with a URL shortener, a rate limiter, or a simple chat application — systems with a small enough surface area that you can actually reason through every part, rather than hand-waving.

## Common mistakes beginners make

- Jumping straight to a complex architecture without clarifying requirements first
- Naming technologies (Kafka, Redis) without explaining what problem they solve in this specific design
- Ignoring trade-offs — every design decision costs something; interviewers want to hear that you know what

## Best practices

Draw the diagram as you talk, even in a text-based interview — describing components left to right, in the order a request would actually flow through them, keeps your explanation structured. Narrate your assumptions out loud; system design interviews reward visible reasoning more than a "correct" final architecture.

## Where to go from here

Once the fundamentals feel comfortable, move to case studies of real systems (URL shorteners, rate limiters, then progressively larger systems like a social feed or a chat app) and start timing yourself — 30–40 minutes per design, matching real interview conditions.
$md$,
  (select id from blog_categories where slug = 'interview-preparation'),
  (select id from blog_authors where slug = 'prophezy-team'),
  9,
  false,
  'published',
  now() - interval '5 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, author_id = excluded.author_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'system-design-for-beginners' and t.slug in ('interviews')
on conflict do nothing;

-- 14. React Learning Path
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_id, read_time_minutes, is_featured, status, published_at)
values (
  'react-learning-path',
  'A Practical React Learning Path',
  'Skip the seventeen ways to manage state before you''ve built anything. Here''s a focused path from zero to a real deployed React app.',
  $md$## Prerequisite: JavaScript, not React

The single biggest reason React feels confusing to beginners is a shaky JavaScript foundation, not React itself. Before starting React, be genuinely comfortable with array methods (`map`, `filter`, `reduce`), destructuring, arrow functions, and async/await. If those feel shaky, spend a focused week there first.

## Stage 1: Components and props

Start with function components, JSX syntax, and passing data via props. Build small, static components first — a card, a button, a nav bar — before introducing any interactivity at all.

```jsx
function StudentCard({ name, score }) {
  return (
    <div className="card">
      <h3>{name}</h3>
      <p>Score: {score}</p>
    </div>
  );
}
```

## Stage 2: State and events

`useState` and event handlers — this is where React starts feeling different from plain HTML/JS. Build a few genuinely interactive small components: a counter, a toggle, a simple form with controlled inputs. Resist the urge to reach for a state management library here — `useState` handles more than beginners expect.

## Stage 3: Effects and data fetching

`useEffect` for side effects, and fetching data from an API. This is also the right time to learn about loading and error states — a component that only handles the "happy path" isn't done.

## Stage 4: Component composition and lifting state

Learn to break a UI into components deliberately, and understand "lifting state up" when two sibling components need to share data. This is more of a design skill than a syntax one — practice by taking an app you built as one big component and refactoring it into smaller pieces.

## Stage 5: Routing and a real project

Add `react-router` (or Next.js if you're ready for a framework) and build one complete, deployed project — not a todo app, something with real data, like a small dashboard pulling from a public API. Deploy it somewhere reachable (Vercel is the simplest option) so it's a real, working link, not just local code.

## Common mistakes

- **Reaching for Redux or complex state management too early.** Most student projects never need it — `useState` and prop drilling for two or three levels is fine.
- **Not understanding re-renders.** Learn why components re-render and how `key` props work in lists; this prevents a whole category of confusing bugs later.
- **Copy-pasting from Stack Overflow without understanding the hook rules** (why hooks can't be called conditionally, for example) — this causes bugs that are hard to debug without that foundation.

## Best practices worth adopting early

Keep components small and focused on one responsibility. Name state variables descriptively (`isLoading`, not `flag`). Extract repeated logic into custom hooks once you notice yourself copying the same `useEffect` pattern twice.

## Where to go next

Once comfortable, Next.js (React plus routing, server components, and deployment conventions built in) is the natural next step, especially if your goal includes full-stack or [backend roadmap](/blog/backend-roadmap) skills alongside frontend.
$md$,
  (select id from blog_categories where slug = 'web-development'),
  (select id from blog_authors where slug = 'prophezy-team'),
  9,
  false,
  'published',
  now() - interval '7 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, author_id = excluded.author_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'react-learning-path' and t.slug in ('roadmap')
on conflict do nothing;

-- 15. LinkedIn Optimization Guide
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_id, read_time_minutes, is_featured, status, published_at)
values (
  'linkedin-optimization-guide',
  'The LinkedIn Optimization Guide for Students',
  'A student LinkedIn profile has a specific job: get recruiters to stop scrolling. Here''s how to actually do that.',
  $md$## Your headline is doing less work than you think

The default headline (your current job title or "Student at X University") wastes the most visible line on your profile. Replace it with what you're actually aiming for and what you bring — "CS Student | Building with React & Python | Seeking SDE Internships" tells a recruiter far more in one line than a default title ever will.

## The "About" section is a pitch, not a bio

Most student About sections read like a resume summary restated in paragraph form. Instead, write it like you're two sentences into a real conversation: what you're working on, what you're good at, and what you're looking for — specific enough that someone skimming remembers something concrete.

## Featured section: don't leave it empty

The Featured section is prime visual real estate directly under your profile photo — pin your best project, a published article, or a strong certificate here. An empty Featured section is a missed opportunity most students don't even realize exists.

## Experience section: results, not duties

Same principle as resume writing — "Built a Flask API used by 40 daily active users" beats "Worked on backend development." If you don't have full-time experience yet, list projects and internships with the same results-first structure.

## Skills: order matters

LinkedIn lets you reorder your skills list — put your three most relevant, strongest skills first; that's what shows without a click. Get a few connections to endorse your top skills specifically; a skill with zero endorsements next to one with twelve looks less credible, fairly or not.

## Building a network that actually helps

Connecting with 500 strangers does less than genuinely engaging with 30 people in your target field. Comment thoughtfully on posts from people at companies you're interested in, follow up after events or calls with a short personalized connection request, and don't be shy about reaching out to alumni from your college who moved into roles you want.

## Posting: you don't need to post daily

One well-written post about a project you finished, a lesson from an internship, or a technical concept you learned deeply, does more for visibility than sporadic generic "excited to announce" posts. Quality and relevance beat frequency here.

## Common mistakes

- A profile photo that's a cropped group picture — get a plain, well-lit headshot, even from a phone
- No banner image, leaving the default blue — a simple custom banner signals effort
- A profile with an internship listed but no description of what you actually did

## Turning profile views into opportunities

Once your profile is strong, use LinkedIn's job search filters actively — "Easy Apply" isn't the only path; messaging a recruiter or hiring manager directly, referencing something specific from the job posting, consistently outperforms a cold application with no context.
$md$,
  (select id from blog_categories where slug = 'career-guidance'),
  (select id from blog_authors where slug = 'prophezy-team'),
  7,
  false,
  'published',
  now() - interval '9 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, author_id = excluded.author_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'linkedin-optimization-guide' and t.slug in ('career-trends', 'internships')
on conflict do nothing;

-- 16. How Recruiters Read Your Resume
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_id, read_time_minutes, is_featured, status, published_at)
values (
  'how-recruiters-read-your-resume',
  'How Recruiters Actually Read Your Resume',
  'Understanding the real reading pattern — not the ideal one — changes how you should structure every section.',
  $md$## The six-second scan is real

Recruiters reviewing high volumes of applications genuinely do skim first, in an F-shaped or Z-shaped pattern — top line, then down the left edge, occasionally across. If your strongest qualification is buried in the third bullet of your second job, it may simply never get read on the first pass.

## What they look at first

In rough order: your most recent role or project title, the company or context, and then — critically — whether the bullets underneath contain a number or a concrete outcome. Recruiters are pattern-matching for evidence, not reading prose.

## Why the top third of page one matters most

Many recruiters decide whether to keep reading within the first 15–20 seconds. That means your most relevant, most impressive line needs to be visible without scrolling or turning a page — which is why generic "objective" statements at the top are often a wasted opportunity; that space could hold your strongest project instead.

## What makes a recruiter stop and actually read

- A specific number that's unusually good ("reduced load time by 60%" stops the scan)
- A recognizable company, even as an intern
- A project description that matches the exact stack in the job posting
- Clean, consistent formatting that doesn't require effort to parse

## What makes them move on

Walls of text with no visual hierarchy, vague bullets ("responsible for..."), inconsistent formatting that signals carelessness, and — very commonly — a resume that doesn't clearly say what role you're applying for within the first glance.

## The two-pass reality

If your resume survives the first six-second scan, it typically gets a second, closer read — this is when they check dates for gaps, verify your skills align with the role, and look for specific technical depth. Both passes matter, but you only get a second pass if the first one goes well.

## What this means for how you write

Front-load every bullet with the outcome or the most impressive detail, not the setup. "Reduced query time by 70% by adding database indexing" reads faster and better than "Added database indexing to improve query performance, resulting in a 70% reduction."

## A test worth running

Give your resume to someone unfamiliar with your work for exactly ten seconds, then ask what they remember. If they can't summarize what you're good at and what you're looking for, your strongest content isn't positioned where it needs to be.
$md$,
  (select id from blog_categories where slug = 'resumes'),
  (select id from blog_authors where slug = 'prophezy-team'),
  6,
  false,
  'published',
  now() - interval '11 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, author_id = excluded.author_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'how-recruiters-read-your-resume' and t.slug in ('resume')
on conflict do nothing;

-- 17. Best AI Projects for Resume
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_id, read_time_minutes, is_featured, status, published_at)
values (
  'best-ai-projects-for-resume',
  'AI Projects That Actually Strengthen Your Resume',
  'Not every AI project impresses a recruiter equally. Here''s what separates a project that gets noticed from another chatbot clone.',
  $md$## Why most "AI projects" blend together

Recruiters and interviewers see an enormous number of resumes listing "built a chatbot using OpenAI API" or "sentiment analysis on Twitter data" — these were genuinely good learning projects five years ago, but at this point they signal you followed a tutorial, not that you solved a real problem.

## What actually differentiates a project

1. **A real, specific dataset or problem** — not the same public dataset everyone uses, or at least a genuinely novel angle on it
2. **Evidence of evaluation** — you measured whether it actually works, with a real metric, not just "it seemed to work"
3. **A deployed, usable end product** — a notebook that runs once on your machine is a different (lesser) thing than something someone else can actually try
4. **A clearly explained limitation** — knowing where your project breaks down shows more maturity than pretending it's perfect

## Project ideas that stand out

- **A tool that solves a problem specific to your own life** — a study-schedule optimizer using your actual course load, a personal finance categorizer trained on your own transaction history (anonymized appropriately)
- **An evaluation project** — build a small benchmark testing how well a public model performs on a specific, narrow task, and write up the results honestly, including where it fails
- **A retrieval-augmented application** — grounding an LLM in a specific, real document set (lecture notes, a company's public docs) rather than a generic chatbot with no grounding
- **A small but real deployment** — even a simple Streamlit or Next.js app with a working model behind it, live at a URL, beats a static notebook

## What to avoid

- Yet another "chat with your PDF" clone with no distinguishing angle
- A project you can't explain the internals of when asked — if you can't explain why you chose that model or metric, it reads as copied
- Overstating scope in the README ("production-grade AI system") for something that's genuinely a weekend project — the gap between claim and reality is worse than a modest, honest description

## How to present it on your resume

Lead with the outcome, not the tech stack: "Built and deployed a resume-parsing tool achieving 91% field-extraction accuracy on a 200-resume test set" tells a recruiter far more than "Used Python, spaCy, and Streamlit."

## The interview test

Before listing any project, make sure you can explain, unprompted: why you built it, what you'd do differently now, and one specific technical decision you made and why. If you can't answer those three things fluently, the project needs more depth before it goes on your resume — or more preparation before your next interview.
$md$,
  (select id from blog_categories where slug = 'machine-learning'),
  (select id from blog_authors where slug = 'prophezy-team'),
  7,
  true,
  'published',
  now() - interval '13 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, author_id = excluded.author_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'best-ai-projects-for-resume' and t.slug in ('ai', 'resume', 'machine-learning')
on conflict do nothing;

-- 18. Time Management for College Students
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_id, read_time_minutes, is_featured, status, published_at)
values (
  'time-management-for-college-students',
  'Time Management for College Students Who Are Also Trying to Build a Career',
  'Coursework, projects, internship applications, and a social life don''t fit in the same 24 hours without a system. Here''s one that holds up.',
  $md$## The real problem isn't time — it's context switching

Most students don't actually lack hours; they lose time to constantly switching between unrelated tasks — a bit of coursework, then a scroll break, then an internship application, then back to coursework with half the context lost. Rebuilding focus after each switch is where the real time goes.

## Time-block by type of work, not by task

Instead of a to-do list with twelve unrelated items, group your week into blocks: deep coursework time, project/build time, applications and networking time, and admin time (emails, forms, scheduling). Batch similar tasks together so you're not mentally shifting gears every twenty minutes.

## The two-list system

Keep a "this week" list (realistic, five to seven items) separate from a "someday" list (everything else you want to do eventually). Most productivity systems fail because a single giant list mixes urgent and someday items, making the list itself stressful to look at.

## Protect one deep-work block a day

Even 90 focused, phone-away minutes on your hardest task each day compounds enormously over a semester compared to fragmented ten-minute attempts throughout the day. Pick your highest-energy time of day for this block, not whatever's left over.

## Applications and networking need their own slot

Internship and job applications are easy to let slide because they don't have a hard deadline pulling you back to them the way an assignment does. Give them a fixed weekly slot — even 90 minutes, consistently — rather than "whenever I have time," which usually means never.

## Saying no to protect the schedule

Not every club, event, or opportunity deserves a yes. A shorter list of things you're genuinely committed to, done well, builds a stronger resume and reputation than a long list of things you're stretched too thin to do properly.

## Common mistakes

- **Planning your day in your head instead of writing it down** — a plan that isn't written is a lot easier to abandon by 11am
- **Treating rest as optional** — burnout doesn't just feel bad, it actively reduces the quality and speed of your work, making the trade-off worse than it looks
- **Over-scheduling** — a calendar with zero buffer breaks the first time something runs long, which is most days

## A system that survives a bad week

The point isn't a perfect schedule — it's one flexible enough to bend without collapsing entirely. Build in a weekly review (fifteen minutes, same time each week) to see what actually happened versus what you planned, and adjust the following week's blocks accordingly.
$md$,
  (select id from blog_categories where slug = 'productivity'),
  (select id from blog_authors where slug = 'prophezy-team'),
  7,
  false,
  'published',
  now() - interval '15 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, author_id = excluded.author_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'time-management-for-college-students' and t.slug in ('career-trends')
on conflict do nothing;

-- 19. Study Techniques That Actually Work
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_id, read_time_minutes, is_featured, status, published_at)
values (
  'study-techniques-that-actually-work',
  'Study Techniques That Actually Work (Backed by How Memory Works)',
  'Highlighting and re-reading feel productive and barely work. Here are the techniques cognitive science actually supports.',
  $md$## Why re-reading feels effective but isn't

Re-reading notes creates a sense of familiarity that gets mistaken for actual understanding — you recognize the material, which feels like knowing it, but recognition and recall are different skills, and exams test recall. This is the single biggest gap between how students study and what actually works.

## Active recall: the highest-leverage technique

Instead of re-reading a chapter, close it and try to write down everything you remember, then check what you missed. This forces your brain to actually retrieve the information, which is the mechanism that strengthens memory — re-reading doesn't do this at all.

Practically: after each study session, spend the last five minutes writing a blank-page summary from memory before checking your notes.

## Spaced repetition beats cramming, provably

Reviewing material at increasing intervals (a day later, then three days, then a week) produces dramatically better long-term retention than the same total study time crammed into one or two sessions. Tools like Anki automate the scheduling, but even a simple manual review calendar captures most of the benefit.

## The Feynman technique for genuinely hard concepts

Explain the concept out loud, in plain language, as if teaching someone with no background — including the parts where you get stuck. The exact point where your explanation breaks down is the exact gap in your understanding. This is far more diagnostic than "I understand this" based on re-reading.

## Interleaving: mixing topics on purpose

Studying multiple related topics in a mixed order (rather than one topic exhaustively before moving to the next) is harder in the moment but produces better long-term learning, because it forces you to actively identify which method or concept applies, rather than passively applying whatever the current chapter is about.

## Practice testing over practice reading

Past papers and practice problems, done under real time constraints, are a far better use of study time than another read-through of notes — not just because they're similar to the real exam, but because the retrieval itself is what builds memory.

## Common mistakes

- **Highlighting extensively** — it feels productive but is closer to re-reading in disguise; highlighting doesn't require retrieval
- **Studying in long, unbroken blocks** — attention genuinely degrades; short breaks (the classic 25-on/5-off pattern, or any variant) sustain focus better than grinding through fatigue
- **Only studying material you already find easy** — the temptation to avoid your weakest topics is strong, and exactly backward

## Putting it together

A realistic weekly structure: active recall at the end of each session, spaced review of older material a few times a week, and full practice-test conditions at least once before any real exam. None of this requires more hours — it requires spending the hours you already have differently.
$md$,
  (select id from blog_categories where slug = 'productivity'),
  (select id from blog_authors where slug = 'prophezy-team'),
  7,
  false,
  'published',
  now() - interval '17 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, author_id = excluded.author_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'study-techniques-that-actually-work' and t.slug in ('career-trends')
on conflict do nothing;

-- 20. Interview Questions Every Student Should Know
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_id, read_time_minutes, is_featured, status, published_at)
values (
  'interview-questions-every-student-should-know',
  'Interview Questions Every Student Should Be Ready For',
  'A handful of questions come up across nearly every technical interview loop, in some form. Here''s how to actually prepare for them.',
  $md$## "Tell me about yourself"

This isn't small talk — it's usually the interviewer's first real data point, and a rambling answer sets a weak tone for everything after. Prepare a 60–90 second version: your background, what you've focused on, and what you're looking for now, ending on something that naturally invites a follow-up question.

## "Walk me through a project on your resume"

Have a structured answer ready for your top two projects specifically: the problem, your approach, one real technical decision and why you made it, and what you'd change with more time. Interviewers are listening for depth, not a list of technologies used.

## "Tell me about a time you failed" / "a time a project didn't work"

Prepare a real example, not a humble-brag disguised as a failure ("I worked too hard"). A genuine failure, with what you learned and changed afterward, demonstrates more maturity than a polished non-answer — interviewers can usually tell the difference.

## "Why this company / this role?"

Generic answers ("great culture," "exciting opportunity") are instantly forgettable. Research something specific — a product decision, an engineering blog post, a technology choice — and connect it to what you actually want to work on. This takes fifteen minutes of prep and meaningfully changes how the answer lands.

## "Explain [core CS concept] to me"

Common ones: the difference between a process and a thread, how a hash map works internally, what happens when you type a URL into a browser, or SQL versus NoSQL trade-offs. These test foundational understanding, not memorization — practice explaining each out loud, not just reading the definition.

## "How would you approach [vague problem]?"

Interviewers deliberately under-specify sometimes to see if you ask clarifying questions before diving in. Resist the urge to immediately start solving — spend 30 seconds clarifying scope and constraints first; it's a stronger signal than a fast but misdirected answer.

## "Do you have any questions for us?"

Never say no. Prepare two or three genuine questions in advance — about the team's current challenges, how success is measured in the role, or what the onboarding process looks like. This is also your best chance to evaluate whether the role is actually right for you.

## Common mistakes across all of these

Memorized, generic answers that don't reference anything specific to you or the company; rambling without a clear structure; and not preparing concrete examples in advance, which forces you to improvise under pressure exactly when you can least afford to.

## How to actually prepare

Write out short bullet-point answers (not full scripts — memorized scripts sound stilted) for each of these, then practice saying them out loud, ideally to another person, at least once before a real interview.
$md$,
  (select id from blog_categories where slug = 'interview-preparation'),
  (select id from blog_authors where slug = 'prophezy-team'),
  8,
  false,
  'published',
  now() - interval '19 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, author_id = excluded.author_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'interview-questions-every-student-should-know' and t.slug in ('interviews')
on conflict do nothing;
