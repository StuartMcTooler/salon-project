

## User-Scoped Stripe Mode Cache & POS Payment Routing Fix

### Problem
The localStorage cache for Stripe mode (`FORCE_STRIPE_MODE`) is device-scoped, not user-scoped. On a shared POS tablet, one user's test mode setting leaks to the next user. Additionally, POS payment calls don't pass `forceStripeMode` to backend functions, so the override never actually reaches Stripe.

### Changes

#### 1. User-scope the localStorage cache (`src/hooks/useTestModeOverride.ts`)

- **Key the cache by user ID**: Change from `FORCE_STRIPE_MODE` to `FORCE_STRIPE_MODE_${userId}` for both reads and writes.
- **Clear stale cache on user change**: When `user` changes (sign-out or different user), remove the previous user's cached key. Track previous user ID via a ref.
- **Update `getTestModeHeaders()`**: This standalone function can't access hooks, so it needs the current user ID. Two options:
  - **Option chosen**: Store both the mode AND the user ID in localStorage (e.g., `FORCE_STRIPE_MODE_USER_ID`). `getTestModeHeaders()` compares stored user ID against a module-level variable set by the hook. If they don't match, return empty headers (safe default = live/production).
- **On sign-out** (`!authLoading && !user`): Clear all `FORCE_STRIPE_MODE_*` keys.

#### 2. Pass `forceStripeMode` in all POS payment calls

Three call sites currently missing the override:

- **`src/components/pos/PaymentMethodSelector.tsx`** (line ~343): Add `forceStripeMode` to `create-terminal-payment` and `check-terminal-reader` invocations. The component will need to consume `stripeMode` from `useTestModeOverride`.

- **`src/components/pos/QuickCustomerForm.tsx`** (line ~509): Same — add `forceStripeMode` to `create-terminal-payment` and `check-terminal-reader` calls.

- **`src/hooks/useTerminalPayment.ts`** (lines ~422, ~466): Add `forceStripeMode` to both `create-terminal-payment-intent` and `create-terminal-payment` calls. The hook will accept `stripeMode` as a parameter or import it.

#### 3. Detailed implementation for `useTestModeOverride.ts`

```text
Module-level variable:
  let currentAuthUserId: string | null = null;

Helper:
  getUserScopedKey(userId) → "FORCE_STRIPE_MODE_" + userId

In hook:
  - On user change: set currentAuthUserId = user.id
  - On query success: write to getUserScopedKey(user.id)
  - stripeMode fallback reads from getUserScopedKey(user.id)
  - On sign-out: remove getUserScopedKey(prevUserId)

getTestModeHeaders():
  - Read FORCE_STRIPE_MODE_<currentAuthUserId>
  - If currentAuthUserId is null, return {} (safe default)
```

### Files Modified
- `src/hooks/useTestModeOverride.ts` — user-scoped cache, safe `getTestModeHeaders()`
- `src/components/pos/PaymentMethodSelector.tsx` — pass `forceStripeMode`
- `src/components/pos/QuickCustomerForm.tsx` — pass `forceStripeMode`
- `src/hooks/useTerminalPayment.ts` — accept and pass `forceStripeMode`

### Security Guarantee
The local cache is **display acceleration only**. Payment headers are only emitted when `currentAuthUserId` matches the cached user ID. On shared devices, a user switch results in empty headers (= production/live default) until the new user's server query resolves.

