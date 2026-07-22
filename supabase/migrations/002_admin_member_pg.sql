-- 모스트애드 관리자 회원관리 + PG 결제관리 기본 구조
-- Supabase Dashboard > SQL Editor에서 전체 실행하세요.

alter table public.profiles
  add column if not exists account_status text not null default 'active'
  check (account_status in ('active', 'suspended'));

alter table public.profiles
  add column if not exists admin_note text not null default '';

alter table public.profiles
  add column if not exists last_login_at timestamptz;

create table if not exists public.payment_orders (
  id bigint generated always as identity primary key,
  order_no text not null unique,
  user_id uuid not null references auth.users(id) on delete restrict,
  amount bigint not null check (amount > 0),
  point_amount bigint not null check (point_amount > 0),
  status text not null default 'pending'
    check (status in ('pending','approved','point_granted','failed','canceled','partial_canceled','refunded')),
  payment_method text,
  pg_provider text not null default 'lucypayments',
  pg_tid text,
  auth_no text,
  card_name text,
  approved_at timestamptz,
  canceled_amount bigint not null default 0 check (canceled_amount >= 0),
  raw_result jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_orders_user_created_idx
  on public.payment_orders(user_id, created_at desc);
create index if not exists payment_orders_status_created_idx
  on public.payment_orders(status, created_at desc);

create table if not exists public.admin_logs (
  id bigint generated always as identity primary key,
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  target_user_id uuid references auth.users(id) on delete set null,
  target_payment_id bigint references public.payment_orders(id) on delete set null,
  before_data jsonb,
  after_data jsonb,
  reason text,
  created_at timestamptz not null default now()
);

alter table public.payment_orders enable row level security;
alter table public.admin_logs enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin' and account_status = 'active'
  );
$$;

-- 관리자는 전체 회원을 조회/수정할 수 있습니다.
drop policy if exists "profiles_admin_select_all" on public.profiles;
create policy "profiles_admin_select_all"
on public.profiles for select
to authenticated
using (public.is_admin());

drop policy if exists "profiles_admin_update_all" on public.profiles;
create policy "profiles_admin_update_all"
on public.profiles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 회원은 본인 결제내역, 관리자는 전체 결제내역을 조회할 수 있습니다.
drop policy if exists "payment_orders_select_own_or_admin" on public.payment_orders;
create policy "payment_orders_select_own_or_admin"
on public.payment_orders for select
to authenticated
using (auth.uid() = user_id or public.is_admin());

drop policy if exists "payment_orders_admin_manage" on public.payment_orders;
create policy "payment_orders_admin_manage"
on public.payment_orders for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admin_logs_admin_only" on public.admin_logs;
create policy "admin_logs_admin_only"
on public.admin_logs for select
to authenticated
using (public.is_admin());

-- 관리자 포인트 지급/차감: 잔액 변경과 거래내역, 관리자 로그를 한 번에 처리합니다.
create or replace function public.admin_adjust_points(
  p_user_id uuid,
  p_amount bigint,
  p_direction text,
  p_reason text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_before bigint;
  v_after bigint;
begin
  if not public.is_admin() then
    raise exception '관리자 권한이 필요합니다.';
  end if;
  if p_amount <= 0 then
    raise exception '포인트는 1 이상이어야 합니다.';
  end if;
  if p_direction not in ('add', 'subtract') then
    raise exception '올바르지 않은 처리 방향입니다.';
  end if;

  select point_balance into v_before
  from public.profiles
  where id = p_user_id
  for update;

  if v_before is null then
    raise exception '회원을 찾을 수 없습니다.';
  end if;

  if p_direction = 'subtract' and v_before < p_amount then
    raise exception '보유 포인트보다 많이 차감할 수 없습니다.';
  end if;

  v_after := case when p_direction = 'add' then v_before + p_amount else v_before - p_amount end;

  update public.profiles
  set point_balance = v_after, updated_at = now()
  where id = p_user_id;

  insert into public.point_transactions
    (user_id, transaction_type, amount, balance_after, description)
  values
    (p_user_id, 'admin_adjustment', p_amount, v_after,
     case when p_direction = 'add' then '[관리자 지급] ' else '[관리자 차감] ' end || p_reason);

  insert into public.admin_logs
    (admin_user_id, action, target_user_id, before_data, after_data, reason)
  values
    (v_admin, 'point_' || p_direction, p_user_id,
     jsonb_build_object('point_balance', v_before),
     jsonb_build_object('point_balance', v_after), p_reason);

  return v_after;
end;
$$;

-- 회원 상태와 관리자 메모 변경
create or replace function public.admin_update_member(
  p_user_id uuid,
  p_status text,
  p_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before jsonb;
begin
  if not public.is_admin() then
    raise exception '관리자 권한이 필요합니다.';
  end if;
  if p_status not in ('active','suspended') then
    raise exception '올바르지 않은 회원 상태입니다.';
  end if;

  select jsonb_build_object('account_status', account_status, 'admin_note', admin_note)
  into v_before from public.profiles where id = p_user_id;

  update public.profiles
  set account_status = p_status, admin_note = coalesce(p_note,''), updated_at = now()
  where id = p_user_id;

  insert into public.admin_logs
    (admin_user_id, action, target_user_id, before_data, after_data)
  values
    (auth.uid(), 'member_update', p_user_id, v_before,
     jsonb_build_object('account_status', p_status, 'admin_note', coalesce(p_note,'')));
end;
$$;

-- 최초 관리자 지정 예시: 아래 이메일을 실제 관리자 이메일로 바꿔 한 번만 실행하세요.
-- update public.profiles set role = 'admin' where email = 'admin@example.com';
