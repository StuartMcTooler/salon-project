

Plan unchanged from prior approval — green-lit. Ready to execute on switch to default mode.

## Execution checklist

**1. Migration: `preview_pages` table**
- Columns: `id`, `handle` (unique), `name`, `city`, `instagram_handle`, `tagline` NOT NULL, `website` nullable, `bio` nullable, `services` jsonb default `'[]'`, `photo_urls` text[], `claimed_by_user_id` nullable, `created_by`, `created_at`
- Validation trigger: photos 3–6, tagline length 1–80, services array ≤10 (no CHECK constraints, per memory)
- RLS: public SELECT, admin-only INSERT/UPDATE/DELETE via `has_role`

**2. `src/pages/AdminNewPreview.tsx` (new)**
- Admin gate via `useUserRole().isAdmin`, redirect on fail
- Form: name, city, handle (unique check), IG handle (strip `@`), tagline (required, 0/80 counter), website, bio, services repeater (Dublin defaults pre-seeded), photos 3–6 with "First photo becomes the hero" helper text
- Storage: `profile-images` bucket, `preview-pages/{handle}/` prefix
- Success: toast + "Copy preview URL" button + navigate to `/preview/{handle}`

**3. `src/pages/PreviewPage.tsx` (modify)**
- Fetch `preview_pages` row by handle param
- Render real data if found, else keep `marco-cuts` dummy fallback
- Defensive empty-state: hide entire section (heading + content) if `services.length === 0`, `bio` empty, or `website` empty
- Hardcoded Dublin hours stay (deferred)
- Map asset stays (local Dublin placeholder)
- Gallery hide-and-reflow stays

**4. `src/App.tsx` (modify)**
- Add `<Route path="/admin/new-preview" element={<AdminNewPreview />} />` above catch-all

## Confirmed deferrals
Edit flow → Step 3 · Hours customisation → later · Accent color → Step 5+ · AI copy gen → Step 2.5+ · Mapbox → Step 5 · Photo reorder → later · OG meta tags → Step 6

## After ship — your test
1. Confirm `has_role(auth.uid(), 'admin')` returns true in browser console
2. Create first real entry — a barber you'll actually DM within 48 hours, not a throwaway
3. Open `/preview/{handle}` in mobile Safari (not Lovable pane), confirm tagline + services render, gallery reflows, map shows
4. Paste URL into WhatsApp — capture the bare-text card as your Step 6 "before" baseline
5. Send screenshots + MILESTONE_REVIEW update → green-light Step 3

