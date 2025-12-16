-- Add stripe_location_id column to terminal_settings for Tap to Pay discovery
ALTER TABLE terminal_settings 
ADD COLUMN stripe_location_id TEXT;

COMMENT ON COLUMN terminal_settings.stripe_location_id IS 
'Stripe Terminal Location ID (tml_xxxxx) required for Tap to Pay reader discovery';