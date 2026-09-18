# Plan: Test-mode acceptance checks for Terminal edge functions

## Goal
Validate that the three Terminal edge functions honor a `forceStripeMode: "test"` body field after deploy, using simple POST requests.

## Gaps found in the proposed checks (from reading the functions)

1. `check-terminal-reader` only reads `x-force-test-mode` / `x-force-live-mode` **headers** — it ignores a `forceStripeMode` body field, so Test 3 would return `live` as written.
2. `create-terminal-connection-token` and `create-terminal-payment-intent` call `requireAuth`, so a request using only the anon key as Bearer fails with 401. Tests 1 and 2 need a logged-in user's access token, not the anon key.

## Changes

1. **`supabase/functions/check-terminal-reader/index.ts`**
   - Read `forceStripeMode` from the request body and OR it with the existing header checks (same pattern as `create-terminal-payment-intent`), so Test 3 works as proposed.

2. **Deploy** all three functions (`check-terminal-reader`, `create-terminal-connection-token`, `create-terminal-payment-intent`).

3. **Run the acceptance checks** via the edge-function test tool:
   - Test 3 (reader, TEST body) — should return `mode: "test"`.
   - Test 2 (PaymentIntent, TEST body) — should return `stripeMode: "TEST (forced)"` and a test-mode intent (`pi_...` in test account).
   - Test 1 (connection token) — same body; note it requires an authenticated session, so it will be run with the logged-in preview token (auto-injected) rather than the anon key.

## Technical notes
- No database changes. One small edge-function edit, then deploy + verify.
- The anon key cannot satisfy `requireAuth`; that auth requirement is intentional and stays.
