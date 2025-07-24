-- Simple script to fix the foreign key constraint

-- Step 1: Drop the problematic constraint
ALTER TABLE expenses DROP CONSTRAINT expenses_id_fkey1;

-- Step 2: Add the correct constraint
ALTER TABLE expenses 
ADD CONSTRAINT expenses_user_id_fkey 
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE; 