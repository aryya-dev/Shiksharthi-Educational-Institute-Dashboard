-- Seed script to create default test users for Shiksharthi OS
-- Roles:
-- 1. Director (director@shiksharthi.com)
-- 2. Admin (admin@shiksharthi.com)
-- 3. Mentor (mentor@shiksharthi.com)
-- Password for all accounts: Shiksharthi@123

-- Enable pgcrypto extension for crypt function
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$
DECLARE
  bgp_id UUID;
  pub_id UUID;
  chp_id UUID;
  
  dir_id UUID := 'd0e65384-90f7-4b82-9e25-05b1069f2122';
  admin_id UUID := 'a1b83526-78e2-45bf-85f4-2f22b7d5a55b';
  mentor_id UUID := 'f2c94637-67d3-46c0-96f3-3c33c8e6b66c';
  
  hashed_password TEXT;
BEGIN
  -- 0. Clean slate: Delete existing test users to avoid key collisions or half-seeded states.
  -- This will cascade delete profiles and branch assignments automatically.
  DELETE FROM auth.users WHERE email IN ('director@shiksharthi.com', 'admin@shiksharthi.com', 'mentor@shiksharthi.com');

  -- Get branch IDs
  SELECT id INTO bgp_id FROM branches WHERE code = 'BGP';
  SELECT id INTO pub_id FROM branches WHERE code = 'PUB';
  SELECT id INTO chp_id FROM branches WHERE code = 'CHP';

  -- Hash the password 'Shiksharthi@123' using bcrypt
  hashed_password := crypt('Shiksharthi@123', gen_salt('bf'));

  -----------------------------------------------------------------------------
  -- 1. Create Director Account (director@shiksharthi.com)
  -----------------------------------------------------------------------------
  -- Auth User
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    phone_change,
    phone_change_token,
    email_change_token_current,
    reauthentication_token
  ) VALUES (
    dir_id,
    '00000000-0000-0000-0000-000000000000',
    'director@shiksharthi.com',
    hashed_password,
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"name": "Director User"}'::jsonb,
    'authenticated',
    'authenticated',
    now(),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    ''
  );

  -- Auth Identity
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    dir_id,
    dir_id,
    json_build_object('sub', dir_id, 'email', 'director@shiksharthi.com')::jsonb,
    'email',
    dir_id::text,
    now(),
    now(),
    now()
  );

  -- Public Profile
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (dir_id, 'director@shiksharthi.com', 'Director User', 'Director');

  -- Branch mappings (Director has access to all branches)
  IF bgp_id IS NOT NULL THEN
    INSERT INTO public.profile_branches (profile_id, branch_id) VALUES (dir_id, bgp_id);
  END IF;
  IF pub_id IS NOT NULL THEN
    INSERT INTO public.profile_branches (profile_id, branch_id) VALUES (dir_id, pub_id);
  END IF;
  IF chp_id IS NOT NULL THEN
    INSERT INTO public.profile_branches (profile_id, branch_id) VALUES (dir_id, chp_id);
  END IF;

  -----------------------------------------------------------------------------
  -- 2. Create Admin Account (admin@shiksharthi.com)
  -----------------------------------------------------------------------------
  -- Auth User
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    phone_change,
    phone_change_token,
    email_change_token_current,
    reauthentication_token
  ) VALUES (
    admin_id,
    '00000000-0000-0000-0000-000000000000',
    'admin@shiksharthi.com',
    hashed_password,
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"name": "Admin User"}'::jsonb,
    'authenticated',
    'authenticated',
    now(),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    ''
  );

  -- Auth Identity
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    admin_id,
    admin_id,
    json_build_object('sub', admin_id, 'email', 'admin@shiksharthi.com')::jsonb,
    'email',
    admin_id::text,
    now(),
    now(),
    now()
  );

  -- Public Profile
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (admin_id, 'admin@shiksharthi.com', 'Admin User', 'Admin');

  -- Branch mappings (Admin assigned to Baguipara branch)
  IF bgp_id IS NOT NULL THEN
    INSERT INTO public.profile_branches (profile_id, branch_id) VALUES (admin_id, bgp_id);
  END IF;

  -----------------------------------------------------------------------------
  -- 3. Create Mentor Account (mentor@shiksharthi.com)
  -----------------------------------------------------------------------------
  -- Auth User
  INSERT INTO auth.users (
    id,
    instance_id,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    aud,
    role,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    phone_change,
    phone_change_token,
    email_change_token_current,
    reauthentication_token
  ) VALUES (
    mentor_id,
    '00000000-0000-0000-0000-000000000000',
    'mentor@shiksharthi.com',
    hashed_password,
    now(),
    '{"provider": "email", "providers": ["email"]}'::jsonb,
    '{"name": "Mentor User"}'::jsonb,
    'authenticated',
    'authenticated',
    now(),
    now(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    ''
  );

  -- Auth Identity
  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    mentor_id,
    mentor_id,
    json_build_object('sub', mentor_id, 'email', 'mentor@shiksharthi.com')::jsonb,
    'email',
    mentor_id::text,
    now(),
    now(),
    now()
  );

  -- Public Profile
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (mentor_id, 'mentor@shiksharthi.com', 'Mentor User', 'Mentor');

  -- Branch mappings (Mentor assigned to Baguipara branch)
  IF bgp_id IS NOT NULL THEN
    INSERT INTO public.profile_branches (profile_id, branch_id) VALUES (mentor_id, bgp_id);
  END IF;
  
END $$;
