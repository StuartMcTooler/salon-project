import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface SignedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  bucket: string;
  path: string;
  expiresIn?: number;
}

/**
 * Renders an image from a private Supabase Storage bucket using a signed URL.
 * Refreshes the URL when path/bucket changes.
 */
export function SignedImage({ bucket, path, expiresIn = 3600, alt = "", ...rest }: SignedImageProps) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!path) {
      setUrl(null);
      return;
    }
    supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn)
      .then(({ data }) => {
        if (!cancelled) setUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [bucket, path, expiresIn]);

  if (!url) return null;
  return <img src={url} alt={alt} {...rest} />;
}
