-- Custom Auth Migration - Remove Supabase Auth dependency
-- This migration converts the app to use custom authentication with profiles table only

-- Step 1: Remove foreign key constraint from profiles to auth.users
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Step 2: Add username column (unique)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;

-- Step 3: Create index on username for faster login
CREATE INDEX IF NOT EXISTS profiles_username_idx ON profiles(username);

-- Step 4: Update existing profiles - extract username from email and set default password
UPDATE profiles 
SET username = split_part(email, '@', 1),
    password_hash = 'default123' -- Temporary password for existing users
WHERE username IS NULL;

-- Step 5: Make username NOT NULL after update
ALTER TABLE profiles ALTER COLUMN username SET NOT NULL;

-- Step 6: Remove email column constraint (optional - keeping email for reference)
-- ALTER TABLE profiles ALTER COLUMN email DROP NOT NULL;

-- Note: After this migration, users can log in using username and password directly
-- Default password for existing users is 'default123' - they should change it
