-- Make client-content-raw bucket public (for signed URLs to work)
UPDATE storage.buckets SET public = true WHERE id = 'client-content-raw';

-- Add RLS policy for public read access to client-content-raw
CREATE POLICY "Public read access for client-content-raw"
ON storage.objects
FOR SELECT
USING (bucket_id = 'client-content-raw');