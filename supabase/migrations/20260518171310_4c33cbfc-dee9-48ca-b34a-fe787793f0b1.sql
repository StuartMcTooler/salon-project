-- Deactivate older duplicate active rows, keep newest per staff_id
UPDATE terminal_settings ts
SET is_active = false
WHERE is_active = true
  AND staff_id IS NOT NULL
  AND id NOT IN (
    SELECT DISTINCT ON (staff_id) id
    FROM terminal_settings
    WHERE is_active = true AND staff_id IS NOT NULL
    ORDER BY staff_id, created_at DESC
  );

-- Prevent future duplicates
CREATE UNIQUE INDEX IF NOT EXISTS terminal_settings_one_active_per_staff
  ON terminal_settings (staff_id)
  WHERE is_active = true AND staff_id IS NOT NULL;