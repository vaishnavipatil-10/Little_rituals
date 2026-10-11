-- Little Rituals initial schema. Apply once to a new Supabase project.
-- Supabase Auth owns identities; app tables reference auth.users and never accept client-supplied ownership.
create extension if not exists pgcrypto;

create type public.product_category as enum ('cleanser','toner','serum','moisturizer','sunscreen','exfoliant','mask','treatment','other');
create type public.product_status as enum ('using','finished','expired','irritated');
create type public.routine_type as enum ('morning','night','weekly');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 80),
  avatar_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.skin_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  skin_type text check (skin_type in ('oily','dry','combination','sensitive','normal')),
  concerns text[] not null default '{}',
  avoid_ingredients text[] not null default '{}',
  goals text[] not null default '{}',
  updated_at timestamptz not null default now()
);

create table public.ingredients (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  summary text not null,
  uses text[] not null default '{}',
  benefits text[] not null default '{}',
  cautions text[] not null default '{}',
  suitable_skin_types text[] not null default '{}',
  caution_skin_types text[] not null default '{}',
  tags text[] not null default '{}',
  guidance text,
  interactions text[] not null default '{}',
  reviewed_at date,
  created_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 160),
  brand text check (char_length(brand) <= 120),
  category public.product_category not null default 'other',
  image_path text,
  price numeric(10,2) check (price is null or price >= 0),
  currency char(3),
  ingredients_text text,
  purchase_date date,
  opened_date date,
  expiry_date date,
  pao_months smallint check (pao_months is null or pao_months between 1 and 60),
  status public.product_status not null default 'using',
  rating smallint check (rating is null or rating between 1 and 5),
  notes text,
  would_repurchase boolean,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index products_user_status_idx on public.products(user_id, status);
create index products_user_expiry_idx on public.products(user_id, expiry_date) where expiry_date is not null;

create table public.product_ingredients (
  product_id uuid not null references public.products(id) on delete cascade,
  ingredient_id uuid not null references public.ingredients(id) on delete cascade,
  source text not null default 'user' check (source in ('user','curated')),
  primary key (product_id, ingredient_id)
);

create table public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  routine_type public.routine_type not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name, routine_type)
);
create index routines_user_type_idx on public.routines(user_id, routine_type);

create table public.routine_steps (
  id uuid primary key default gen_random_uuid(),
  routine_id uuid not null references public.routines(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  step_type text not null,
  position smallint not null check (position >= 0),
  notes text,
  wait_seconds integer check (wait_seconds is null or wait_seconds between 0 and 7200),
  enabled boolean not null default true,
  unique (routine_id, position)
);

create table public.routine_completions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  routine_id uuid not null references public.routines(id) on delete cascade,
  completed_on date not null default current_date,
  completed_steps integer not null default 0 check (completed_steps >= 0),
  total_steps integer not null default 0 check (total_steps >= completed_steps),
  completed_at timestamptz not null default now(),
  unique (routine_id, completed_on)
);
create index routine_completions_user_date_idx on public.routine_completions(user_id, completed_on desc);

create table public.journal_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  entry_date date not null default current_date,
  skin_rating smallint check (skin_rating is null or skin_rating between 1 and 5),
  skin_condition text,
  mood text,
  sleep_hours numeric(4,2) check (sleep_hours is null or sleep_hours between 0 and 24),
  concerns text[] not null default '{}',
  notes text,
  photo_path text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);
create index journal_entries_user_date_idx on public.journal_entries(user_id, entry_date desc);

create table public.user_settings (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  water_goal_ml integer not null default 2000 check (water_goal_ml between 250 and 10000),
  volume_unit text not null default 'ml' check (volume_unit in ('ml','l','oz')),
  cycle_tracking_enabled boolean not null default false,
  reminder_preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.water_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount_ml integer not null check (amount_ml between 1 and 5000),
  logged_at timestamptz not null default now(),
  entry_date date generated always as ((logged_at at time zone 'UTC')::date) stored
);
create index water_entries_user_date_idx on public.water_entries(user_id, entry_date desc);

-- Set updated_at consistently for mutable records.
create function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;
create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger skin_profiles_updated_at before update on public.skin_profiles for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger routines_updated_at before update on public.routines for each row execute function public.set_updated_at();
create trigger journal_entries_updated_at before update on public.journal_entries for each row execute function public.set_updated_at();
create trigger user_settings_updated_at before update on public.user_settings for each row execute function public.set_updated_at();

-- New auth identities receive private profile and settings rows.
create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name) values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name',''));
  insert into public.skin_profiles (user_id) values (new.id);
  insert into public.user_settings (user_id) values (new.id);
  return new;
end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- RLS is enabled for every app table. Catalog ingredients are readable without authentication.
alter table public.profiles enable row level security;
alter table public.skin_profiles enable row level security;
alter table public.ingredients enable row level security;
alter table public.products enable row level security;
alter table public.product_ingredients enable row level security;
alter table public.routines enable row level security;
alter table public.routine_steps enable row level security;
alter table public.routine_completions enable row level security;
alter table public.journal_entries enable row level security;
alter table public.user_settings enable row level security;
alter table public.water_entries enable row level security;

create policy "Public read ingredient catalog" on public.ingredients for select using (true);
create policy "Users manage own profile" on public.profiles for all using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy "Users manage own skin profile" on public.skin_profiles for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users manage own products" on public.products for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users manage ingredients for own products" on public.product_ingredients for all using (exists (select 1 from public.products p where p.id = product_id and p.user_id = (select auth.uid()))) with check (exists (select 1 from public.products p where p.id = product_id and p.user_id = (select auth.uid())));
create policy "Users manage own routines" on public.routines for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users manage steps in own routines" on public.routine_steps for all
  using (
    exists (select 1 from public.routines r where r.id = routine_id and r.user_id = (select auth.uid()))
    and (product_id is null or exists (
      select 1 from public.products p where p.id = routine_steps.product_id and p.user_id = (select auth.uid())
    ))
  )
  with check (
    exists (select 1 from public.routines r where r.id = routine_id and r.user_id = (select auth.uid()))
    and (product_id is null or exists (
      select 1 from public.products p where p.id = routine_steps.product_id and p.user_id = (select auth.uid())
    ))
  );
create policy "Users manage own completions" on public.routine_completions for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()) and exists (select 1 from public.routines r where r.id = routine_id and r.user_id = (select auth.uid())));
create policy "Users manage own journal" on public.journal_entries for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users manage own settings" on public.user_settings for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "Users manage own water entries" on public.water_entries for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- SQL Editor-created tables may not inherit the project's default API grants; grant table access
-- explicitly, with RLS remaining the row-level authorization boundary.
grant select on public.ingredients to anon, authenticated;
grant select, insert, update, delete on public.profiles, public.skin_profiles, public.products,
  public.product_ingredients, public.routines, public.routine_steps, public.routine_completions,
  public.journal_entries, public.user_settings, public.water_entries to authenticated;
