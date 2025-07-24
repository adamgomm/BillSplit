-- Test script to verify expenses table structure and basic operations

-- 1. Check if the table exists and view its structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'expenses' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Check RLS policies
SELECT * FROM pg_policies WHERE tablename = 'expenses';

-- 3. Test a simple insert (you can replace the user_id with your actual user ID)
-- First, check your user ID:
SELECT auth.uid() as current_user_id;

-- 4. Try a test insert (replace 'your-user-id-here' with actual ID from above query)
-- INSERT INTO expenses (
--     title,
--     amount,
--     date,
--     paid_by,
--     split_with,
--     user_id
-- ) VALUES (
--     'Test Expense',
--     25.50,
--     '2025-01-02',
--     'You',
--     ARRAY['You', 'Friend'],
--     'your-user-id-here'
-- );

-- 5. Check if the insert worked
-- SELECT * FROM expenses WHERE title = 'Test Expense'; 