-- Create banner-images storage bucket for banner file uploads

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('banner-images', 'banner-images', true, 5242880, ARRAY['image/jpeg','image/jpg','image/png','image/webp','image/gif'])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Allow anon to upload banner images
DROP POLICY IF EXISTS "anon can upload banner images" ON storage.objects;
CREATE POLICY "anon can upload banner images" ON storage.objects
  FOR INSERT TO anon
  WITH CHECK (bucket_id = 'banner-images');

-- Allow public read on banner images
DROP POLICY IF EXISTS "public can read banner images" ON storage.objects;
CREATE POLICY "public can read banner images" ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'banner-images');

-- Allow anon to delete banner images
DROP POLICY IF EXISTS "anon can delete banner images" ON storage.objects;
CREATE POLICY "anon can delete banner images" ON storage.objects
  FOR DELETE TO anon
  USING (bucket_id = 'banner-images');
