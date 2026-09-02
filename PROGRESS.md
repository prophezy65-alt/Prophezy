# Prophezy Build Log

## Module 1 — Foundation ✅ (2026-07-12)

- [x] Next.js 15 project scaffold (TS, Tailwind, App Router)
- [x] Design system: color/type tokens, dark+light mode, glass utilities
- [x] Signature components: Prophecy Ring, Dock nav
- [x] Base UI kit: Button, Card, Input, Badge, ThemeToggle
- [x] Supabase client/server/middleware setup
- [x] Full DB schema + RLS for all 19 tables across every module
- [x] Auth flow: sign up, log in, protected routes, auto-provisioning trigger
- [x] Dashboard shell wired to real profile/subscription data with empty states

## Module 2 — AI Study Hub (next)

- [ ] File upload UI (PDF/DOCX/PPT/Image/TXT) → Supabase Storage
- [ ] Text extraction + chunking pipeline
- [ ] Gemini embeddings → `document_chunks.embedding`
- [ ] RAG retrieval + generation for: notes, revision notes, one-day revision,
      flashcards, quiz, mind map, formula sheet, important/expected questions,
      MCQs, assignment, ELI-beginner, ELI-professor
- [ ] Generation viewer UI + export

## Backlog (in build order, subject to change)

3. Resume Hub (builder, ATS checker, cover letter, LinkedIn optimizer)
4. Flashcards (spaced repetition scheduler on top of Module 2's generation)
5. Placement Hub + Mock Interview
6. Project Hub
7. AI Research Hub (external source retrieval: arXiv, Semantic Scholar, OpenAlex)
8. Internship Hub
9. Productivity tools (attendance, CGPA, planner, Pomodoro, analytics)
10. Subscription/payment wiring (Razorpay) + Admin Panel
