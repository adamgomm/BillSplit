-- Fix the expenses table to have proper default values for timestamps

-- Add default values for created_at and updated_at if they don't exist
ALTER TABLE expenses 
ALTER COLUMN created_at SET DEFAULT NOW();

ALTER TABLE expenses 
ALTER COLUMN updated_at SET DEFAULT NOW();

-- Verify the changes
SELECT column_name, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'expenses' 
AND table_schema = 'public'
AND column_name IN ('created_at', 'updated_at')
ORDER BY column_name; 