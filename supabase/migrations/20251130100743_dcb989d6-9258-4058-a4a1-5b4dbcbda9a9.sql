-- Create profile-images storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-images', 'profile-images', true);

-- RLS policies for profile-images bucket
CREATE POLICY "Authenticated users can upload profile images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profile-images');

CREATE POLICY "Public can view profile images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'profile-images');

CREATE POLICY "Users can update their own profile images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'profile-images');

CREATE POLICY "Users can delete their own profile images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'profile-images');

-- Add content_origin column to client_content
ALTER TABLE client_content 
ADD COLUMN content_origin TEXT DEFAULT 'manual_upload';

-- Update existing records based on source
UPDATE client_content 
SET content_origin = 'booking' 
WHERE appointment_id IS NOT NULL;

UPDATE client_content 
SET content_origin = 'content_request' 
WHERE request_id IS NOT NULL AND appointment_id IS NULL;