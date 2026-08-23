// Columns on staff_members that are safe to expose to unauthenticated visitors.
// Sensitive fields (email, phone, full_name, rates, user_id, Stripe identifiers) are
// excluded and are not granted to the anon role at the database level.
export const PUBLIC_STAFF_COLUMNS =
  "id, business_id, display_name, bio, profile_image_url, skill_level, is_active, tier, tier_upgraded_at, total_bookings, average_rating, total_reviews, city, area, specialties, next_available_slot, next_available_slot_updated_at, require_booking_deposit, deposit_type, deposit_percentage, deposit_fixed_amount, is_accepting_referrals, minimum_booking_lead_hours, simulate_fully_booked, availability_test_days_from_now, referral_discount_type, referral_discount_value, created_at, updated_at" as const;
