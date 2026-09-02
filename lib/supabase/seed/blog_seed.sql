-- Seed data for the Prophezy blog. Run AFTER 20260807_blog_schema.sql.
-- Safe to re-run: categories/tags upsert on slug, posts upsert on slug.

insert into blog_categories (slug, name, description) values
  ('internships', 'Internships', 'Finding and landing internships as a student.'),
  ('resumes', 'Resumes', 'Resume writing, ATS optimization, and formatting.'),
  ('learning-roadmaps', 'Learning Roadmaps', 'Structured paths for learning technical skills.'),
  ('interviews', 'Interviews', 'Interview preparation across technical and behavioral rounds.'),
  ('open-source', 'Open Source', 'Contributing to open source and building a public portfolio.'),
  ('career-trends', 'Career Trends', 'Where the job market and AI industry are heading.'),
  ('ai-tools', 'AI Tools', 'Using AI tools effectively as a student and early-career builder.')
on conflict (slug) do update set name = excluded.name, description = excluded.description;

insert into blog_tags (slug, name) values
  ('internships', 'Internships'),
  ('resume', 'Resume'),
  ('ats', 'ATS'),
  ('roadmap', 'Roadmap'),
  ('machine-learning', 'Machine Learning'),
  ('prompt-engineering', 'Prompt Engineering'),
  ('github', 'GitHub'),
  ('open-source', 'Open Source'),
  ('interviews', 'Interviews'),
  ('career-trends', 'Career Trends'),
  ('ai', 'AI')
