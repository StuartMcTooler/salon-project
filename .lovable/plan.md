# Pass 2 — Marketing page, banner, global footer (revised)

Booking app at `/` already renders `<Discover />` (via `Index.tsx`). The existing barber marketing copy at `/home` (`src/pages/Home.tsx`) is superseded by a new canonical `/for-barbers` page; `/home` becomes a redirect.

## 1. New: `src/components/SiteFooter.tsx`

Shared footer used by Discover, `/for-barbers`, `/privacy`, `/terms`, `/whatsapp`.

Three link groups:
- **Product** — About (`/for-barbers`) · For Barbers (`/for-barbers`) · Pricing (`/for-barbers#pricing`) · Find a barber (`/`)
- **Legal** — Privacy Policy (`/privacy`) · Terms (`/terms`) · How we use WhatsApp (`/whatsapp`)
- **Contact** — `mailto:support@bookd.ie`

Attribution line (replaces existing):
> "Bookd is operated by Downthesofa Ireland Limited (registered in Ireland, CRO 538446, 17 Northbrook Terrace, North Strand, Dublin, D03WV44). Downthesofa Ireland Limited also operates Lunch.Team."

White bg, neutral-200 border, brand row "Bookd · Made in Ireland".

## 2. New page: `src/pages/ForBarbers.tsx`

Same design tokens as existing Home (accent `#10b981`, black `#0a0a0a`, soft grey `#f6f6f5`, italic tag `#2a2a2a`), restructured to match the prompt content:

1. Sticky nav — Bookd logo, anchors `#how` / `#why` / `#pricing`, black "Request invite" pill → `/request-invite`
2. Hero (black) — "The booking platform built for barbers" + subhead + support line, green "Request invite" + outline "See how it works" (→ `#how`), invite-only badge, 3 stat tiles (No hardware / Same day / Yours)
3. How it works (white, `id="how"`) — 3 numbered cards
4. Why Bookd (soft grey, `id="why"`) — 3 pillars with italic tag + bullets
5. The Bookd Promise (black manifesto band)
6. vs The Old Way (white) — side-by-side 2-col grid, Booksy/Square left (grey, red X), Bookd right (black, green check), collapses <720px
7. In the box (soft grey) — 6 tiles
8. Built for what's coming next (black rounded card on white) — 3 AI tiles
9. Pricing (white, `id="pricing"`) — Bookd Pro €20/month, 6 features, 50¢ fine print, "Request an invite" CTA
10. How we use WhatsApp (soft grey) — 2-sentence summary + "Read our WhatsApp policy →" → `/whatsapp`
11. `<SiteFooter />`

`<Helmet>`: title "Bookd for Barbers — The booking platform built for independent barbers", description per prompt, canonical `https://bookd.ie/for-barbers`.

## 3. `src/components/discovery/DiscoveryHeader.tsx`

Add "For Barbers" `<Link to="/for-barbers">` in the top bar, immediately before the user/profile icon.

## 4. New: `src/components/discovery/BarberBanner.tsx`

Slim dismissible banner rendered in `Discover.tsx` above `<DiscoveryHeader />` (keeps sticky header untouched).

- Copy: "Are you a barber? Run your own column with Bookd Pro — Learn more →" → `/for-barbers`
- `×` dismiss; persists via `localStorage["bookd:barber-banner-dismissed"] = "1"`; hidden on mount if set
- Subtle accent-tinted bg, single line desktop, wraps on mobile

## 5. `src/pages/Discover.tsx`

- Render `<BarberBanner />` above `<DiscoveryHeader />`
- Replace inline footer with `<SiteFooter />`

## 6. `src/pages/LegalPage.tsx`

- Replace inline footer with `<SiteFooter />`
- Update top-nav anchor links so they cross-navigate to the marketing page:
  - `/#how` → `/for-barbers#how`
  - `/#why` → `/for-barbers#why`
  - `/#pricing` → `/for-barbers#pricing`

(Markdown content untouched.)

## 7. Remove `/home` duplication

- Delete `src/pages/Home.tsx`
- In `src/App.tsx`, replace the `/home` route with a redirect: `<Route path="/home" element={<Navigate to="/for-barbers" replace />} />` (import `Navigate` from `react-router-dom`; drop the `Home` import)

## 8. `src/App.tsx`

- `import ForBarbers from "./pages/ForBarbers";`
- `import { Navigate } from "react-router-dom";` (alongside existing imports)
- Drop `import Home`
- Routes: `<Route path="/for-barbers" element={<ForBarbers />} />` and `<Route path="/home" element={<Navigate to="/for-barbers" replace />} />` (both above the catch-all). All other routes untouched.

## 9. SEO

- `/for-barbers` — Helmet inside `ForBarbers.tsx` per prompt
- `/privacy`, `/terms`, `/whatsapp` — already correct via existing `LegalPage` Helmet; no change

## Out of scope

- No changes to Discover search bar / filters / stylist cards / hooks / data layer
- No changes to `src/content/*.md`
- No backend, RLS, or edge-function changes
- No new dependencies
- `Index.tsx` routing logic untouched

## Files touched

**Create:** `src/components/SiteFooter.tsx`, `src/components/discovery/BarberBanner.tsx`, `src/pages/ForBarbers.tsx`
**Modify:** `src/App.tsx`, `src/pages/Discover.tsx`, `src/pages/LegalPage.tsx`, `src/components/discovery/DiscoveryHeader.tsx`
**Delete:** `src/pages/Home.tsx`
