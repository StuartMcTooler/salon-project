import { useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { MapPin, Clock, Instagram, Globe, Sparkles } from "lucide-react";

// STEP 1: Static template with hardcoded dummy data.
// Wiring to DB happens in Step 5. Do not extract types yet.
const DUMMY = {
  display_name: "Marco Russo",
  tagline: "Sharp fades and classic cuts in the heart of Dublin.",
  bio: "Marco has been cutting hair in Dublin for over a decade, blending old-school barbering with modern style. Walk in for a consultation, walk out feeling like the best version of yourself.",
  hero_image_url:
    "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?auto=format&fit=crop&w=1200&q=80",
  gallery: [
    "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?auto=format&fit=crop&w=800&q=75",
    "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?auto=format&fit=crop&w=800&q=75",
    "https://images.unsplash.com/photo-1521490683501-69b504b73f1d?auto=format&fit=crop&w=800&q=75",
    "https://images.unsplash.com/photo-1605497788044-5a32c7078486?auto=format&fit=crop&w=800&q=75",
    "https://images.unsplash.com/photo-1593702288056-f173e7480eb1?auto=format&fit=crop&w=800&q=75",
    "https://images.unsplash.com/photo-1622296055935-eba23930d12f?auto=format&fit=crop&w=800&q=75",
  ],
  services: [
    { name: "Skin Fade", price_from: 25, duration_mins: 30 },
    { name: "Dry Cut", price_from: 20, duration_mins: 30 },
    { name: "Beard Trim", price_from: 12, duration_mins: 15 },
    { name: "Hot Towel Shave", price_from: 25, duration_mins: 30 },
    { name: "Kids Cut", price_from: 15, duration_mins: 20 },
    { name: "Wash & Style", price_from: 18, duration_mins: 25 },
  ],
  location_city: "Dublin",
  accent_color: "#1a1a1a",
  instagram_handle: "marco.cuts",
  website_url: null as string | null,
  status: "draft" as "draft" | "published" | "claimed",
};

const PreviewPage = () => {
  const { handle } = useParams<{ handle: string }>();
  const data = DUMMY;
  const firstName = data.display_name.split(" ")[0];
  const accent = data.accent_color;
  const isUnclaimed = data.status !== "claimed";

  // Inline accent styles — accent comes from DB per page, not from theme tokens.
  const accentBg = { backgroundColor: accent } as const;
  const accentText = { color: accent } as const;
  const accentBorder = { borderColor: accent } as const;

  return (
    <>
      <Helmet>
        <title>{`${data.display_name} — Book on Bookd`}</title>
        <meta name="description" content={data.tagline} />
        <meta property="og:title" content={`${data.display_name} — ${data.location_city}`} />
        <meta property="og:description" content={data.tagline} />
        <meta property="og:image" content={data.hero_image_url} />
        <meta property="og:type" content="profile" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="canonical" href={`https://bookd.ie/preview/${handle ?? ""}`} />
      </Helmet>

      <div className="min-h-screen bg-white text-neutral-900 antialiased">
        {/* Claim banner */}
        {isUnclaimed && (
          <div className="sticky top-0 z-50 bg-neutral-900 px-4 py-2.5 text-center text-xs font-medium text-white sm:text-sm">
            <Sparkles className="mr-1.5 inline h-3.5 w-3.5" />
            This is a preview we made for you —{" "}
            <button className="underline underline-offset-2">claim it to activate bookings</button>
          </div>
        )}

        {/* Mobile-first container, capped for desktop */}
        <div className="mx-auto max-w-[440px]">
          {/* HERO */}
          <section className="relative">
            <div className="relative aspect-[4/5] w-full overflow-hidden bg-neutral-100">
              <img
                src={data.hero_image_url}
                alt={`${data.display_name}, barber in ${data.location_city}`}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                <p className="mb-1 text-xs font-medium uppercase tracking-[0.18em] opacity-80">
                  {data.location_city}
                </p>
                <h1 className="font-serif text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
                  {data.display_name}
                </h1>
                <p className="mt-2 text-sm leading-snug opacity-95 sm:text-base">{data.tagline}</p>
              </div>
            </div>
            <div className="px-5 py-5">
              <button
                style={accentBg}
                className="w-full rounded-full px-6 py-4 text-sm font-semibold tracking-wide text-white transition-opacity hover:opacity-90 active:opacity-80"
              >
                Book with {firstName}
              </button>
            </div>
          </section>

          {/* ABOUT */}
          <section className="px-5 pb-8 pt-2">
            <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
              About
            </h2>
            <p className="text-base leading-relaxed text-neutral-700">{data.bio}</p>
          </section>

          {/* SERVICES */}
          <section className="border-t border-neutral-100 px-5 py-8">
            <h2 className="mb-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
              Services
            </h2>
            <ul className="divide-y divide-neutral-100">
              {data.services.map((s) => (
                <li key={s.name} className="flex items-center justify-between py-4">
                  <div>
                    <p className="text-base font-medium text-neutral-900">{s.name}</p>
                    <p className="mt-0.5 text-xs text-neutral-500">{s.duration_mins} min</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-neutral-400">from</p>
                    <p className="text-base font-semibold" style={accentText}>
                      €{s.price_from}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          {/* GALLERY */}
          <section className="border-t border-neutral-100 px-5 py-8">
            <h2 className="mb-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
              Gallery
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {data.gallery.map((src, i) => (
                <div
                  key={src}
                  className={`relative overflow-hidden rounded-lg bg-neutral-100 ${
                    i === 0 ? "col-span-2 aspect-[16/10]" : "aspect-square"
                  }`}
                >
                  <img
                    src={src}
                    alt={`${data.display_name} portfolio ${i + 1}`}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                </div>
              ))}
            </div>
          </section>

          {/* LOCATION & HOURS */}
          <section className="border-t border-neutral-100 px-5 py-8">
            <h2 className="mb-5 text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-500">
              Location & Hours
            </h2>
            <div className="mb-5 aspect-[16/9] w-full overflow-hidden rounded-lg bg-neutral-100">
              <div className="flex h-full items-center justify-center bg-gradient-to-br from-neutral-100 to-neutral-200">
                <MapPin className="h-8 w-8 text-neutral-400" />
              </div>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                <p className="text-neutral-700">{data.location_city}, Ireland</p>
              </div>
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                <div className="text-neutral-700">
                  <p>Tue–Fri · 9:00 – 18:00</p>
                  <p>Sat · 9:00 – 16:00</p>
                  <p className="text-neutral-400">Sun, Mon · Closed</p>
                </div>
              </div>
              {data.instagram_handle && (
                <div className="flex items-start gap-3">
                  <Instagram className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                  <a
                    href={`https://instagram.com/${data.instagram_handle}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-700 underline-offset-2 hover:underline"
                  >
                    @{data.instagram_handle}
                  </a>
                </div>
              )}
              {data.website_url && (
                <div className="flex items-start gap-3">
                  <Globe className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
                  <a
                    href={data.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-neutral-700 underline-offset-2 hover:underline"
                  >
                    {data.website_url.replace(/^https?:\/\//, "")}
                  </a>
                </div>
              )}
            </div>
          </section>

          {/* FOOTER CTA */}
          <section className="border-t border-neutral-100 px-5 py-8">
            <button
              style={accentBg}
              className="mb-3 w-full rounded-full px-6 py-4 text-sm font-semibold tracking-wide text-white transition-opacity hover:opacity-90"
            >
              Book now
            </button>
            {isUnclaimed && (
              <button
                style={accentBorder}
                className="w-full rounded-full border bg-white px-6 py-4 text-sm font-semibold tracking-wide transition-colors hover:bg-neutral-50"
              >
                <span style={accentText}>Claim this page</span>
              </button>
            )}
          </section>

          {/* Wordmark */}
          <footer className="px-5 pb-10 pt-4 text-center">
            <p className="text-[11px] uppercase tracking-[0.25em] text-neutral-400">
              Powered by <span className="font-semibold text-neutral-600">Bookd</span>
            </p>
          </footer>
        </div>
      </div>
    </>
  );
};

export default PreviewPage;
