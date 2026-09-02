-- Product content batch — genuine explainer articles about Prophezy's own
-- modules, written to actually teach something (how it works, why it's
-- built that way) rather than as thin ad copy. Run AFTER
-- 20260807b_blog_expansion.sql (needs blog_authors + the category table).

insert into blog_categories (slug, name, description) values
  ('product', 'Product', 'How Prophezy''s own modules work, and why they''re built the way they are.')
on conflict (slug) do update set name = excluded.name, description = excluded.description;

insert into blog_tags (slug, name) values
  ('product', 'Product'),
  ('placement-engine', 'Placement Engine'),
  ('study-hub', 'Study Hub'),
  ('resume-studio', 'Resume Studio'),
  ('research-lab', 'Research Lab')
on conflict (slug) do nothing;

-- 21. Inside Placement Engine
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_id, read_time_minutes, is_featured, status, published_at)
values (
  'inside-placement-engine',
  'Inside Placement Engine: How Prophezy Finds Opportunities You''d Never Find Yourself',
  'Most students check three or four job boards on a good week. Here''s how Placement Engine checks continuously, across sources, and only surfaces what actually fits.',
  $md$## The real problem with internship hunting

Finding internships isn't actually a search problem — it's a coverage and filtering problem. Opportunities are scattered across Internshala, LinkedIn, company career pages, and GitHub, each updated at different times, and most students only have the bandwidth to check two or three sources on their best week. The ones with more time to search don't necessarily have better profiles — they just see more of what's out there.

## What Placement Engine actually does

Placement Engine runs as a background process connected to multiple sources — Internshala, LinkedIn Jobs, GitHub, and company career pages directly (Google, Microsoft, Amazon, and others) — and continuously syncs new postings rather than requiring you to go check. When a new listing appears, it's evaluated against your profile: your coursework, project history, and stated interests, not just keyword matching against your resume.

## Why it rejects things, and shows you why

A large part of what makes the feed useful is what it filters out. If a listing's deadline has already passed, or the role clearly doesn't match your skill profile, it's discarded rather than shown — and for the ones that make it through, you see a short explanation of why it matched: which of your projects or coursework it lined up with, not just a vague match score.

## You always apply on the original source

This is a deliberate design decision, not a limitation: Placement Engine discovers and ranks, but every application happens on the platform the listing actually came from — Internshala, LinkedIn, or the company's own page. Nothing about your application is submitted on your behalf. This keeps you in control of exactly what you're submitting, and avoids the trust problem of an AI applying for you without your final review.

## Why continuous beats scheduled

Internship postings, especially at smaller companies, often fill within days. A student manually checking sources once a week is structurally behind students who check daily — not because they're less capable, just less available. Placement Engine's advantage isn't intelligence, it's persistence: it doesn't get busy during exam week.

## What this looks like in practice

Open the Placement Engine tab and you'll see a ranked feed, refreshed automatically, with each listing showing its match reasoning up front. You can bookmark ones you're not ready to apply to yet, and dismiss ones that clearly aren't relevant — dismissals help refine what gets surfaced going forward.

## Try it

If you haven't opened Placement Engine yet, the fastest way to see if it's useful is to just look at what it's already surfaced for your profile — it runs from the moment you create an account, so there's usually something waiting the first time you check.
$md$,
  (select id from blog_categories where slug = 'product'),
  (select id from blog_authors where slug = 'prophezy-team'),
  6,
  true,
  'published',
  now() - interval '12 hours'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, author_id = excluded.author_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'inside-placement-engine' and t.slug in ('product', 'placement-engine', 'internships')
on conflict do nothing;

-- 22. How Study Hub turns a PDF into a quiz
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_id, read_time_minutes, is_featured, status, published_at)
values (
  'how-study-hub-turns-a-pdf-into-a-quiz',
  'How Study Hub Turns Any PDF Into a Quiz That Actually Tests What You Read',
  'Most flashcard apps make you write the cards yourself. Study Hub reads what you uploaded and generates study material grounded in it.',
  $md$## The problem with generic study apps

Flashcard and quiz apps are only as good as what you put into them — and writing your own cards from lecture slides takes almost as long as studying the material itself. Most students skip this step entirely and fall back to just re-reading notes, which — as the research on active recall shows — is one of the least effective ways to actually retain material.

## What Study Hub does differently

Upload a PDF, slide deck, or scanned document, and Study Hub extracts the actual text (using OCR for scanned material), then generates quiz questions and flashcards grounded in that specific content — not generic questions about the general topic. If your professor's slides emphasize a particular framework or example, the generated material reflects that emphasis, because it's reading what you actually have, not guessing at a syllabus.

## Why grounding matters

A quiz generated from general knowledge about "cellular respiration" might test facts your course never covered, or miss the specific angle your professor cares about. Because Study Hub is grounded in your actual uploaded document, questions map to what you're actually responsible for — which matters more the closer you get to an exam.

## Handling messy source material

Scanned lecture slides, handwritten notes photographed on a phone, and inconsistently formatted PDFs are all common, and all harder to parse than clean text. Study Hub's OCR pipeline (built on Tesseract.js) is specifically tuned for this — it's the difference between a tool that only works on textbook PDFs and one that works on the actual messy material students really have.

## From upload to first quiz, in practice

The fastest way to see this work: upload one real document — ideally something you're studying this week, not a test file — and generate a quiz from it immediately. You'll notice the questions reference specific details from your document, not generic textbook phrasing, within the first few questions.

## Why this beats writing your own flashcards

Manually writing flashcards is valuable, but it's also a bottleneck — many students simply don't do it consistently, especially under exam pressure. Automating the first draft of study material, generated from what you already have, removes the barrier that usually stops the habit before it starts. You can still edit or discard generated cards that miss the mark; the goal is a faster starting point, not a replacement for your judgment about what matters.

## Where to start

If you have one upcoming exam, upload the single most content-dense document you have for it — usually a slide deck or your most complete set of notes — and generate a quiz. That's the fastest way to see whether Study Hub fits into how you actually study.
$md$,
  (select id from blog_categories where slug = 'product'),
  (select id from blog_authors where slug = 'prophezy-team'),
  6,
  false,
  'published',
  now() - interval '2 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, author_id = excluded.author_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'how-study-hub-turns-a-pdf-into-a-quiz' and t.slug in ('product', 'study-hub', 'ai')
on conflict do nothing;

-- 23. How Resume Studio actually scores your resume
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_id, read_time_minutes, is_featured, status, published_at)
values (
  'how-resume-studio-scores-your-resume',
  'How Resume Studio Actually Scores Your Resume (Not Just a Vague Number)',
  'A resume score means nothing without knowing what it''s measuring. Here''s exactly what Resume Studio checks, and why.',
  $md$## Why a bare "score" isn't useful on its own

Plenty of resume tools give you a number out of 100 with no explanation of what moved it. That's not actionable — you can't fix "73" without knowing what's costing you those 27 points. Resume Studio was built around the opposite principle: every score is broken down into specific, fixable categories.

## What actually gets checked

- **ATS parseability** — can the layout, fonts, and structure be reliably extracted by an applicant tracking system, the way we cover in the [ATS Resume Guide](/blog/ats-resume-guide)
- **Quantified impact** — how many of your bullets include a concrete number or measurable outcome, versus vague responsibility statements
- **Keyword alignment** — when you attach a target job description, how well your resume's language matches the specific terms that posting uses
- **Structural consistency** — date formats, section ordering, and formatting consistency, the small things that read as carelessness when they're inconsistent
- **Section balance** — whether your strongest, most relevant material is positioned where a recruiter's six-second scan will actually see it

## Why it's grounded in your actual resume, not generic advice

Generic "resume tips" apply to nobody's specific resume perfectly. Resume Studio's suggestions are generated from your actual bullet points — if a bullet says "helped with backend development," the suggested rewrite is built from your project context, not a placeholder template phrase.

## Version history, and why it matters more than people expect

Most students end up with five slightly different resume files scattered across a laptop, unsure which one they sent to which company. Resume Studio keeps a version history tied to your account, so you can see exactly what changed between versions and roll back if a rewrite made something worse instead of better.

## Targeting a specific role

Paste in a job description, and the scoring shifts to weigh relevance against that specific posting — the same resume can score differently against a backend role versus a data analyst role, which reflects reality: a resume isn't universally "good," it's good for a specific application.

## What it won't do

Resume Studio won't fabricate experience or inflate claims you can't back up in an interview — the suggestions work within what you've actually done, rewriting for clarity and impact, not invention. A stronger-sounding but false bullet is a worse outcome than an honest, well-written true one.

## Getting the most out of it

Run your resume through once broadly, then again against a specific job description for a role you're actually applying to — the second pass is where the more useful, targeted feedback shows up.
$md$,
  (select id from blog_categories where slug = 'product'),
  (select id from blog_authors where slug = 'prophezy-team'),
  6,
  false,
  'published',
  now() - interval '4 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, author_id = excluded.author_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'how-resume-studio-scores-your-resume' and t.slug in ('product', 'resume-studio', 'resume', 'ats')
on conflict do nothing;

-- 24. Inside Research Lab
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_id, read_time_minutes, is_featured, status, published_at)
values (
  'inside-research-lab',
  'Inside Research Lab: Reading a Paper 10x Faster Without Skipping the Hard Parts',
  'Research Lab OCRs, summarizes, and lets you chat with your own papers — grounded in the actual text, not a generic summary of the topic.',
  $md$## Why reading papers is genuinely slow

A single research paper can take an hour or more to read carefully — dense methodology sections, unfamiliar notation, and citations that assume context you don't have yet. Multiply that by a literature review needing fifteen or twenty papers, and it's easily a week of work before you've written a single sentence of your own.

## What Research Lab actually does

Upload a paper (PDF, including scanned or image-based ones), and Research Lab extracts the full text via OCR, then generates a structured summary — methodology, key findings, and limitations — grounded specifically in that paper's content, not a generic summary of the general topic area.

## Chat with the paper itself

Beyond the summary, you can ask direct questions — "what dataset did they use," "how does this compare to the baseline they cite," "what's the sample size" — and get answers sourced from the actual extracted text, not the model's general knowledge about the field. If the paper doesn't address something, Research Lab says so rather than guessing.

## Citation extraction

Research Lab pulls out the paper's citations in a structured format, which matters most when you're building a literature review and need to trace which sources a paper builds on, without manually copying every reference by hand.

## Why grounding matters here specifically

Academic work has a higher accuracy bar than casual reading — misrepresenting a paper's methodology or findings in your own research isn't just unhelpful, it can be a real academic integrity problem. Research Lab is built to answer from the specific document you uploaded, which is why it's a research aid rather than a replacement for reading the paper — it gets you oriented fast, but you're still responsible for verifying anything you cite.

## A realistic workflow

Upload a paper, read the generated summary to decide if it's actually relevant to what you're researching (this alone saves the most time — filtering out papers that looked relevant from the abstract but aren't), then read the full paper yourself for anything you plan to cite directly, using the chat feature to clarify specific sections as you go.

## What it doesn't replace

Research Lab speeds up orientation and navigation through a paper — it doesn't replace the deep, careful reading required before you cite something as authoritative in your own work. Treat the summary as a map, not the territory.
$md$,
  (select id from blog_categories where slug = 'product'),
  (select id from blog_authors where slug = 'prophezy-team'),
  6,
  false,
  'published',
  now() - interval '6 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, author_id = excluded.author_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'inside-research-lab' and t.slug in ('product', 'research-lab', 'research')
on conflict do nothing;
