-- ================================================================
-- 004_storage_bucket.sql
-- Supabase Storage: pbc-files bucket + RLS policies
-- Run this in the Supabase SQL Editor (service_role context)
-- ================================================================

-- Create pbc-files storage bucket (50 MB per file limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pbc-files',
  'pbc-files',
  false,
  52428800,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'text/plain',
    'text/csv',
    'application/zip',
    'application/x-zip-compressed'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ================================================================
-- Storage RLS policies
-- Path structure: {firm_id}/{engagement_id}/{request_item_id}/{uuid}_{filename}
-- First folder = firm_id → scope all operations to the user's firm
-- ================================================================

-- Upload: only firm members can upload to their firm's folder
CREATE POLICY "pbc-files: firm members can upload"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'pbc-files'
    AND (storage.foldername(name))[1] = ((auth.jwt()->'user_metadata'->>'firm_id'))
  );

-- Read: only firm members can read their firm's files
CREATE POLICY "pbc-files: firm members can read"
  ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'pbc-files'
    AND (storage.foldername(name))[1] = ((auth.jwt()->'user_metadata'->>'firm_id'))
  );

-- Update: only firm members can update their firm's files
CREATE POLICY "pbc-files: firm members can update"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'pbc-files'
    AND (storage.foldername(name))[1] = ((auth.jwt()->'user_metadata'->>'firm_id'))
  );

-- Delete: only firm_admin/firm_staff can delete
CREATE POLICY "pbc-files: firm admins can delete"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'pbc-files'
    AND (storage.foldername(name))[1] = ((auth.jwt()->'user_metadata'->>'firm_id'))
    AND ((auth.jwt()->'user_metadata'->>'role') IN ('firm_admin', 'firm_staff', 'platform_admin'))
  );
