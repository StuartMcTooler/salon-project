# iOS Tap to Pay Setup

This project's known-good iOS Tap to Pay setup uses the following:

- Bundle ID: `ie.bookd.salon`
- Apple team: `5NYK73WG56`
- Entitlement: `com.apple.developer.proximity-reader.payment.acceptance = true`
- Native plugin class: `App.StripeTapToPayPlugin`

## Build Steps

1. Run `npm run build`
2. Run `npx cap copy ios`
3. Re-add `App.StripeTapToPayPlugin` to `ios/App/App/capacitor.config.json`
4. Open `ios/App/App.xcworkspace`
5. In Xcode, use `Product -> Clean Build Folder`
6. Run on a physical iPhone

## Test/Live Mode

- Test/live override is intended for internal use only.
- The UI controls are gated to `super_admin`.
- Normal users use the app's default Stripe environment.

## Location Mapping

- `Stuart Kitchen - Tap to Pay (Active)` is the live location
- `Stuart Kitchen - Tap to Pay (TEST)` is the test location

If a live user gets an error saying the request is in live mode but the location is in test mode, update that user's `terminal_settings.stripe_location_id` to the live `tml_...` location.

## Notes

- Native Tap to Pay flow now respects the stored Stripe mode instead of being hardcoded to test.
- The edge function `create-terminal-payment-intent` must support both request headers and `forceStripeMode` in the body.
