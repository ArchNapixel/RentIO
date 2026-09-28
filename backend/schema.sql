-- RentIO database schema.
-- Run once in Supabase: SQL Editor > New query > paste this whole file > Run.

create table properties (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,  -- the account this belongs to
  name        text not null,
  address     text,
  type        text not null check (type in ('Boarding house', 'Dormitory', 'Apartment', 'Condominium', 'House')),
  capacity    int check (capacity > 0),           -- total persons; required for boarding houses and dormitories
  created_at  timestamptz not null default now(),
  constraint capacity_required_for_shared check (type not in ('Boarding house', 'Dormitory') or capacity is not null)
);

create table tenants (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid not null references auth.users (id) on delete cascade,
  property_id      uuid not null references properties (id) on delete restrict,
  name             text not null,
  monthly_rent     numeric(12, 2) check (monthly_rent >= 0),
  move_in_date     date,                          -- rent is due from this month onward
  phone            text,
  email            text,
  emergency_name   text,
  emergency_phone  text,
  notes            text,
  archived         boolean not null default false,
  created_at       timestamptz not null default now()
);
create index tenants_property_id_idx on tenants (property_id);
create index tenants_owner_idx on tenants (owner_id);
create index properties_owner_idx on properties (owner_id);

-- One row = that tenant paid that month. Unchecking the box deletes the row.
create table rent_payments (
  owner_id   uuid not null references auth.users (id) on delete cascade,
  tenant_id  uuid not null references tenants (id) on delete cascade,
  year       int not null check (year between 2000 and 2100),
  month      int not null check (month between 1 and 12),
  amount     numeric(12, 2) not null default 0,  -- the tenant's monthly rent when it was marked paid
  paid_at    timestamptz not null default now(),
  primary key (tenant_id, year, month)
);
create index rent_payments_owner_idx on rent_payments (owner_id);

-- Nena's activity log: every change she made after the owner tapped Confirm.
create table nena_actions (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,  -- the account this belongs to
  tool        text not null,
  args        jsonb not null,
  summary     text not null,
  created_at  timestamptz not null default now()
);
create index nena_actions_owner_idx on nena_actions (owner_id);
alter table nena_actions enable row level security;

-- Lock the tables: no access with the publishable/anon keys.
-- Only the RentIO backend (secret key, which bypasses RLS) can read and write.
alter table properties    enable row level security;
alter table tenants       enable row level security;
alter table rent_payments enable row level security;
