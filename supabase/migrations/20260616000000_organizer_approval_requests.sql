-- Organizer approval workflow: signup creates a pending request reviewed by super admin.

CREATE TYPE public.organizer_approval_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE public.organizer_approval_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  org_name text NOT NULL,
  full_name text,
  email text NOT NULL,
  country text NOT NULL DEFAULT 'Kenya',
  marketing_opt_in boolean NOT NULL DEFAULT false,
  status public.organizer_approval_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

CREATE INDEX organizer_approval_requests_status_idx
  ON public.organizer_approval_requests (status, created_at DESC);

ALTER TABLE public.organizer_approval_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins manage approval requests"
  ON public.organizer_approval_requests FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role IN ('super_admin', 'admin')
    )
  );

CREATE POLICY "Users can view own approval request"
  ON public.organizer_approval_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Organizer signups skip the default attendee role; only guest checkout buyers need no account.
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

  -- Skip attendee role for organizer applicants (identified by org_name in metadata).
  if coalesce(new.raw_user_meta_data->>'org_name', '') = '' then
    begin
      insert into public.user_roles (user_id, role)
      values (new.id, 'attendee')
      on conflict (user_id, role) do nothing;
    exception when others then
      raise warning 'handle_new_user role insert failed: %', sqlerrm;
    end;
  end if;

  return new;
end;
$function$;
