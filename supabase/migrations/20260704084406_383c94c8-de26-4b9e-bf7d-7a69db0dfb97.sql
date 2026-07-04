
DROP POLICY IF EXISTS "Public read access for client-content-raw" ON storage.objects;
DROP POLICY IF EXISTS "Creatives can read own client content raw" ON storage.objects;
DROP POLICY IF EXISTS "Business owners can read client content raw" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated staff can upload client content raw" ON storage.objects;
DROP POLICY IF EXISTS "Creatives can delete own client content raw" ON storage.objects;

CREATE POLICY "Creatives can read own client content raw"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'client-content-raw'
  AND EXISTS (
    SELECT 1 FROM public.client_content cc
    JOIN public.staff_members sm ON sm.id = cc.creative_id
    WHERE sm.user_id = auth.uid()
      AND (cc.raw_file_path = storage.objects.name
           OR cc.enhanced_file_path = storage.objects.name)
  )
);

CREATE POLICY "Business owners can read client content raw"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'client-content-raw'
  AND EXISTS (
    SELECT 1 FROM public.client_content cc
    JOIN public.staff_members sm ON sm.id = cc.creative_id
    JOIN public.business_accounts ba ON ba.id = sm.business_id
    WHERE ba.owner_user_id = auth.uid()
      AND (cc.raw_file_path = storage.objects.name
           OR cc.enhanced_file_path = storage.objects.name)
  )
);

CREATE POLICY "Authenticated staff can upload client content raw"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'client-content-raw'
  AND EXISTS (SELECT 1 FROM public.staff_members sm WHERE sm.user_id = auth.uid())
);

CREATE POLICY "Creatives can delete own client content raw"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'client-content-raw'
  AND EXISTS (
    SELECT 1 FROM public.client_content cc
    JOIN public.staff_members sm ON sm.id = cc.creative_id
    WHERE sm.user_id = auth.uid()
      AND (cc.raw_file_path = storage.objects.name
           OR cc.enhanced_file_path = storage.objects.name)
  )
);
