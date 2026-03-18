

# Appointment Reminders: Final Implementation Plan

## What We're Keeping From the Suggestion
- Range queries using `.gte()` and `.lt()` on `appointment_date` (timestamptz) -- this is the correct approach
- Business hours guard (9am-6pm Dublin time)
- The 2-day / 1-day reminder concept

## What We're Fixing From the Suggestion
The suggested code had several mismatches with your actual database:

| Suggested Code | Your Actual Setup |
|---|---|
| Table: `appointments` | Table: `salon_appointments` |
| Join: `profiles:client_id(*)` | Direct columns: `customer_name`, `customer_phone` |
| Mock SMS logging | Real SMS via `send-whatsapp` edge function |
| `.lte('T23:59:59')` | `.lt('next day T00:00:00')` (no missed edge cases) |
| Heavily commented timezone experiments | Clean implementation |

## Implementation

### File: `supabase/functions/send-appointment-reminders/index.ts`

Complete rewrite of the function logic:

1. **Business hours guard**: Get current hour in `Europe/Dublin` using `Intl.DateTimeFormat`. If before 9 or 18+, return early with a 200 response.

2. **Day boundary calculation**: 
   - Get today's date string in Dublin timezone using `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Dublin' })`
   - For 2-day reminder: target = today + 2 days
   - For 1-day reminder: target = today + 1 day
   - Range: `.gte(targetDate + 'T00:00:00+00:00')` and `.lt(nextDate + 'T00:00:00+00:00')`
   - UTC boundaries are acceptable since Ireland is UTC+0 (winter) or UTC+1 (summer), and all appointments are during business hours (9am-6pm)

3. **2-day reminder query**:
   - Table: `salon_appointments`
   - Columns: `id, customer_name, customer_phone, service_name, appointment_date, staff_id, duration_minutes, price`
   - Filters: status in ('pending', 'confirmed'), `reminder_72h_sent_at` is null, date in 2-day range
   - Send via `send-whatsapp` with message: "Your appointment with {staff} is in 2 days..."
   - Mark `reminder_72h_sent_at` on success

4. **1-day reminder query**: Same structure but for tomorrow, using `reminder_24h_sent_at` column, message says "Tomorrow!"

5. **Staff name lookup**: Reuse existing cache pattern from current code (query `staff_members.display_name`)

6. **SMS sending**: Call existing `send-whatsapp` edge function (which handles test user simulation, rate limiting, and Twilio SMS delivery)

### No Other Changes Needed
- No database migrations (reusing existing columns)
- No cron job changes (hourly schedule continues)
- No other files affected

