-- Fix public_bucket_allows_listing warning
-- Public buckets serve objects via direct URLs without RLS policies.
-- The SELECT policy on storage.objects is what enables listing.
-- Removing it fixes the warning while keeping URL-based access working.

DROP POLICY IF EXISTS "public can read banner images" ON storage.objects;
