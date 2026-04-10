

## Problem: "No appointments available" flash on date click

**Root cause — a race condition in the overflow check:**

1. Customer clicks a date
2. `existingAppointments` query starts loading (value is `undefined`)
3. `baseSlots` returns `[]` because of the guard `if (!existingAppointments) return []`
4. `availableSlots` is therefore `[]`
5. The overflow `useEffect` (line 363) fires because `availableSlots.length === 0`, calls the edge function
6. Edge function returns `primaryAvailable: false` with empty `coverOptions`
7. `overflowState` is set to `{ isOverflow: true, coverOptions: [] }`
8. The UI now shows `CoverRecommendationCard` with zero options (the "no appointments" message)
9. When `existingAppointments` finally loads, `baseSlots` recalculates with real available slots — but the overflow effect at line 365 has `if (overflowState?.isOverflow) return`, so it **never rechecks**

The customer sees "fully booked" when slots actually exist. They have to click the date again (which resets `overflowState` via the date-change effect at line 121) to see the real slots.

## Fix

Two changes in `SalonCheckout.tsx`:

1. **Guard the overflow effect** — don't run it until `existingAppointments` has actually loaded (is not `undefined`). Add `existingAppointments` to the dependency check:
   ```ts
   // Line ~364: add guard
   if (!date || !service || overflowState?.isOverflow || existingAppointments === undefined) return;
   ```

2. **Add `existingAppointments` to the effect's dependency array** (line 405) so it re-runs once data arrives:
   ```ts
   }, [date, service, staff.id, availableSlots.length, existingAppointments]);
   ```

This ensures the overflow/cover network check only triggers after real appointment data has loaded, preventing the false "fully booked" flash.

