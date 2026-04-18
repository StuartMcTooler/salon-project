-- Create preview_pages table
CREATE TABLE public.preview_pages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  instagram_handle TEXT NOT NULL,
  tagline TEXT NOT NULL,
  website TEXT,
  bio TEXT,
  services JSONB NOT NULL DEFAULT '[]'::jsonb,
  photo_urls TEXT[] NOT NULL DEFAULT '{}'::text[],
  claimed_by_user_id UUID,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast handle lookup
CREATE INDEX idx_preview_pages_handle ON public.preview_pages(handle);

-- Validation trigger (per memory: triggers, not CHECK constraints)
CREATE OR REPLACE FUNCTION public.validate_preview_page()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Tagline length 1–80
  IF char_length(NEW.tagline) < 1 OR char_length(NEW.tagline) > 80 THEN
    RAISE EXCEPTION 'Tagline must be between 1 and 80 characters';
  END IF;

  -- Photos 3–6
  IF array_length(NEW.photo_urls, 1) IS NULL OR array_length(NEW.photo_urls, 1) < 3 OR array_length(NEW.photo_urls, 1) > 6 THEN
    RAISE EXCEPTION 'Preview pages must have between 3 and 6 photos';
  END IF;

  -- Services array length ≤ 10
  IF jsonb_typeof(NEW.services) != 'array' THEN
    RAISE EXCEPTION 'Services must be a JSON array';
  END IF;
  IF jsonb_array_length(NEW.services) > 10 THEN
    RAISE EXCEPTION 'Services list capped at 10 entries';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_preview_page_trigger
BEFORE INSERT OR UPDATE ON public.preview_pages
FOR EACH ROW
EXECUTE FUNCTION public.validate_preview_page();

-- Updated_at trigger
CREATE TRIGGER update_preview_pages_updated_at
BEFORE UPDATE ON public.preview_pages
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.preview_pages ENABLE ROW LEVEL SECURITY;

-- Public SELECT (preview pages are public marketing surfaces)
CREATE POLICY "Anyone can view preview pages"
ON public.preview_pages
FOR SELECT
USING (true);

-- Admin-only INSERT
CREATE POLICY "Admins can create preview pages"
ON public.preview_pages
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Admin-only UPDATE
CREATE POLICY "Admins can update preview pages"
ON public.preview_pages
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Admin-only DELETE
CREATE POLICY "Admins can delete preview pages"
ON public.preview_pages
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));