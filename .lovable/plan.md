
# Fix Tap to Pay Initialization Race Condition and Live Mode Debug Build

## Problem Summary

You've confirmed two distinct issues:

1. **Race Condition (First Tap)**: Location permission error on first tap despite permissions being granted. This happens because the SDK initialization isn't fully awaited before reader discovery begins.

2. **Security Block (Second Tap)**: "Tap to Pay not available" in Live Mode because Stripe's SDK blocks transactions on debug builds for security reasons.

---

## Solution

### Part 1: Fix the Initialization Race Condition

**File**: `src/hooks/useTerminalPayment.ts`

The current flow checks `isInitialized` React state, but React state updates are asynchronous. Even after `await initializeNativeSDK()` completes, the state may not reflect the change immediately.

**Changes**:
- Use a synchronous flag (`initializationPromise`) to track ongoing initialization
- Ensure only one initialization can run at a time (prevent duplicate parallel inits)
- Add explicit verification that `terminalRef.current` is populated before proceeding
- Increase stabilization delay after initialization to 800ms for more reliable native bridge settling

### Part 2: Enable Live Mode on Debug Builds

**File**: `ANDROID_BUILD_GUIDE.md`

Add a new section with the `debuggable false` configuration that you should apply locally to your `android/app/build.gradle`:

```gradle
android {
    buildTypes {
        debug {
            debuggable false  // Required for Stripe Tap to Pay in Live Mode
        }
    }
}
```

This tells Stripe's SDK that the build should be treated as a release build for security purposes, allowing Live Mode transactions.

---

## Technical Details

### Race Condition Fix

```text
BEFORE:
┌─────────────────────┐     ┌──────────────────┐
│ processNativePayment│────▶│ Check isInitialized │
│ called              │     │ (React state)       │
└─────────────────────┘     └──────────────────┘
                                     │
                            ┌────────▼────────┐
                            │ initializeNativeSDK │
                            │ (async)            │
                            └────────────────────┘
                                     │
                            ┌────────▼────────┐
                            │ 500ms delay      │
                            └────────────────────┘
                                     │
                            ┌────────▼────────┐
                            │ discoverReaders  │◀── May run before
                            │ (fails!)         │    init fully complete
                            └────────────────────┘

AFTER:
┌─────────────────────┐     ┌──────────────────────┐
│ processNativePayment│────▶│ Check terminalRef    │
│ called              │     │ (synchronous ref)     │
└─────────────────────┘     └──────────────────────┘
                                     │
                            ┌────────▼────────────┐
                            │ initializeNativeSDK  │
                            │ with mutex lock      │
                            └──────────────────────┘
                                     │
                            ┌────────▼────────┐
                            │ 800ms delay      │
                            └────────────────────┘
                                     │
                            ┌────────▼────────────┐
                            │ VERIFY terminalRef   │
                            │ is populated         │
                            └──────────────────────┘
                                     │
                            ┌────────▼────────┐
                            │ discoverReaders  │◀── Guaranteed init complete
                            │ (succeeds!)      │
                            └────────────────────┘
```

### Key Changes to `useTerminalPayment.ts`:

1. Add initialization mutex using a ref to track ongoing init
2. Update `initializeNativeSDK` to prevent concurrent initialization attempts
3. Increase post-init stabilization delay from 500ms to 800ms
4. Add explicit terminalRef verification after initialization

### Build Guide Update:

Add new section "Step 5d: Enable Live Mode on Debug Builds (Optional)" with the `debuggable false` configuration.

---

## Files to Modify

1. `src/hooks/useTerminalPayment.ts` - Fix race condition with initialization mutex
2. `ANDROID_BUILD_GUIDE.md` - Add debuggable false configuration instructions

---

## After Implementation

After applying these changes:

1. Run: `npm run build && npx cap sync android`
2. Apply the `debuggable false` change to your local `android/app/build.gradle`
3. Rebuild the APK in Android Studio
4. Test Tap to Pay - first tap should now work reliably
