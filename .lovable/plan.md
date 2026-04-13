

# Cancellation Notifications Not Being Delivered

## Problem Identified

There are **two separate bugs** causing the "message sent" feedback to show even when no message was actually delivered:

### Bug 1: Silent failures — the UI says "notified" regardless of actual delivery
- In `AppointmentDetailsDialog.tsx` (line 146-148), the toast always says "the customer has been notified" as long as `customer_phone` exists — even if the `send-whatsapp` call fails. The WhatsApp call is fire-and-forget (`.catch(err => console.error(...))`).
- Same pattern in `TodaysAppointments.tsx` (line 87-93) — no user-facing error if the SMS fails.
- In `process-bulk-cancellation/index.ts` (line 161-169), the edge function calls `send-whatsapp` via `supabaseClient.functions.invoke()` from within another edge function. This internal call uses the **service role key**, but `send-whatsapp` has `verify_jwt = false` so that's fine. However, errors from the inner function invoke are silently caught and only logged.

### Bug 2: The `send-whatsapp` function returns `success: true` for test users without sending anything
- If the customer's phone matches a `clients` record with `is_test_user = true`, the function simulates the message and returns `{ success: true, simulated: true }` (line 60-88). The calling code doesn't check for `simulated: true`, so it reports success.

### Bug 3: No `businessId` passed in bulk cancellation
- `process-bulk-cancellation` calls `send-whatsapp` without passing `businessId` (line 164-168). This means:
  - No notification log is created (line 216 in send-whatsapp: `if (businessId)`)
  - No rate limiting is applied (rate limiting queries `notification_logs`)

## Plan

### 1. Fix the notification feedback in cancellation flows
- **`AppointmentDetailsDialog.tsx`**: `await` the `send-whatsapp` call and show different toast messages based on success/failure. If the SMS fails, tell the user "Appointment cancelled but notification failed — please contact the customer manually."
- **`TodaysAppointments.tsx`**: Same fix — await the SMS call and update the toast accordingly.

### 2. Fix bulk cancellation to pass `businessId`
- **`process-bulk-cancellation/index.ts`**: Look up the staff member's `business_id` from `staff_members` table and pass it through to the `send-whatsapp` invocation.

### 3. Handle simulated messages transparently
- In both client-side cancellation flows, check the response for `simulated: true` and adjust the toast: "Appointment cancelled. (Test user — notification simulated, not sent.)"

### 4. Add notification delivery verification
- After the `send-whatsapp` call in `process-bulk-cancellation`, check the response body for errors or simulation flags and reflect that in the result summary.

### Files to modify
- `src/components/booking/AppointmentDetailsDialog.tsx` — await SMS, handle failure
- `src/components/pos/TodaysAppointments.tsx` — await SMS, handle failure  
- `supabase/functions/process-bulk-cancellation/index.ts` — pass `businessId`, check response

