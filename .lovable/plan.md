

User uploaded the Dublin map screenshot. Plan: copy it into `public/`, wire it into `PreviewPage.tsx`, append to milestone review.

## Changes

**1. Copy asset**
- `user-uploads://Screenshot_2026-04-18_at_18.23.11.png` → `public/map-dublin-placeholder.jpg`
- Public folder is correct here — referenced as a plain `<img src="/...">` URL, not imported as an ES module.

**2. `src/pages/PreviewPage.tsx`**
- Replace `mapSrc` value: drop the OSM URL, use `/map-dublin-placeholder.jpg`
- Keep `mapFailed` state + `onError` fallback to the neutral "Map preview" tile (second-layer defence in case the asset is missing/misnamed)
- No other changes — gallery hide-and-reflow, dummy data, route, claim banner all stay intact

**3. `MILESTONE_REVIEW_1.md`**
- Append a "Step 1.3 — OSM to local asset" note: OSM tile failed live, swapped to local Dublin screenshot, Mapbox deferred to Step 5 when real per-barber coords land

## Out of scope
- Mapbox / Google Static Maps (Step 5)
- Real per-barber coordinates (Step 5)
- Any change to gallery, hero, services, or claim banner

## After ship
Reload `/preview/marco-cuts` in mobile Safari → map renders instantly from local asset, no network round-trip, no fallback. Send screenshot + updated milestone review, then verify `has_role(auth.uid(), 'admin')` works for your account before green-lighting Step 2.

