-- 1. Add handle + marketing_opt_in to organizer_profiles
ALTER TABLE public.organizer_profiles
  ADD COLUMN IF NOT EXISTS handle text,
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false;

-- backfill handle from org_name
UPDATE public.organizer_profiles
  SET handle = lower(regexp_replace(coalesce(org_name, 'org'), '[^a-zA-Z0-9]+', '-', 'g'))
              || '-' || substr(id::text, 1, 6)
  WHERE handle IS NULL;

ALTER TABLE public.organizer_profiles
  ALTER COLUMN handle SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS organizer_profiles_handle_key
  ON public.organizer_profiles (handle);

-- 2. Orders: marketing_opt_in
ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false;

-- 3. Fee bump: 5 -> 10 default for already-locked orgs that match the old default
UPDATE public.organizer_profiles SET fee_locked_pct = 10 WHERE fee_locked_pct = 5;

-- Update the bump trigger function to lock at 10%
CREATE OR REPLACE FUNCTION public.bump_organizer_publish_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if new.status = 'published' and (old.status is distinct from 'published') then
    update public.organizer_profiles
      set
        events_published_count = events_published_count + 1,
        fee_locked_pct = coalesce(fee_locked_pct, 10)
      where id = new.organizer_id;
  end if;
  return new;
end;
$function$;

-- Make sure the trigger is wired on events
DROP TRIGGER IF EXISTS trg_bump_organizer_publish_count ON public.events;
CREATE TRIGGER trg_bump_organizer_publish_count
  AFTER UPDATE OF status ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.bump_organizer_publish_count();

-- 4. Make sure the signup trigger exists on auth.users (was missing)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- 5. Harden handle_new_user so a failure inserting role doesn't kill signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  begin
    insert into public.profiles (id, full_name, avatar_url, country)
    values (
      new.id,
      coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', ''),
      new.raw_user_meta_data->>'avatar_url',
      coalesce(new.raw_user_meta_data->>'country', 'Kenya')
    )
    on conflict (id) do nothing;
  exception when others then
    raise warning 'handle_new_user profile insert failed: %', sqlerrm;
  end;

  begin
    insert into public.user_roles (user_id, role)
    values (new.id, 'attendee')
    on conflict (user_id, role) do nothing;
  exception when others then
    raise warning 'handle_new_user role insert failed: %', sqlerrm;
  end;

  return new;
end;
$function$;