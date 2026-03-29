

## Add Test Mode Support to Stripe Connect Onboarding

### Problem
Connect edge functions always use `STRIPE_SECRET_KEY` (live). Test and live Connect accounts would collide in a single DB column.

### Changes

#### 1. Database migration — add test Connect columns to `staff_members`
- `stripe_connect_test_account_id` (TEXT, nullable)
- `stripe_connect_test_status` (TEXT, default `'not_started'`)
- `stripe_connect_test_onboarded_at` (TIMESTAMPTZ, nullable)

#### 2. Edge function: `create-connect-account`
- Detect test mode via `x-force-test-mode` header OR `forceStripeMode: "test"` in body
- Use `STRIPE_TEST_SECRET_KEY` when test mode, `STRIPE_SECRET_KEY` otherwise
- Read/write `stripe_connect_test_account_id` + `stripe_connect_test_status` in test mode; existing live columns otherwise
- No prefix-based assumptions — environment is determined solely by which key was used and which DB column is written to

#### 3. Edge function: `create-connect-login-link`
- Same test mode detection
- Read from test or live columns accordingly

#### 4. Edge function: `stripe-connect-webhook`
- Determine environment from which webhook secret matched: check `STRIPE_CONNECT_WEBHOOK_SECRET` first, then `STRIPE_CONNECT_TEST_WEBHOOK_SECRET`
- Based on matched secret, look up staff by `stripe_connect_account_id` or `stripe_connect_test_account_id`
- Update the corresponding status column — no prefix sniffing on account IDs

#### 5. Client: `PayoutActivationCard`
- Import `useTestModeOverride`, `useAuthUser`, `resolveScopedStripeMode`
- Resolve effective stripe mode for current user
- When test mode: read `stripe_connect_test_status` from the staff query; pass `x-force-test-mode` header + `forceStripeMode` body to both edge function calls
- Show a clear **"TEST MODE"** badge/label on the payout card when operating in test mode, so test Connect status is visually distinct from live payout readiness
- When live (default): unchanged behaviour, show live status without any test label

### New secret needed
- `STRIPE_CONNECT_TEST_WEBHOOK_SECRET` — for verifying test-mode Connect webhook events. Will need to be added via the secrets tool.

### Files modified
- `supabase/migrations/` — new migration
- `supabase/functions/create-connect-account/index.ts`
- `supabase/functions/create-connect-login-link/index.ts`
- `supabase/functions/stripe-connect-webhook/index.ts`
- `src/components/dashboard/PayoutActivationCard.tsx`

### Key design decisions
- Environment is determined by API key / webhook secret context + DB column, never by account ID prefix
- Test and live Connect data are fully separated in the database
- UI clearly distinguishes test vs live Connect status
- Default behaviour (no override) remains live — no risk to production

