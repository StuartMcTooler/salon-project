

# Server-Backed Per-User Stripe Mode Override

## Approach

Add two columns to the existing `profiles` table instead of creating a new table. Only users flagged as internal testers see the controls; the setting follows them across all devices.

## Database Migration

```sql
-- Add columns to profiles
ALTER TABLE profiles
  ADD COLUMN is_internal_tester boolean NOT NULL DEFAULT false,
  ADD COLUMN stripe_mode_override text NOT NULL DEFAULT 'default';

-- RLS: users can read their own row (already exists), 
-- but only internal testers can update stripe_mode_override
-- (handled in app logic since profiles likely already has self-update policy)
```

Seed stuart@lunch.team as internal tester:
```sql
UPDATE profiles SET is_internal_tester = true WHERE email = 'stuart@lunch.team';
```

## Resolution Logic

- `"default"` = live/production (explicit, not ambiguous)
- `"test"` = use STRIPE_TEST_SECRET_KEY
- `"live"` = use STRIPE_SECRET_KEY (same as default, but explicitly forced)

## Hook Changes

### New: `useIsInternalTester.ts`
- Query `profiles.is_internal_tester` for current user
- Cache 5 min, same pattern as `useSuperAdmin`

### Refactored: `useTestModeOverride.ts`
- On mount, fetch `profiles.stripe_mode_override` for current user
- `setStripeMode()` writes to `profiles` table via Supabase update, then syncs to localStorage as cache
- `getTestModeHeaders()` reads from localStorage cache (synchronous, for edge function calls)
- localStorage is populated on fetch and on set — never the source of truth

## UI Changes

### `DevToolsPanel.tsx`
- Gate Stripe Payment Mode card on `isInternalTester` (not just super_admin)
- No other visual changes

### `StripeModeIndicator.tsx`
- Read from the server-cached hook value instead of direct localStorage
- Banner text: "Default" label changed to "LIVE (production default)"

### `TestModeWarningBanner.tsx`
- Read from server-cached hook value

## Files Modified

| File | Change |
|------|--------|
| Migration SQL | Add `is_internal_tester` + `stripe_mode_override` to `profiles` |
| Data seed | Set `is_internal_tester = true` for stuart@lunch.team |
| `src/hooks/useIsInternalTester.ts` | New hook |
| `src/hooks/useTestModeOverride.ts` | Server-backed read/write, localStorage as cache |
| `src/components/admin/DevToolsPanel.tsx` | Gate on `isInternalTester` |
| `src/components/pos/StripeModeIndicator.tsx` | Use server value |
| `src/components/admin/TestModeWarningBanner.tsx` | Use server value |

## What Changes for Users

- **Normal users**: No change. No controls, always live.
- **Internal testers**: Same UI, but the setting now persists server-side. Set Force TEST on desktop → log into Android → Android resolves to TEST automatically.
- **"Default" means live**: No ambiguity.

