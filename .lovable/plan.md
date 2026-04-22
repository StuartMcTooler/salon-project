

# Step 2.5 — Admin Previews Index, Claim Flow & Hero Fix (Approved)

Bundling three changes into one build. Approved tweaks incorporated.

## Approved tweaks
- Copy-link uses `${window.location.origin}/preview/${handle}` — no hardcoded domain.
- Pending Claims section filters `contacted_at IS NULL`, orders `created_at desc`. Marking contacted removes the row from the section.
- Previews list orders `created_at desc`.

## 1. Hero duplication fix (`PreviewPage.tsx`)
Render `galleryUrls.slice(1)` in the gallery grid — first photo is already the hero. Keep the col-span-2 first-tile layout (now the second photo overall) and the hide-on-error reflow logic. With 3 photos, gallery shows 2.

## 2. Schema migration

```sql
alter table public.preview_pages
  add column dm_sent_at timestamptz,
  add column archived_at timestamptz;

create table public.preview_page_claims (
  id uuid primary key default gen_random_uuid(),
  preview_page_id uuid not null references public.preview_pages(id) on delete cascade,
  email text not null,
  phone text,
  contacted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.preview_page_claims enable row level security;

create policy "Anyone can submit claim"
  on public.preview_page_claims for insert
  to anon, authenticated with check (true);

create policy "Admins can view claims"
  on public.preview_page_claims for select
  to authenticated using (has_role(auth.uid(), 'admin'));

create policy "Admins can update claims"
  on public.preview_page_claims for update
  to authenticated using (has_role(auth.uid(), 'admin'));
```

No `message` column.

## 3. Claim modal — `src/components/preview/ClaimPageModal.tsx`
Props: `previewPageId`, `open`, `onOpenChange`. Fields: email (required, regex-validated), phone (optional). Submit → insert into `preview_page_claims`, close, toast "Thanks — we'll be in touch within 24 hours." No "Stuart" string anywhere.

In `PreviewPage.tsx`: add local modal state, wire both entry points (sticky banner underline link + footer "Claim this page" button) to open the same modal.

## 4. Admin Previews Index — `src/pages/AdminPreviewsList.tsx` at `/admin/previews`

Admin-gated identically to `AdminNewPreview.tsx` (`has_role` + `<Navigate to="/" replace />`).

**Layout:**
- Header: title, "+ New preview" button → `/admin/new-preview`, "Show archived" toggle.
- **Pending claims** section (only renders if rows exist): query `contacted_at IS NULL` order by `created_at desc`. Each row: preview name, email, phone, created date, "Mark contacted" button → stamps `contacted_at = now()` and refetches (row drops out).
- **Previews list** ordered `created_at desc`: hero thumbnail (`photo_urls[0]`), display name + city, handle as link → `/preview/{handle}` (new tab), copy-link icon button (writes `${window.location.origin}/preview/${handle}` to clipboard), status pill, created date, action buttons.

**Status pill:**
- `claimed_by_user_id IS NOT NULL` → "Claimed" (green)
- else `dm_sent_at IS NOT NULL` → "Sent" (blue)
- else "Draft" (neutral)

**Per-row actions:**
- Copy link
- Mark as sent / Mark as unsent (toggles `dm_sent_at`)
- Archive (sets `archived_at = now()`, AlertDialog confirm)

**Archived view (toggle on):**
- Filter `archived_at IS NOT NULL`.
- Actions: Unarchive (clears `archived_at`); Delete permanently — only enabled when `dm_sent_at IS NULL` AND zero `preview_page_claims` for that preview. Disabled state shows tooltip "Archive only — has outreach history or claims." Strong AlertDialog confirm on delete.

**Default list query:** `archived_at IS NULL`. Public `/preview/{handle}` keeps resolving archived pages so DM'd links don't 404.

## 5. Discoverability touchpoints
- `src/App.tsx` — register `<Route path="/admin/previews" element={<AdminPreviewsList />} />`.
- `src/pages/Admin.tsx` — add nav link/button to `/admin/previews`.
- `src/pages/AdminNewPreview.tsx` — add "Back to all previews" button on success screen.

## Files

**Create:** `src/pages/AdminPreviewsList.tsx`, `src/components/preview/ClaimPageModal.tsx`

**Edit:** `src/pages/PreviewPage.tsx`, `src/pages/AdminNewPreview.tsx`, `src/pages/Admin.tsx`, `src/App.tsx`

## Out of scope
Real claim → account creation, edit-in-place, email notifications on claim, search/pagination, server-side email validation.

## Execution order
1. Run migration (schema first → types regenerate).
2. Build `ClaimPageModal` + wire into `PreviewPage` + apply gallery `.slice(1)` fix.
3. Build `AdminPreviewsList` + register route + add `/admin` nav link + "Back to all previews" on success screen.

