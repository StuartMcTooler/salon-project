

## Fix: Stripe Mode Not Syncing on Android Native App

Two targeted changes to resolve the auth timing issue on native devices.

### Change 1: Session-first auth resolution in `useAuthUser.ts`

Currently, `loadUser` calls `getSession()` then `getUser()` sequentially, but the session user is only used if present — otherwise it waits for `getUser()` which can be slow on native.

**Fix**: Set the user from `getSession()` immediately (fast path), then validate with `getUser()` in the background. This gives downstream hooks a `user.id` right away.

```
loadUser:
  1. getSession() → if session.user exists, setUser(session.user) immediately, setLoading(false)
  2. Then call getUser() in background → if different, update user
```

Same pattern in the `onAuthStateChange` listener: use the session user directly, validate async.

### Change 2: localStorage fallback in `useTestModeOverride.ts`

One-line change to the `stripeMode` derivation:

```typescript
// Before:
const stripeMode: StripeMode = serverStripeMode ?? "default";

// After:
const stripeMode: StripeMode = serverStripeMode ?? 
  (localStorage.getItem(STORAGE_KEYS.FORCE_STRIPE_MODE) as StripeMode) ?? 
  "default";
```

This ensures the cached value from the last successful server fetch is used while auth + query are still loading. Once the server query resolves, it takes over.

### Files Modified
- `src/hooks/useAuthUser.ts` — session-first fast path
- `src/hooks/useTestModeOverride.ts` — localStorage fallback (1 line)

### After Implementation
Rebuild APK: `npm run build` → `npx cap sync android` → rebuild in Android Studio.

