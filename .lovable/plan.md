

# Fix Stripe Terminal Test/Live Mode Mismatch

## Problem
The native Android app sends `forceStripeMode` in the request body, but all 5 terminal edge functions only check headers (`x-force-test-mode`, `x-force-live-mode`) for mode selection. This causes PaymentIntents to be created in LIVE mode even when the app is in TEST mode, resulting in `live_mode_test_card` errors.

## Changes

### 5 Edge Functions to Update

Each function gets the same small change: read `forceStripeMode` from the JSON body and combine it with the existing header checks.

**1. `supabase/functions/create-terminal-connection-token/index.ts`**
- Currently does NOT parse a request body at all
- Add: `const { forceStripeMode } = await req.json().catch(() => ({}));`
- Update mode detection to also check `forceStripeMode === "test"` / `"live"`

**2. `supabase/functions/create-terminal-payment-intent/index.ts`**
- Already parses body for `amount`, `currency`, etc.
- Add `forceStripeMode` to the destructured body
- Update mode detection booleans

**3. `supabase/functions/create-terminal-payment/index.ts`**
- Already parses body for `amount`, `readerId`, etc.
- Add `forceStripeMode` to the destructured body
- Update mode detection booleans

**4. `supabase/functions/create-terminal-location/index.ts`**
- Already parses body for `staffId`, `displayName`, etc.
- Add `forceStripeMode` to the destructured body
- Update mode detection booleans

**5. `supabase/functions/check-terminal-reader/index.ts`**
- Already parses body for `readerId`
- Add `forceStripeMode` to the destructured body
- Update mode detection booleans

### The Pattern (same in all 5)

```typescript
// Before:
const forceTestMode = req.headers.get("x-force-test-mode") === "true";
const forceLiveMode = req.headers.get("x-force-live-mode") === "true";

// After:
const forceTestMode =
  req.headers.get("x-force-test-mode") === "true" || forceStripeMode === "test";
const forceLiveMode =
  req.headers.get("x-force-live-mode") === "true" || forceStripeMode === "live";
```

### Deploy & Verify
- Deploy all 5 functions
- Test each to confirm they return the correct `stripeMode` when `forceStripeMode: "test"` is in the body
- After this fix, PaymentIntent will return `livemode: false` in test mode, and the `live_mode_test_card` error will stop

