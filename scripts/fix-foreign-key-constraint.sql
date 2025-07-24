-- Fix the foreign key constraint to reference auth.users instead of users

-- 1. First, let's see what constraints exist
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    tc.table_name,
    ccu.column_name
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu 
    ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'expenses'
AND tc.table_schema = 'public';

-- 2. Drop the existing incorrect foreign key constraint
ALTER TABLE expenses 
DROP CONSTRAINT IF EXISTS expenses_id_fkey1;

-- 3. Add the correct foreign key constraint that references auth.users
ALTER TABLE expenses 
ADD CONSTRAINT expenses_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. Verify the new constraint
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu 
    ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'expenses'
AND tc.constraint_type = 'FOREIGN KEY'; 