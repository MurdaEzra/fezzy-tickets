create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  provider text not null default 'mpesa',
  amount_kes integer not null,
  phone text not null,
  merchant_request_id text,
  checkout_request_id text unique,
  mpesa_receipt text,
  status text not null default 'pending',
  result_code integer,
  result_desc text,
  raw_callback jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_order_id_idx on public.payments(order_id);
create index if not exists payments_checkout_request_id_idx on public.payments(checkout_request_id);

alter table public.payments enable row level security;

create policy "Users view own payments via orders"
on public.payments for select
using (
  order_id in (select id from public.orders where user_id = auth.uid())
  or has_role(auth.uid(), 'admin'::app_role)
  or has_role(auth.uid(), 'super_admin'::app_role)
);

create trigger payments_updated_at
before update on public.payments
for each row execute function public.handle_updated_at();