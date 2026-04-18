# Milestone Review — Step 1: Static preview template

## What was built
- New route `/preview/:handle` rendering `src/pages/PreviewPage.tsx` with hardcoded dummy data (Marco Russo / Dublin barber).
- Mobile-first layout, capped at 440px on desktop, 390px-first as specified.
- Sections in spec order: claim banner (sticky), hero (4:5, gradient overlay, name + tagline + city), Book CTA, About, Services (price + duration list), Gallery (2-col grid with hero spanning 2), Location & Hours (placeholder map tile + Tue–Sat hours), Footer CTA (Book + Claim), Bookd wordmark.
- OG meta tags via `react-helmet-async` (`og:title`, `og:description`, `og:image`, `twitter:card=summary_large_image`, canonical).
- Accent color applied via inline styles (driven by per-page `accent_color`, not theme tokens — intentional, see Risks).
- Typography: serif display for hero name + tracked uppercase section labels for that "boutique hotel" feel.

## Deltas from spec
- **Testimonials section omitted.** Per the user's pre-approval refinement ("omit testimonials entirely if no real ones exist").
- **Map is a placeholder tile (gradient + pin icon)**, not a static map image. Real map can be wired later — spec called it nice-to-have ("static image is fine for MVP").
- **Hours are placeholder copy** (Tue–Sat). Will be replaced with real data once admin form supports hours, or left as defaults.
- **Inline styles for accent color.** The Lovable design-system rule says no raw colors in components, but the accent is dynamic per-page (extracted from each hero image), not a theme decision. Tokens can't express that. All other colors use `neutral-*` Tailwind which is fine for the premium light-mode look.

## Risks
- **Accent color contrast.** If `colorthief` extracts a light color from a bright hero, white text on the Book button will fail WCAG. Step 2 (color extraction) needs a luminance check — fall back to `#1a1a1a` if extracted color is too light.
- **Hero aspect ratio (4:5) ≠ OG aspect ratio (1.91:1).** The displayed hero and the OG card image are the same URL right now. Step 6 will fix this by serving the OG image via Supabase transform `?width=1200&height=630&resize=cover` while the page hero keeps the 4:5 crop.
- **No fonts loaded.** Using Tailwind's default `font-serif` and system stack. Spec says "Inter or system stack" — system stack is the default body font already. If we want a distinctive serif, that's a separate font-loading task.

## What to test
1. Open `/preview/marco-cuts` in the preview pane at 390px width — confirm no horizontal scroll, hero fills width, CTAs are tappable.
2. Confirm sticky claim banner stays visible while scrolling.
3. Resize to desktop — content should cap at 440px and center, not stretch.
4. View page source — confirm `<title>` and `<meta property="og:image">` are set correctly.
5. Tab through interactive elements — buttons should be focusable.

## Next step
Step 2: admin form at `/admin/new-preview` with photo upload + Dublin services defaults toggle. Will not start until this milestone is reviewed.

---

## Post-review fixes (Step 1.1)

Applied after first round of review screenshots showed broken gallery tiles + an empty white box above LOCATION & HOURS.

### Gallery
- Swapped all 6 Unsplash URLs to a fresh set of stable editorial barber/grooming photo IDs. The previous IDs had rotted (Unsplash periodically removes/reassigns photo IDs, which is what produced the alt-text-only renders).
- Converted the gallery from a static `data.gallery.map()` render to a `useState` array seeded from the dummy data.
- Each `<img>` now has an `onError` handler that filters its URL out of state. The grid reflows naturally — 6 tiles becomes 5, becomes 4, with no empty grey boxes left behind.
- The `col-span-2 aspect-[16/10]` hero treatment is keyed off array index `0` of the *live* array, so if the original hero image fails the next image promotes into the hero slot and the layout self-heals.
- If every image fails, the entire gallery section's grid is hidden (the section header still renders for now — fine for v1, can hide the whole section in Step 5 when wired to real DB data).

### Map
- Replaced the placeholder `<div>` (which was the empty white box in screenshot 4) with an `<img>` pointing to an OSM static tile of central Dublin: `https://staticmap.openstreetmap.de/staticmap.php?center=53.3498,-6.2603&zoom=13&size=600x300&maptype=mapnik`.
- Same `onError` pattern: if OSM is down or rate-limits us, falls back to a darker neutral gradient tile with a `MapPin` icon and "Map preview" label — reads as intentional rather than broken.

### Risks added
- **OSM static tile service is community-run** (`staticmap.openstreetmap.de`) and has historically been intermittently flaky under sustained load. Fine for 10–50 preview pages. If we start generating hundreds and see broken tiles in the wild, the upgrade path is **Mapbox Static Images API** (50k free requests/month, requires API key, rock-solid). Watch for this in Step 5+ when real pages start being created.
- OSM rate limiting hits on **sustained** requests more than burst, so the right reliability test is a quick refresh burst now + a second check ~1 hour later, not 10 refreshes back-to-back.

### What changed in code
- `src/pages/PreviewPage.tsx`: added `useState` import; new `galleryUrls` state + `handleImageError` callback; new `mapFailed` state + `mapSrc` const; gallery render swapped to use live state; map placeholder swapped to `<img>` with fallback branch.
- No other files touched. Dummy data shape unchanged. Route unchanged.
