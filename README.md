# Prophezy — Foundation Module

The AI Operating System for Students. This is **Module 1: Foundation** — auth,
database schema, and the design system every later module builds on.

## Stack

Next.js 15 (App Router) · TypeScript · Tailwind CSS · Supabase (Auth, Postgres,
pgvector) · TanStack Query · React Hook Form + Zod · Framer Motion

## Setup

```bash
npm install
cp .env.local.example .env.local   # fill in your Supabase + Gemini keys
```

Run the schema against a fresh Supabase project:

```bash
npx supabase db push --db-url <your-connection-string>
# or paste supabase/migrations/0001_init.sql into the SQL editor
```

Then:

```bash
npm run dev
```

Visit `http://localhost:3000` — sign up, and you'll land on `/dashboard`.

## What's built

- **Auth** — email/password sign up + login via Supabase, session refresh in
  middleware, protected routes (`/dashboard/*` redirects to `/login` when
  signed out; `/login` and `/signup` redirect to `/dashboard` when signed in).
- **Schema** (`supabase/migrations/0001_init.sql`) — `profiles`,
  `subscriptions`, `feature_flags`, plus one table per product module
  (uploads, generations, flashcards, resumes, projects, research, internships,
  bookmarks, activity, notifications, study sessions, analytics, settings),
  fully indexed with row-level security so every table is scoped to its owner.
  A trigger provisions a `profiles` + free `subscriptions` row the moment
  someone signs up.
- **Design system** — see `app/globals.css` and `tailwind.config.ts` for the
  full token set, and the notes below.
- **Dashboard shell** — the floating Dock nav (left rail on desktop, bottom
  bar on mobile) and an overview page wired to real Supabase data, showing
  empty states for modules that haven't been built yet.

## Design system

- **Palette** — Void (`#0B0E1A`-ish deep navy) and Surface for the dark-mode
  canvas, Paper for light mode, two accents: **Signal** (electric violet —
  "the AI is thinking") and **Pulse** (warm amber — "achievement"). Defined as
  HSL CSS variables in `app/globals.css` so light/dark just swaps a class.
- **Type** — Space Grotesk (display), Inter (body), JetBrains Mono (scores,
  stats, countdowns) — loaded via `next/font/google` in `app/layout.tsx`.
- **Signature element: the Prophecy Ring** (`components/ui/prophecy-ring.tsx`)
  — a radial arc gauge that every score/prediction in the product reuses: ATS
  score, viva confidence, research novelty, CGPA, streaks. One shape, one
  learned interaction, everywhere.
- **Layout signature: the Dock** (`components/ui/dock.tsx`) — a floating
  glass nav rail, playing on the "operating system" idea rather than a
  conventional sidebar.
- Glass surfaces are applied sparingly (`.glass` / `.glass-panel` utility
  classes) — cards and the dock, not every element, to keep the effect
  meaningful rather than decorative.

## Next module

**AI Study Hub** — upload → RAG (Gemini embeddings + `document_chunks` /
pgvector, already in the schema) → notes / flashcards / quizzes / mind maps.
