

Final plan locked in with all three flags addressed.

## Plan: Bookd Instant Brand Upgrade Preview (final)

### Flag fixes applied

**1. Single source of truth for claim state** — Drop the `claimed` boolean. Use only `status` enum: `draft` | `published` | `claimed`. Add `claimed_at`, `claim_email`, `claim_phone` as standalone fields (populated when status flips to `claimed`). One field, one truth.

**2. `created_by` retained on `preview_pages`** — UUID, references the admin user who generated the preview. Indexed for "show me everything I generated" filtering down the line.

**3. Global per-IP claim cap** — Rate limit table now keyed two ways:
   - Per-handle: 3 attempts per IP per handle per hour
   - Global: 10 attempts per IP across all handles per hour
   Both checked in the claim edge function before insert. Whichever trips first blocks.

### Database

**`preview_pages`**
- `id`, `handle` (unique), `source` ('upload' | 'instagram'), `display_name`, `tagline`, `bio`, `hero_image_url`, `og_image_url`, `gallery_image_urls` (text[]), `services` (jsonb), `location_city`, `accent_color`, `instagram_handle`, `website_url`
- `status` enum: `draft` | `published` | `claimed`
- `claimed_at`, `claim_email`, `claim_phone` (nullable, set on claim)
- `created_by` (uuid), `created_at`, `updated_at`
- Unique index on `handle`, index on `created_by`

**`preview_claims`** — `id`, `preview_page_id`, `email`, `phone`, `confirmed_handle`, `ip_address`, `created_at`

**`preview_claim_rate_limits`** — `id`, `ip_address`, `handle` (nullable for global tracking), `attempt_count`, `window_start`. Two indexed lookups: `(ip_address, handle, window_start)` and `(ip_address, window_start)`.

**RLS**
- `preview_pages`: public SELECT where `status IN ('published','claimed')`; admin-only INSERT/UPDATE/DELETE
- `preview_claims`: public INSERT (validated + rate-limited at edge); admin SELECT
- `preview_claim_rate_limits`: system-only

### Routes

- `/admin/new-preview` — admin form (admin role gate)
- `/admin/new-preview/review/:handle` — editable AI output review screen
- `/preview/:handle` — public premium preview page (390px-first, OG-tagged)

### Edge functions

- `generate-preview-copy` — JWT-verified, admin-checked. Single structured tool-call to `google/gemini-2.5-flash` returning `{tagline, bio, services[]}` in one response.
- `claim-preview-page` — public, dual rate-limited (per-handle + global per-IP). Validates input, inserts `preview_claims`, flips parent `status` to `claimed`, sends notification email via Resend.

### Build order — 8 steps, MILESTONE_REVIEW.md mandatory after each

```text
1. Static preview template (dummy data, 390px first)
2. Admin form: upload + Dublin defaults toggle
3. generate-preview-copy edge function (single structured call)
4. Editable review screen → publish flow
5. Wire DB → public preview renders from real data
6. OG meta tags + WhatsApp/iMessage/Discord card test
7. Claim modal + claim-preview-page edge function (dual rate limit)
8. Share tools: copy link + pre-filled DM draft
```

After each step, the builder writes `MILESTONE_REVIEW_{step}.md` covering: what was built, deltas from spec, risks, what to test. No skipping to the next step without it.

### Dependencies

- `colorthief` (client-side accent color from hero)
- Existing: `react-helmet-async`, Supabase storage with image transforms, Lovable AI Gateway

### Visual style

Mobile-first 390px, Inter / system stack, light mode default, generous whitespace, accent color extracted from hero image drives buttons/highlights.

### Image handling

- Hero served via Supabase transform `?width=1200&height=630&resize=cover` for OG-compliant 1.91:1
- Gallery served via `?width=800&quality=75`
- Originals retained in `profile-images/previews/{handle}/`

### Post-launch reminder (noted, not a build item)

For the first 20 previews, test the WhatsApp card in a personal thread before sending to the prospect — WhatsApp caches OG hard and a fix won't propagate to an existing DM thread.

### Explicitly NOT in v1

Instagram scraping, real booking engine, testimonials, page-view analytics, barber self-serve, custom domains, short links.

### Acceptance test

Admin uploads 5 photos + name + city + handle → Generate (≤30s) → review screen → tweak → Publish → premium iPhone render at `/preview/{handle}` → URL pastes cleanly into WhatsApp **and** iMessage **and** Discord with hero + name + tagline → Claim modal submits → status flips to `claimed`, email fires → second claim from same IP on 11th different handle within an hour gets blocked.

