## Scope
Replace user-facing share URLs (copy-link buttons + success toast) with the new `p.bookd.ie/{handle}` short domain. Leave internal navigation, canonical tags, and og:url untouched per your direction.

## Files & exact changes

### 1. `src/pages/AdminPreviewsList.tsx` (line ~125)
The `copyLink` function — used by the Copy button on every preview row.

**Before:**
```ts
const copyLink = async (handle: string) => {
  const url = `${window.location.origin}/preview/${handle}`;
  await navigator.clipboard.writeText(url);
  toast.success("Link copied");
};
```

**After:**
```ts
const copyLink = async (handle: string) => {
  const url = `https://p.bookd.ie/${handle}`;
  await navigator.clipboard.writeText(url);
  toast.success("Link copied");
};
```

### 2. `src/pages/AdminNewPreview.tsx` (line ~171)
The `previewUrl` shown + copied on the post-create success card.

**Before:**
```ts
const previewUrl = createdHandle ? `${window.location.origin}/preview/${createdHandle}` : "";
```

**After:**
```ts
const previewUrl = createdHandle ? `https://p.bookd.ie/${createdHandle}` : "";
```

### 3. `src/pages/AdminNewPreview.tsx` (line ~162)
The success toast description shown right after creation.

**Before:**
```ts
toast({ title: "Preview created", description: `/preview/${handle} is live.` });
```

**After:**
```ts
toast({ title: "Preview created", description: `p.bookd.ie/${handle} is live.` });
```

## Explicitly NOT changing
- Internal `<a href="/preview/...">` tags in `AdminPreviewsList.tsx` (rows 255, 328) and the `/preview/{handle}` text inside the Archive confirmation dialog (line 380) — these are local navigation/labels, not shareable share-layer URLs.
- `navigate(\`/preview/${createdHandle}\`)` button in `AdminNewPreview.tsx` (line 204) — internal SPA navigation.
- `<code>/preview/{handle}</code>` helper text on the form (line 237) — describes the actual route where content lives.
- `canonical` tag in `PreviewPage.tsx` and `og:url` in `supabase/functions/preview-og/index.ts` — per your call, content lives at `bookd.ie/preview/{handle}`; `p.bookd.ie` stays a redirect-only share layer and shouldn't be indexed.
- The `/preview/:handle` React route itself.
- Booking links (`/book/:staffId`) and referral codes — out of scope.

## After shipping
You'll get a diff-style before/after summary covering all three edits, plus a confirmation that the React route at `bookd.ie/preview/{handle}` is unchanged so the Worker has something to redirect humans to.