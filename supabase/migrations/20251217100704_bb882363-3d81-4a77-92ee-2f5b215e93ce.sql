-- Add payment_intent_id column to salon_appointments for tracking Stripe payments and enabling automatic refunds
ALTER TABLE public.salon_appointments 
ADD COLUMN payment_intent_id TEXT;

COMMENT ON COLUMN public.salon_appointments.payment_intent_id IS 
'Stripe PaymentIntent ID for tracking deposits and enabling automatic refunds';