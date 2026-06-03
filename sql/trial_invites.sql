-- ============================================================
-- TRIAL INVITES TABLE — Run this in Supabase SQL Editor
-- ============================================================

-- 1. Create the trial_invites table
CREATE TABLE IF NOT EXISTS public.trial_invites (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  invited_at    TIMESTAMPTZ DEFAULT now(),
  email_sent    BOOLEAN DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  registered    BOOLEAN DEFAULT false,
  registered_at TIMESTAMPTZ,
  trial_hours   INT DEFAULT 48,
  trial_expires_at TIMESTAMPTZ,   -- set when user registers (registered_at + trial_hours)
  subscribed    BOOLEAN DEFAULT false,
  subscribed_at TIMESTAMPTZ,
  notes         TEXT
);

-- 2. Add index on email for fast lookups during registration
CREATE INDEX IF NOT EXISTS idx_trial_invites_email
  ON public.trial_invites (LOWER(email));

-- 3. Enable RLS
ALTER TABLE public.trial_invites ENABLE ROW LEVEL SECURITY;

-- 4. Policy: allow anonymous/authenticated users to READ their own row (by email match)
--    This lets the signup form check if an email is on the invite list
CREATE POLICY "Users can check their own invite"
  ON public.trial_invites
  FOR SELECT
  USING (true);   -- public read so the registration check works before auth

-- 5. Policy: only service_role can INSERT/UPDATE/DELETE
--    (admin operations via Supabase dashboard or API endpoints with service key)
CREATE POLICY "Only admins can modify invites"
  ON public.trial_invites
  FOR ALL
  USING (auth.role() = 'service_role');

-- 6. Add trial_expires_at column to profiles table (if it doesn't already exist)
--    This stores the trial expiry for each registered user
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'trial_expires_at'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN trial_expires_at TIMESTAMPTZ;
  END IF;
END $$;

-- 7. Add subscribed column to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'subscribed'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN subscribed BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 8. Function: auto-set trial expiry when a new user registers
--    This trigger fires on profiles INSERT and looks up the trial_invites table
CREATE OR REPLACE FUNCTION public.set_trial_from_invite()
RETURNS TRIGGER AS $$
DECLARE
  invite_row public.trial_invites%ROWTYPE;
  user_email TEXT;
BEGIN
  -- Get the user's email from auth.users
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = NEW.id;

  -- Look up the invite
  SELECT * INTO invite_row
  FROM public.trial_invites
  WHERE LOWER(email) = LOWER(user_email);

  IF FOUND THEN
    -- Set trial expiry on the profile
    NEW.trial_expires_at := now() + (invite_row.trial_hours || ' hours')::INTERVAL;
    NEW.approved := true;  -- auto-approve invited users

    -- Mark the invite as registered
    UPDATE public.trial_invites
    SET registered = true,
        registered_at = now(),
        trial_expires_at = NEW.trial_expires_at
    WHERE LOWER(email) = LOWER(user_email);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 9. Create the trigger (drop first if exists to allow re-running)
DROP TRIGGER IF EXISTS on_profile_created_set_trial ON public.profiles;
CREATE TRIGGER on_profile_created_set_trial
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_trial_from_invite();

-- ============================================================
-- TO IMPORT YOUR CSV:
--
-- After running this SQL, go to Table Editor > trial_invites
-- and use the "Import data" button to upload your CSV.
-- Your CSV should have columns: name, email
-- (other columns will default automatically)
--
-- Or insert manually:
-- INSERT INTO public.trial_invites (name, email) VALUES
--   ('John Smith', 'john@example.com'),
--   ('Jane Doe', 'jane@example.com');
-- ============================================================
