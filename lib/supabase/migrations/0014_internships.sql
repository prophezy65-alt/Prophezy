-- ============================================================================
-- PROPHEZY — 0014_internships.sql
-- Purpose : Internship Hub — listings + per-user applications.
-- Depends : 0002_enums.sql, 0003_profiles.sql
-- ============================================================================

create table public.internships (
  id           uuid primary key default gen_random_uuid(),
  company_name text not null,
  role_title   text not null,
  description  text,
  location     text,
  type         public.internship_type not null default 'internship',
  stipend      text,
  apply_url    text not null,
  source       text,
  posted_at    date not null default current_date,
  deadline_at  date,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.internship_applications (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles (id) on delete cascade,
  internship_id uuid not null references public.internships (id) on delete cascade,
  status        public.application_status not null default 'saved',
  notes         text,
  applied_at    timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (user_id, internship_id)
);