on conflict (slug) do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- 1. How to Land Your First AI Internship
-- ─────────────────────────────────────────────────────────────────────────
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_name, read_time_minutes, is_featured, status, published_at)
values (
  'how-to-land-your-first-ai-internship',
  'How to Land Your First AI Internship',
  'Most students apply to AI internships with a resume built for a different job. Here''s what actually gets you shortlisted.',
  $md$## Start with what "AI internship" actually means

Job titles like "AI Intern" or "ML Intern" cover a huge range of work — data labeling and evaluation, prompt engineering for a product feature, training small models, or building the infrastructure around a larger model. Before you apply anywhere, read the job description twice and figure out which of these it actually is. A resume built for "I fine-tuned a model" reads as irrelevant to a role that's really about data pipelines.

## The three things recruiters actually check first

1. **Do you have a working project they can open right now?** Not a slide deck — a GitHub repo with a README that runs.
2. **Does your coursework or project list match the stack in the posting?** If they mention PyTorch, and your resume only says TensorFlow, that's a five-second reason to move on.
3. **Is there any evidence you've shipped something end to end?** A Kaggle notebook shows you can model. A deployed project shows you can ship. Both matter, but the second is rarer.

## Build one project that does all three

You don't need five half-finished projects. You need one that's actually finished: a small, real problem, a working model, and a simple interface someone else can use without reading your code. Write the README as if a recruiter with 90 seconds will read it — what it does, what you used, and one number that shows it works (accuracy, latency, cost saved).

## Where to actually look

- **Company career pages directly** — less competition than aggregator sites, and you can see if the team is actively hiring versus a stale posting.
- **Professor and lab postings** — many AI research assistant roles never make it to public job boards.
- **Open-source maintainers** — contributing to a project used by a company you want to intern at is a slower but very effective path; some internships come from a maintainer noticing your PRs.

## Applying without wasting your shot

Tailor the first line of your resume summary to the specific team, not the company. "Interested in AI" tells them nothing. "Built a document-classification pipeline with 92% F1 on a 10k-sample dataset" tells them exactly what you can do on day one.

Track every application — company, role, date, and status — so you know when to follow up. A short, polite follow-up after two weeks is normal and often the difference between "no response" and "let's talk."

## What actually disqualifies people

Not lack of experience — almost nobody has real experience at this stage. What disqualifies people is a resume that doesn't match the role, no visible project, or generic cover letters that could apply to any company. Fix those three things before you fix anything else.
$md$,
  (select id from blog_categories where slug = 'internships'),
  'Prophezy Team',
  7,
  true,
  'published',
  now() - interval '28 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'how-to-land-your-first-ai-internship' and t.slug in ('internships', 'ai')
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- 2. The Complete AI Roadmap
-- ─────────────────────────────────────────────────────────────────────────
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_name, read_time_minutes, is_featured, status, published_at)
values (
  'complete-ai-roadmap',
  'The Complete AI Roadmap for Students',
  'A realistic, ordered path from zero to job-ready in AI — what to learn, in what order, and what to skip.',
  $md$## Why order matters more than volume

Most AI roadmaps you find online list forty topics with no sequence. You end up bouncing between a deep learning course and a linear algebra refresher and never finish either. This roadmap is ordered on purpose — each stage assumes the one before it.

## Stage 1: Python and data handling (2–4 weeks)

You need to be fluent, not just familiar. That means comfortable with NumPy array operations, pandas for data cleaning, and reading a stack trace without panicking. Skip the "20 hours of Python basics" courses if you already write code — jump straight to a data-manipulation project using a real, messy dataset.

## Stage 2: Statistics and linear algebra, applied (2–3 weeks)

You don't need a full semester of proofs. You need: matrix multiplication and why it matters for neural networks, gradient descent intuition, probability distributions, and what overfitting actually looks like on a loss curve. Learn each concept alongside code that demonstrates it, not in isolation.

## Stage 3: Classical machine learning (3–4 weeks)

Regression, classification, decision trees, and ensemble methods (random forests, gradient boosting) using scikit-learn. This stage matters more than people think — a huge share of real-world "AI" work is still classical ML on tabular data, not deep learning.

## Stage 4: Deep learning fundamentals (4–6 weeks)

Neural network basics, backpropagation intuition, CNNs for images, and a first look at transformers. Build with PyTorch, not just tutorials — implement a small image classifier and a small text classifier yourself, from a dataset to a working model.

## Stage 5: Specialize (4+ weeks, ongoing)

Pick one direction based on what you actually enjoyed in stage 4:

- **NLP / LLMs** — tokenization, embeddings, fine-tuning, and prompt engineering
- **Computer vision** — object detection, segmentation, image generation
- **MLOps** — deployment, monitoring, and the infrastructure around models

## Stage 6: Ship something real

Everything above is preparation. The stage that actually gets you hired is building one project that solves a real (even small) problem, deploying it somewhere reachable, and writing about what you learned. A working demo beats a certificate every time.

## What to skip

Skip chasing every new paper or framework release. Skip course-hopping between five different "complete AI bootcamps" that cover the same fundamentals differently. Depth on the fundamentals above will take you further than breadth across trends.
$md$,
  (select id from blog_categories where slug = 'learning-roadmaps'),
  'Prophezy Team',
  9,
  false,
  'published',
  now() - interval '24 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'complete-ai-roadmap' and t.slug in ('roadmap', 'machine-learning', 'ai')
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- 3. Resume Mistakes Students Make
-- ─────────────────────────────────────────────────────────────────────────
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_name, read_time_minutes, is_featured, status, published_at)
values (
  'resume-mistakes-students-make',
  'Resume Mistakes Students Make (and How to Fix Them)',
  'The same handful of mistakes show up on almost every student resume. None of them are hard to fix once you can see them.',
  $md$## Listing responsibilities instead of results

"Worked on the front-end team" tells a recruiter nothing about what you actually did. "Rebuilt the checkout flow, cutting page load time by 40%" tells them exactly what you're capable of. Every bullet point should answer: what changed because you did this?

## Burying the one thing that matters

If you have one strong project or internship, don't let it sit as the fourth bullet under a bigger, less relevant section. Recruiters scan in seconds — put your strongest, most relevant work where it will actually be seen first.

## Using a template that breaks ATS parsing

Multi-column layouts, text inside tables, and graphics-heavy templates often parse incorrectly (or not at all) in applicant tracking systems. A recruiter never sees the version you designed — they see whatever garbled text the parser extracted. Single-column, standard section headers, and no embedded graphics is the safer default.

## Writing a skills section that's just a word cloud

Listing every technology you've ever touched, with no signal of depth, reads as noise. A recruiter can't tell the difference between "used once in a tutorial" and "used in three real projects." Group skills by proficiency, or better, let your project bullets demonstrate the skill instead of just naming it twice.

## No quantifiable proof of impact

Numbers are what make a claim checkable. "Improved performance" is a claim. "Reduced query time from 800ms to 120ms" is evidence. If you genuinely don't have a number, describe the before/after state concretely instead — scale, scope, or user count still work.

## One resume for every job

The single biggest mistake: sending the exact same resume to a backend role and a data science role. Two or three tailored versions, each emphasizing the relevant projects and skills first, consistently outperform one generic version — even with identical underlying experience.

## Typos and inconsistent formatting

This one sounds obvious, but it's the fastest way to lose a maybe. Inconsistent date formats, mismatched bullet styles, or a stray typo signal carelessness before a recruiter has read a single line about your actual work. Read it out loud before you send it — you'll catch things your eyes skip over.
$md$,
  (select id from blog_categories where slug = 'resumes'),
  'Prophezy Team',
  6,
  false,
  'published',
  now() - interval '20 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'resume-mistakes-students-make' and t.slug in ('resume', 'ats')
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- 4. ATS Resume Guide
-- ─────────────────────────────────────────────────────────────────────────
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_name, read_time_minutes, is_featured, status, published_at)
values (
  'ats-resume-guide',
  'The ATS Resume Guide: What Actually Gets Parsed Correctly',
  'Applicant tracking systems reject well-qualified candidates over formatting, not content. Here''s what to check before you submit.',
  $md$## What an ATS actually does

An applicant tracking system parses your resume into structured fields — name, contact info, work history, education, skills — and often scores or ranks it against the job description before a human ever opens it. It is not intelligent about design. It's extracting text, and anything it can't extract cleanly gets dropped or garbled.

## File format

Submit a `.docx` or a text-based PDF, never a scanned image or a PDF exported from a design tool that flattens text into paths. If you can't select and copy the text from your own PDF, an ATS probably can't read it either.

## Layout rules that matter

- **Single column, always.** Multi-column layouts are frequently read left-to-right across columns, scrambling the order of your content.
- **No tables for layout.** Content inside table cells is often skipped entirely or read out of order.
- **No text inside images or icons.** If your phone number is part of a graphic, it may not be extracted at all.
- **Standard section headers.** "Work Experience," "Education," "Skills" — not creative alternatives like "My Journey." Some parsers map content to fields based on these exact headers.

## Keyword matching, without keyword stuffing

Many systems score resumes against keywords pulled directly from the job description. Read the posting and mirror its language where it's true — if they say "REST APIs" and you built one, say "REST APIs," not just "backend development." But don't paste in skills you can't back up in an interview; a human reads it eventually.

## Dates and formatting consistency

Use one consistent date format throughout (e.g., "Jan 2024 – May 2024"), and don't leave unexplained gaps that could be misread as a parsing error rather than a real gap.

## Test it yourself

Copy your resume's text out of the PDF and paste it into a plain text file. If the sentence order is scrambled, sections are merged, or bullet points are missing, that's roughly what an ATS is seeing too. Fix the layout until this test comes out clean — that's a stronger signal than any "ATS score" tool.

## The part people get wrong

Optimizing for ATS parsing is not the same as writing a good resume. Passing the parser gets you to a human reviewer — it doesn't replace strong, specific, results-oriented content. Do both: a clean, parseable format, and bullets that actually demonstrate impact.
$md$,
  (select id from blog_categories where slug = 'resumes'),
  'Prophezy Team',
  6,
  false,
  'published',
  now() - interval '17 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'ats-resume-guide' and t.slug in ('resume', 'ats')
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- 5. Prompt Engineering for Students
-- ─────────────────────────────────────────────────────────────────────────
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_name, read_time_minutes, is_featured, status, published_at)
values (
  'prompt-engineering-for-students',
  'Prompt Engineering: A Practical Guide for Students',
  'Prompt engineering is a real, learnable skill — not just typing questions into a chatbot. Here''s what actually improves output quality.',
  $md$## It's not about "the right words"

Prompt engineering isn't a secret set of phrases. It's about giving a model enough of the right context and constraints that it can't reasonably produce a bad answer. Most disappointing outputs come from underspecified prompts, not from the model being incapable.

## Be specific about the output, not just the task

"Summarize this paper" produces a generic summary. "Summarize this paper in 150 words, focused on the methodology and limitations, for someone who already understands the field" produces something usable. Specify length, format, audience, and focus.

## Give the model the material, not just the question

If you're asking about a specific document, dataset, or codebase, include the relevant content directly in the prompt rather than describing it from memory. Models answer far more accurately when grounded in the actual source than when relying on a paraphrase of it.

## Break complex tasks into steps

Asking for a fully-formed research plan, literature review, and analysis in one prompt tends to produce shallow output on all three. Ask for one step, review it, then build the next step on top of a result you've already checked.

## Ask for reasoning before the answer, when it matters

For anything involving multi-step logic — debugging code, working through a proof, planning a project — asking the model to reason through the problem before giving a final answer noticeably improves accuracy over asking for the answer directly.

## Iterate like you would with a first draft

Your first prompt rarely produces your final output. Treat the first response as a draft: point out specifically what's wrong or missing, rather than restarting from scratch. "Make the second paragraph more concise and cite the actual figures from the source" works better than "make it better."

## Know what not to hand off

Prompt engineering makes you faster at drafting, summarizing, and exploring — it doesn't replace understanding the material yourself. If you can't evaluate whether the output is actually correct, you can't reliably use it, especially in academic work where you're still responsible for what you submit.

## A habit worth building

Keep a short list of prompts that worked well for recurring tasks — literature summaries, code review, resume bullet rewrites. Reusing and refining a known-good prompt beats reinventing one every time.
$md$,
  (select id from blog_categories where slug = 'ai-tools'),
  'Prophezy Team',
  6,
  false,
  'published',
  now() - interval '14 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'prompt-engineering-for-students' and t.slug in ('prompt-engineering', 'ai')
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- 6. Machine Learning Roadmap
-- ─────────────────────────────────────────────────────────────────────────
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_name, read_time_minutes, is_featured, status, published_at)
values (
  'machine-learning-roadmap',
  'A Focused Machine Learning Roadmap (Not the AI Roadmap)',
  'Machine learning and "AI" aren''t the same roadmap. If your goal is specifically ML engineering, here''s the more focused path.',
  $md$## How this differs from a general AI roadmap

A general AI roadmap covers everything from classical ML to LLMs to computer vision. If your specific goal is a machine learning engineer role — not research, not prompt engineering — you can move faster by narrowing scope early. This roadmap assumes that goal.

## Foundation: math you'll actually use

You need working intuition for linear algebra (vectors, matrices, eigenvalues), calculus (derivatives and gradients), and probability (distributions, Bayes' theorem, expectation). You do not need to prove theorems — you need to read a paper's methods section and understand what's happening.

## Core ML: the models that show up everywhere

Linear and logistic regression, decision trees, random forests, gradient boosting (XGBoost/LightGBM), and k-means clustering. Learn these with scikit-learn on real, messy datasets — Kaggle competitions are a genuinely good way to practice this stage because the data is never clean.

## Model evaluation, properly

This is the stage most self-taught learners skip and regret. Cross-validation, precision/recall/F1 versus accuracy, ROC curves, and understanding when a model is overfitting versus genuinely good. A model with 99% accuracy on imbalanced data can be worse than a model with 85% — know why.

## Feature engineering

Often more impactful than model choice. Handling missing data, encoding categorical variables correctly, scaling, and creating derived features from domain knowledge. This is where a lot of real-world ML work actually happens.

## Deep learning, only as far as your goal requires

If you're targeting ML engineering roles that involve neural networks, learn PyTorch fundamentals, training loops, and how to debug a model that isn't learning (loss not decreasing, exploding gradients, data leakage). If your target roles are more tabular/classical-ML-heavy, you can go lighter here.

## Deployment and production concerns

Model serving, versioning, monitoring for data drift, and the difference between a notebook that works once and a pipeline that works reliably. This is the single most under-taught skill relative to how often it's actually needed on the job.

## Build a portfolio around one real dataset

Pick a dataset connected to a domain you understand — sports, finance, a hobby — and take it from raw data to a deployed, explainable model. Depth on one project beats five shallow Kaggle submissions when a hiring manager is deciding who to interview.
$md$,
  (select id from blog_categories where slug = 'learning-roadmaps'),
  'Prophezy Team',
  8,
  false,
  'published',
  now() - interval '11 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'machine-learning-roadmap' and t.slug in ('machine-learning', 'roadmap')
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- 7. GitHub Portfolio Guide
-- ─────────────────────────────────────────────────────────────────────────
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_name, read_time_minutes, is_featured, status, published_at)
values (
  'github-portfolio-guide',
  'Building a GitHub Portfolio That Actually Gets Read',
  'A profile with fifty tutorial clones doesn''t help you. Here''s how to build a GitHub presence recruiters actually stop on.',
  $md$## Recruiters spend less time on your GitHub than you think

Most reviewers give a GitHub profile 30–60 seconds unless something catches their attention. That means your top few pinned repos and their README quality matter far more than your total repo count or contribution streak.

## Pin four to six repos, not forty

Go to your profile settings and pin your strongest, most relevant work. A stranger should be able to look at your pinned repos and immediately understand what kind of engineer you are — not scroll through every tutorial you've ever followed along with.

## The README is the actual portfolio piece

For each pinned project, write a README that includes: what the project does and why, a screenshot or short demo GIF if it's visual, how to run it locally, and what you'd improve with more time. That last part matters more than people expect — it shows self-awareness, not just output.

## Commit history tells a story, whether you mean it to or not

A single "final commit" with the entire project dumped in one go looks different from a commit history showing iterative development. You don't need to fake incremental commits, but do commit as you actually build, rather than squashing everything into one push at the end.

## Delete or archive dead weight

Half-finished tutorial clones, forked repos with no changes, and abandoned experiments dilute your profile. Archive them or make them private. A shorter, curated list of real work outperforms a long list padded with noise.

## Contribute to real projects, not just your own

A merged pull request to an active open-source project — even a small one, like fixing a bug or improving documentation — is strong signal. It shows you can read someone else's codebase, follow their conventions, and get changes accepted by other engineers, which is closer to real job conditions than solo projects.

## Write commit messages like someone else has to understand them

"fix stuff" and "wip" repeated forty times signals rushed, undocumented work. Clear, specific commit messages are a small habit that compounds into a much more professional-looking history.

## One thing to avoid

Don't fabricate contribution activity or inflate a project's scope in the README. Recruiters and interviewers who care enough to look will often ask you to walk through the code — and a mismatch between the README's claims and what you can actually explain is worse than a smaller, honest project.
$md$,
  (select id from blog_categories where slug = 'open-source'),
  'Prophezy Team',
  6,
  false,
  'published',
  now() - interval '8 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'github-portfolio-guide' and t.slug in ('github', 'open-source')
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- 8. Open Source for Students
-- ─────────────────────────────────────────────────────────────────────────
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_name, read_time_minutes, is_featured, status, published_at)
values (
  'open-source-for-students',
  'Why Open Source Is Underrated as a Student Career Strategy',
  'Open source contributions are one of the few things on a resume that let you prove real engineering judgment before you have a job.',
  $md$## Why this matters more than another side project

Anyone can build a project alone with no feedback and no constraints. Contributing to an existing open-source project means working inside someone else's codebase, conventions, and review process — closer to what an actual engineering job looks like than most solo projects ever get.

## Where to start, realistically

Don't start by trying to fix a hard, unassigned bug in a massive project. Start with:

- Issues explicitly labeled "good first issue" or "help wanted"
- Documentation fixes — genuinely valuable, genuinely lower-stakes to get merged
- Small, well-scoped bugs in projects you already use and understand as a user

## Read before you write

Before opening a pull request, read the project's `CONTRIBUTING.md`, recent merged PRs, and how maintainers respond to new contributors. This tells you their standards and saves you from a PR that gets rejected for avoidable reasons — wrong branch, missing tests, wrong code style.

## A small, well-explained PR beats a large, vague one

Keep your first contributions narrowly scoped. A PR that does one clear thing, explained clearly in the description, with a linked issue, gets reviewed and merged far faster than a large PR touching many files with no explanation.

## Handling review feedback

Maintainers will ask for changes — that's normal, not a rejection. Respond to feedback promptly and without defensiveness. How you handle code review is itself a skill employers care about, and maintainers notice contributors who iterate well.

## What it actually does for your career

- Gives you a public, verifiable track record of real code accepted by other engineers
- Gives you specific, honest talking points for interviews ("I found this bug, here's how I diagnosed it, here's the fix")
- Occasionally leads directly to opportunities — some companies hire out of their own open-source communities

## Consistency over intensity

A steady cadence of small contributions over months is more valuable — and more sustainable alongside coursework — than a single intense week before an application deadline. Pick one or two projects you genuinely use and stick with them; familiarity with the codebase compounds over time.
$md$,
  (select id from blog_categories where slug = 'open-source'),
  'Prophezy Team',
  6,
  false,
  'published',
  now() - interval '6 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'open-source-for-students' and t.slug in ('open-source', 'github')
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- 9. AI Interview Preparation
-- ─────────────────────────────────────────────────────────────────────────
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_name, read_time_minutes, is_featured, status, published_at)
values (
  'ai-interview-preparation',
  'Preparing for AI and ML Interviews: What to Actually Practice',
  'AI interviews test a specific, learnable mix of skills. Here''s where to spend your limited prep time.',
  $md$## The four things AI/ML interviews actually test

Most AI and ML interview loops, across companies, test some combination of: coding fundamentals, ML theory and intuition, applied problem-solving with a dataset, and communication about trade-offs. Weak prep usually over-indexes on one of these and ignores the rest.

## Coding: don't skip this because it's "not AI"

A meaningful share of ML interviews still include general data structures and algorithms questions, because the job involves writing production code, not just training models. Keep your fundamentals sharp — arrays, hash maps, trees, basic dynamic programming — even if your target role is research-adjacent.

## ML theory: intuition over memorized definitions

You'll likely be asked to explain concepts like bias-variance trade-off, regularization, or why a particular loss function is used for a particular problem. Interviewers are listening for whether you understand *why*, not whether you can recite a textbook definition. Practice explaining concepts out loud, not just reading about them.

## The applied round: think out loud

Given a dataset or a vague problem statement ("how would you detect fraudulent transactions?"), interviewers want to see your process: how you'd explore the data, what features you'd consider, how you'd evaluate the model, and what could go wrong. A structured, narrated approach beats jumping straight to "I'd use XGBoost."

## System design for ML

For more senior or applied roles, expect questions about deploying and maintaining a model in production — how you'd monitor for data drift, handle retraining, and manage latency versus accuracy trade-offs. This is a distinct skill from model-building and is worth practicing separately.

## Behavioral questions still matter

"Tell me about a time a project didn't work as expected" comes up constantly in ML interviews specifically, because failure and iteration are core to the actual job. Prepare two or three real stories — including ones where your first approach didn't work — rather than only success stories.

## How to prepare with limited time

If you have two weeks: spend roughly a third on coding practice, a third on explaining ML concepts out loud (to yourself or a friend), and a third on one or two applied case-study walkthroughs. Depth on a smaller set of well-understood topics outperforms shallow coverage of everything.

## The mistake that costs people the most

Treating an ML interview like a pure coding interview, or a pure theory quiz — not the mix it actually is. Practice moving fluidly between "here's the code," "here's why this approach," and "here's what I'd watch out for in production."
$md$,
  (select id from blog_categories where slug = 'interviews'),
  'Prophezy Team',
  7,
  false,
  'published',
  now() - interval '4 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'ai-interview-preparation' and t.slug in ('interviews', 'machine-learning')
on conflict do nothing;

-- ─────────────────────────────────────────────────────────────────────────
-- 10. Future of AI Careers
-- ─────────────────────────────────────────────────────────────────────────
insert into blog_posts (slug, title, excerpt, content_markdown, category_id, author_name, read_time_minutes, is_featured, status, published_at)
values (
  'future-of-ai-careers',
  'Where AI Careers Are Actually Heading',
  'Beyond the hype cycle, a few clear, durable shifts are shaping what AI-adjacent jobs look like for the next generation entering the field.',
  $md$## The shift from "build models" to "build with models"

A shrinking share of AI jobs involve training models from scratch; a growing share involve building products and systems on top of existing foundation models — integration, evaluation, safety tuning, and application-layer engineering. Students optimizing purely for "I can train a neural network" are optimizing for a smaller slice of the market than they think.

## Evaluation is becoming its own discipline

As more products ship AI features, "does this actually work reliably" has become a real, specialized skill — designing test sets, measuring hallucination rates, and catching regressions before users do. This is a genuinely good entry point for students who are strong on rigor and communication, not just modeling.

## Domain expertise plus AI fluency beats AI expertise alone

The most in-demand profile increasingly isn't "pure AI generalist" — it's someone with real depth in a domain (finance, healthcare, law, biology) who is also fluent enough in AI tooling to apply it there. If you have a specific domain interest, pairing it with applied AI skills is often a stronger, less crowded path than competing purely as an ML generalist.

## Smaller teams, higher leverage per engineer

AI tooling is compressing the amount of scaffolding work needed to ship a feature, which means smaller teams are shipping more. That raises the bar for what a single engineer or intern is expected to own — end-to-end ownership is becoming the norm earlier in people's careers, not something you wait years to earn.

## The "prompt engineer" job title is already narrowing

Standalone prompt-engineering roles, as a distinct job title, are becoming less common as the skill becomes an expected baseline competency across many roles rather than a job in itself. That doesn't mean the skill matters less — it means it's increasingly assumed, not a differentiator on its own.

## What stays durable regardless of the trend cycle

Strong fundamentals — data structures, statistics, clear communication, and the ability to actually ship and maintain something in production — remain the most durable investment. Tools and frameworks will keep changing quickly; the underlying engineering judgment transfers across all of them.

## What this means if you're still deciding what to focus on

Don't try to predict the exact next trend. Build genuine depth in fundamentals, get real experience shipping something end to end, and stay curious about new tools as they emerge rather than betting your entire preparation on any single one of them.
$md$,
  (select id from blog_categories where slug = 'career-trends'),
  'Prophezy Team',
  7,
  false,
  'published',
  now() - interval '2 days'
)
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content_markdown = excluded.content_markdown,
  category_id = excluded.category_id, read_time_minutes = excluded.read_time_minutes,
  is_featured = excluded.is_featured, status = excluded.status, published_at = excluded.published_at;

insert into blog_post_tags (post_id, tag_id)
select p.id, t.id from blog_posts p, blog_tags t
where p.slug = 'future-of-ai-careers' and t.slug in ('career-trends', 'ai')
on conflict do nothing;
