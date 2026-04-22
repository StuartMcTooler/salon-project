// Server-rendered OG meta tags for /preview/{handle}.
// Crawler-only backend; Cloudflare Worker (separate infra) handles UA-sniffing
// in front of bookd.ie and forwards crawler requests here.
//
// Always returns 200 + text/html. Never 404 — broken DM previews look terrible.
// No meta-refresh: the Worker handles human/crawler routing.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SITE_BASE = "https://bookd.ie";
const FALLBACK_IMAGE = `${SITE_BASE}/og-default.png`;

const FALLBACK_HTML_FIELDS = {
  title: "Bookd — premium booking pages",
  description:
    "Booking pages built for independent barbers and creatives.",
  image: FALLBACK_IMAGE,
  imageAlt: "Bookd — premium booking pages",
  url: SITE_BASE,
  bodyHeading: "Bookd",
  bodyTagline: "Premium booking pages for independent creatives.",
};

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHeroImageUrl(rawUrl: string): string {
  // Supabase Storage public URL pattern:
  //   https://<ref>.supabase.co/storage/v1/object/public/<bucket>/<path>
  // Image transforms require the /render/image/public/ path:
  //   https://<ref>.supabase.co/storage/v1/render/image/public/<bucket>/<path>?width=...
  let url = rawUrl;
  if (url.includes("/storage/v1/object/public/")) {
    url = url.replace(
      "/storage/v1/object/public/",
      "/storage/v1/render/image/public/",
    );
  }
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}width=1200&height=630&resize=cover`;
}

function renderHtml(fields: {
  title: string;
  description: string;
  image: string;
  imageAlt: string;
  url: string;
  bodyHeading: string;
  bodyTagline: string;
}): string {
  const t = escapeHtml(fields.title);
  const d = escapeHtml(fields.description);
  const img = escapeHtml(fields.image);
  const alt = escapeHtml(fields.imageAlt);
  const u = escapeHtml(fields.url);
  const h = escapeHtml(fields.bodyHeading);
  const bt = escapeHtml(fields.bodyTagline);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${t}</title>
<meta name="description" content="${d}">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${alt}">
<meta property="og:url" content="${u}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Bookd">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${img}">
<meta name="twitter:image:alt" content="${alt}">
</head>
<body>
<h1>${h}</h1>
<p>${bt}</p>
</body>
</html>`;
}

function htmlResponse(html: string): Response {
  return new Response(html, {
    status: 200,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const rawHandle = (url.searchParams.get("handle") || "").trim().toLowerCase();

    if (!rawHandle) {
      return htmlResponse(renderHtml(FALLBACK_HTML_FIELDS));
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
      return htmlResponse(renderHtml(FALLBACK_HTML_FIELDS));
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // Lookup ignoring archived_at — archived pages still serve valid OG so
    // existing DM'd links never look broken.
    const { data: page, error } = await supabase
      .from("preview_pages")
      .select("handle, name, city, tagline, photo_urls")
      .eq("handle", rawHandle)
      .maybeSingle();

    if (error) {
      console.error("preview_pages lookup error", error);
      return htmlResponse(renderHtml(FALLBACK_HTML_FIELDS));
    }

    if (
      !page ||
      !Array.isArray(page.photo_urls) ||
      page.photo_urls.length === 0 ||
      !page.photo_urls[0]
    ) {
      return htmlResponse(renderHtml(FALLBACK_HTML_FIELDS));
    }

    const name = String(page.name || "").trim();
    const city = String(page.city || "").trim();
    const tagline = String(page.tagline || "").trim();
    const handleSafe = String(page.handle).trim();

    const title = city ? `${name} — ${city}` : name;
    const heroImage = buildHeroImageUrl(String(page.photo_urls[0]));

    return htmlResponse(
      renderHtml({
        title,
        description: tagline,
        image: heroImage,
        imageAlt: city ? `${name}, barber in ${city}` : name,
        url: `${SITE_BASE}/preview/${handleSafe}`,
        bodyHeading: name,
        bodyTagline: tagline,
      }),
    );
  } catch (err) {
    console.error("preview-og handler error", err);
    return htmlResponse(renderHtml(FALLBACK_HTML_FIELDS));
  }
});
