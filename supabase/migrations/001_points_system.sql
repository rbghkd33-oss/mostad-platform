-- 모스트애드 회원 포인트 시스템
-- Supabase Dashboard > SQL Editor에서 전체 실행하세요.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  manager_name text,
  company_name text,
  phone text,
  point_balance bigint not null default 0 check (point_balance >= 0),
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.point_transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_type text not null check (transaction_type in ('charge', 'use', 'refund', 'admin_adjustment')),
  amount bigint not null check (amount > 0),
  balance_after bigint not null check (balance_after >= 0),
  description text not null,
  payment_id text,
  created_at timestamptz not null default now()
);

create index if not exists point_transactions_user_created_idx
  on public.point_transactions(user_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.point_transactions enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
on public.profiles for select
to authenticated
using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists "point_transactions_select_own" on public.point_transactions;
create policy "point_transactions_select_own"
on public.point_transactions for select
to authenticated
using (auth.uid() = user_id);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, manager_name, company_name, phone, point_balance)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'manager_name', ''),
    coalesce(new.raw_user_meta_data ->> 'company_name', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    0
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- 이미 가입한 회원도 profiles에 생성합니다.
insert into public.profiles (id, email, manager_name, company_name, phone, point_balance)
select
  id,
  email,
  coalesce(raw_user_meta_data ->> 'manager_name', ''),
  coalesce(raw_user_meta_data ->> 'company_name', ''),
  coalesce(raw_user_meta_data ->> 'phone', ''),
  0
from auth.users
on conflict (id) do nothing;
