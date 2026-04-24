
-- Enums
create type public.event_status as enum ('draft', 'published', 'cancelled', 'completed');
create type public.order_status as enum ('pending', 'paid', 'failed', 'refunded');
create type public.ticket_status as enum ('valid', 'used', 'refunded', 'cancelled');

-- Organizer profiles
create table public.organizer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  org_name text not null,
  logo_url text,
  bio text,
  website text,
  contact_email text,
  contact_phone text,
  mpesa_till text,
  payout_method text default 'mpesa',
  events_published_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.organizer_profiles enable row level security;

create policy "Organizer profiles viewable by everyone"
  on public.organizer_profiles for select using (true);
create policy "Users insert own organizer profile"
  on public.organizer_profiles for insert with check (auth.uid() = user_id);
create policy "Users update own organizer profile"
  on public.organizer_profiles for update using (auth.uid() = user_id);
create policy "Admins manage organizer profiles"
  on public.organizer_profiles for all using (public.has_role(auth.uid(), 'admin'));

create trigger trg_organizer_profiles_updated_at
  before update on public.organizer_profiles
  for each row execute function public.handle_updated_at();

-- Events
create table public.events (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizer_profiles(id) on delete cascade,
  slug text not null unique,
  title text not null,
  tagline text,
  description text,
  category text,
  cover_image_url text,
  poster_url text,
  ticket_design jsonb not null default '{"theme":"savannah","accent":"#facc15","pattern":"none"}'::jsonb,
  venue_name text,
  venue_address text,
  city text default 'Nairobi',
  country text default 'Kenya',
  latitude double precision,
  longitude double precision,
  starts_at timestamptz not null,
  ends_at timestamptz,
  is_stream boolean not null default false,
  stream_url text,
  status public.event_status not null default 'draft',
  fee_waived boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_events_organizer on public.events(organizer_id);
create index idx_events_status on public.events(status);
create index idx_events_starts_at on public.events(starts_at);
create index idx_events_is_stream on public.events(is_stream);

alter table public.events enable row level security;

create policy "Published events viewable by everyone"
  on public.events for select
  using (status = 'published' or organizer_id in (
    select id from public.organizer_profiles where user_id = auth.uid()
  ) or public.has_role(auth.uid(), 'admin'));

create policy "Organizers insert own events"
  on public.events for insert
  with check (organizer_id in (
    select id from public.organizer_profiles where user_id = auth.uid()
  ));

create policy "Organizers update own events"
  on public.events for update
  using (organizer_id in (
    select id from public.organizer_profiles where user_id = auth.uid()
  ));

create policy "Organizers delete own events"
  on public.events for delete
  using (organizer_id in (
    select id from public.organizer_profiles where user_id = auth.uid()
  ));

create policy "Admins manage events"
  on public.events for all using (public.has_role(auth.uid(), 'admin'));

create trigger trg_events_updated_at
  before update on public.events
  for each row execute function public.handle_updated_at();

-- Ticket tiers
create table public.ticket_tiers (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  name text not null,
  description text,
  price_kes integer not null default 0,
  quantity integer not null default 100,
  sold integer not null default 0,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index idx_ticket_tiers_event on public.ticket_tiers(event_id);

alter table public.ticket_tiers enable row level security;

create policy "Tiers viewable when event viewable"
  on public.ticket_tiers for select
  using (event_id in (
    select id from public.events where status = 'published'
      or organizer_id in (select id from public.organizer_profiles where user_id = auth.uid())
  ) or public.has_role(auth.uid(), 'admin'));

create policy "Organizers manage own tiers"
  on public.ticket_tiers for all
  using (event_id in (
    select e.id from public.events e
    join public.organizer_profiles op on op.id = e.organizer_id
    where op.user_id = auth.uid()
  ));

create policy "Admins manage tiers"
  on public.ticket_tiers for all using (public.has_role(auth.uid(), 'admin'));

-- Orders
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  user_id uuid,
  guest_name text not null,
  guest_email text not null,
  guest_phone text not null,
  subtotal_kes integer not null default 0,
  organizer_fee_kes integer not null default 0,
  fee_waived boolean not null default false,
  total_kes integer not null default 0,
  payment_method text not null default 'mpesa',
  status public.order_status not null default 'pending',
  payment_ref text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_orders_event on public.orders(event_id);
create index idx_orders_user on public.orders(user_id);
create index idx_orders_email on public.orders(guest_email);

alter table public.orders enable row level security;

-- Anyone (incl. guests) can create an order
create policy "Anyone can create orders"
  on public.orders for insert with check (true);

-- Buyers see their own orders; organizers see orders for their events
create policy "View own or organizer orders"
  on public.orders for select
  using (
    user_id = auth.uid()
    or event_id in (
      select e.id from public.events e
      join public.organizer_profiles op on op.id = e.organizer_id
      where op.user_id = auth.uid()
    )
    or public.has_role(auth.uid(), 'admin')
  );

create policy "Admins manage orders"
  on public.orders for all using (public.has_role(auth.uid(), 'admin'));

create trigger trg_orders_updated_at
  before update on public.orders
  for each row execute function public.handle_updated_at();

-- Tickets
create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  tier_id uuid not null references public.ticket_tiers(id),
  holder_name text not null,
  holder_email text not null,
  qr_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  status public.ticket_status not null default 'valid',
  checked_in_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_tickets_order on public.tickets(order_id);
create index idx_tickets_event on public.tickets(event_id);
create index idx_tickets_qr on public.tickets(qr_token);

alter table public.tickets enable row level security;

create policy "Anyone can insert tickets via checkout"
  on public.tickets for insert with check (true);

create policy "View tickets in own orders or own events"
  on public.tickets for select
  using (
    order_id in (select id from public.orders where user_id = auth.uid())
    or event_id in (
      select e.id from public.events e
      join public.organizer_profiles op on op.id = e.organizer_id
      where op.user_id = auth.uid()
    )
    or public.has_role(auth.uid(), 'admin')
  );

create policy "Organizers update own event tickets"
  on public.tickets for update
  using (event_id in (
    select e.id from public.events e
    join public.organizer_profiles op on op.id = e.organizer_id
    where op.user_id = auth.uid()
  ));

create policy "Admins manage tickets"
  on public.tickets for all using (public.has_role(auth.uid(), 'admin'));

-- Trigger: increment organizer events_published_count on first publish
create or replace function public.bump_organizer_publish_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published' and (old.status is distinct from 'published') then
    update public.organizer_profiles
      set events_published_count = events_published_count + 1
      where id = new.organizer_id;
  end if;
  return new;
end;
$$;

create trigger trg_events_publish_count
  after insert or update of status on public.events
  for each row execute function public.bump_organizer_publish_count();

-- Storage buckets for posters and organizer logos
insert into storage.buckets (id, name, public) values ('event-assets', 'event-assets', true)
  on conflict (id) do nothing;

create policy "Event assets publicly readable"
  on storage.objects for select using (bucket_id = 'event-assets');

create policy "Authenticated users can upload event assets"
  on storage.objects for insert
  with check (bucket_id = 'event-assets' and auth.uid() is not null);

create policy "Users update own event assets"
  on storage.objects for update
  using (bucket_id = 'event-assets' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users delete own event assets"
  on storage.objects for delete
  using (bucket_id = 'event-assets' and auth.uid()::text = (storage.foldername(name))[1]);
