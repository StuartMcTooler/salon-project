

Plan unchanged from prior approval — green-lit and ready to execute on switch to default mode.

## Execution checklist

**File: `src/pages/PreviewPage.tsx`**
1. Swap 6 gallery URLs to stable Unsplash IDs
2. Convert gallery to `useState` array; `onError` filters the failed URL out → grid reflows; first item in live array always gets the `col-span-2 aspect-[16/10]` hero treatment so layout self-heals
3. Replace map placeholder `<div>` with `<img>` pointing to OSM static tile (`https://staticmap.openstreetmap.de/staticmap.php?center=53.3498,-6.2603&zoom=13&size=600x300&maptype=mapnik`); same `onError` pattern falls back to current darker neutral tile + "Map preview" label

**File: `MILESTONE_REVIEW_1.md`**
4. Append "Post-review fixes" section documenting the gallery swap, hide-and-reflow, OSM tile + fallback, and the OSM scale caveat (Mapbox as upgrade path)

## After execution — user actions before Step 2

- Open preview URL in real mobile Safari (not the Lovable pane), confirm gallery + map render cleanly
- OSM check: quick refresh burst now, then a second check ~1 hour later (sustained rate-limit catches what burst doesn't)
- Verify `has_role(auth.uid(), 'admin')` works for your account — 2-minute test, hard blocker for Step 2 if broken
- Send screenshots + updated milestone review, then green-light Step 2 (admin form)

