

# Deploy `create-terminal-payment-intent` Edge Function

## Status
The code already contains the correct dual-detection logic:
```typescript
const forceTestMode = req.headers.get("x-force-test-mode") === "true" || forceStripeMode === "test";
const forceLiveMode = req.headers.get("x-force-live-mode") === "true" || forceStripeMode === "live";
```

No code changes are needed.

## Action
Deploy `create-terminal-payment-intent` to the live backend, then verify with a test invocation using `forceStripeMode: "test"` in the body to confirm it returns `stripeMode: "TEST (forced)"`.

