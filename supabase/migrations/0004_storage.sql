-- ============================================================================
-- PROPHEZY — 0004_storage.sql
-- Purpose : Storage buckets used across the platform. Access policies on
--           storage.objects are created later in 0019_rls.sql, once every
--           table those policies join against (profiles, uploads, resumes)
--           already exists.
-- Depends : none (storage.buckets is a built-in Supabase table)
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/png', 'image/jpeg', 'image/webp']),
  ('uploads', 'uploads', false, 52428800, array[
     'application/pdf',
     'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
     'image/png', 'image/jpeg'
   ]),
  ('resumes', 'resumes', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;
