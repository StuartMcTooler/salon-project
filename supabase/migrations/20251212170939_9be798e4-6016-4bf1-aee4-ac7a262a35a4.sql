-- Add allowed_terminal_types column to staff_members for payment method governance
-- Solo creatives (owners) get full access, added staff default to business_reader only
ALTER TABLE public.staff_members 
ADD COLUMN allowed_terminal_types text[] DEFAULT ARRAY['business_reader'];

-- Add payment_processed_by for audit trail - tracks which staff member processed each payment
ALTER TABLE public.salon_appointments
ADD COLUMN payment_processed_by uuid REFERENCES public.staff_members(id);

-- Create index for audit queries
CREATE INDEX idx_appointments_payment_processed_by ON public.salon_appointments(payment_processed_by);

-- Add comment for documentation
COMMENT ON COLUMN public.staff_members.allowed_terminal_types IS 'Payment methods this staff member can use: tap_to_pay, bluetooth, business_reader';
COMMENT ON COLUMN public.salon_appointments.payment_processed_by IS 'Staff member who processed the payment (for audit trail)';