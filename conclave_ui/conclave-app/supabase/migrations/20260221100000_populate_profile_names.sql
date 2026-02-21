-- Migration: Populate profile names from OAuth metadata
-- Fixes BUG-002: Dashboard greeting shows "there" instead of user's name
--
-- Problem: handle_new_user() trigger only stored id and email, ignoring
-- the display name available in auth.users.raw_user_meta_data for OAuth users.

-- 1. Update trigger to extract name from OAuth metadata for future signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, referral_code)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name',
      NULL
    ),
    UPPER(SUBSTRING(MD5(NEW.id::TEXT || NOW()::TEXT) FROM 1 FOR 8))
  );

  INSERT INTO public.balances (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Backfill existing users who have a name in auth metadata but not in profiles
UPDATE public.profiles p
SET name = COALESCE(
  u.raw_user_meta_data->>'full_name',
  u.raw_user_meta_data->>'name'
)
FROM auth.users u
WHERE p.id = u.id
  AND p.name IS NULL
  AND (u.raw_user_meta_data->>'full_name' IS NOT NULL
    OR u.raw_user_meta_data->>'name' IS NOT NULL);
