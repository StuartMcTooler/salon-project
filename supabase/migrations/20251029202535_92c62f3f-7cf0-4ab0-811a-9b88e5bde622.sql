-- Refactor pricing model: make staff pricing the primary source
-- Rename base_price to suggested_price and make it nullable

ALTER TABLE services 
RENAME COLUMN base_price TO suggested_price;

ALTER TABLE services 
ALTER COLUMN suggested_price DROP NOT NULL;

COMMENT ON COLUMN services.suggested_price IS 'Optional reference price - actual prices are set per staff member in staff_service_pricing';