-- Adds the richer application_status values the Internship Discovery Engine
-- expects. Must be its own migration: Postgres forbids using a newly added
-- enum value in the same transaction that adds it.
alter type public.application_status add value if not exists 'interview_scheduled';
alter type public.application_status add value if not exists 'offer';
alter type public.application_status add value if not exists 'accepted';
alter type public.application_status add value if not exists 'withdrawn';