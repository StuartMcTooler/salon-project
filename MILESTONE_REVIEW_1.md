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
