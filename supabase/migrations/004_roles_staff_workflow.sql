-- 모스트애드 역할/직원/업무 배정 시스템 v14
-- Supabase SQL Editor에서 전체 실행하세요.

-- 기존 role 체크 제약을 제거하고 4단계 권한으로 확장합니다.
do $$
declare r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%role%'
  loop
    execute format('alter table public.profiles drop constraint %I', r.conname);
  end loop;
end $$;

alter table public.profiles
  alter column role set default 'user';

alter table public.profiles
  add constraint profiles_role_check
  check (role in ('user','staff','admin','super_admin'));

-- 회원가입 당시 메타데이터 키가 달랐던 기존 회원 정보 복구
update public.profiles p
set
  manager_name = coalesce(nullif(p.manager_name,''), u.raw_user_meta_data->>'manager_name', u.raw_user_meta_data->>'name', ''),
  company_name = coalesce(nullif(p.company_name,''), u.raw_user_meta_data->>'company_name', u.raw_user_meta_data->>'company', ''),
  phone = coalesce(nullif(p.phone,''), u.raw_user_meta_data->>'phone', '')
from auth.users u
where p.id = u.id;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, manager_name, company_name, phone, point_balance, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'manager_name', new.raw_user_meta_data ->> 'name', ''),
    coalesce(new.raw_user_meta_data ->> 'company_name', new.raw_user_meta_data ->> 'company', ''),
    coalesce(new.raw_user_meta_data ->> 'phone', ''),
    0,
    'user'
  )
  on conflict (id) do update set
    email = excluded.email,
    manager_name = case when public.profiles.manager_name = '' then excluded.manager_name else public.profiles.manager_name end,
    company_name = case when public.profiles.company_name = '' then excluded.company_name else public.profiles.company_name end,
    phone = case when public.profiles.phone = '' then excluded.phone else public.profiles.phone end;
  return new;
end;
$$;

create or replace function public.current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid() and account_status = 'active';
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() in ('admin','super_admin'), false);
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() = 'super_admin', false);
$$;

create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.current_role() in ('staff','admin','super_admin'), false);
$$;

-- 최고관리자만 가입 회원의 권한을 변경할 수 있습니다.
create or replace function public.super_admin_set_role(
  p_user_id uuid,
  p_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_before text;
begin
  if not public.is_super_admin() then
    raise exception '최고관리자만 권한을 변경할 수 있습니다.';
  end if;
  if p_role not in ('user','staff','admin') then
    raise exception '허용되지 않은 권한입니다.';
  end if;
  if p_user_id = auth.uid() then
    raise exception '본인의 최고관리자 권한은 이 화면에서 변경할 수 없습니다.';
  end if;

  select role into v_before from public.profiles where id = p_user_id for update;
  if v_before is null then raise exception '회원을 찾을 수 없습니다.'; end if;

  update public.profiles set role = p_role, updated_at = now() where id = p_user_id;

  insert into public.admin_logs(admin_user_id, action, target_user_id, before_data, after_data)
  values(auth.uid(), 'role_change', p_user_id,
    jsonb_build_object('role', v_before), jsonb_build_object('role', p_role));
end;
$$;

-- 마케팅 수동 업무 기본 테이블
create table if not exists public.marketing_work_orders (
  id bigint generated always as identity primary key,
  customer_id uuid not null references auth.users(id) on delete restrict,
  product_name text not null,
  product_category text not null default '기타',
  work_type text not null default 'manual' check (work_type in ('automatic','manual','hybrid')),
  status text not null default 'received' check (status in ('received','assigned','in_progress','review_requested','revision','completed','canceled')),
  assigned_staff_id uuid references auth.users(id) on delete set null,
  customer_request jsonb not null default '{}'::jsonb,
  internal_note text not null default '',
  result_title text,
  result_url text,
  result_note text,
  visible_to_customer boolean not null default false,
  assigned_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_work_orders_staff_status_idx
  on public.marketing_work_orders(assigned_staff_id, status, created_at desc);
create index if not exists marketing_work_orders_customer_created_idx
  on public.marketing_work_orders(customer_id, created_at desc);

alter table public.marketing_work_orders enable row level security;

drop policy if exists "work_orders_admin_all" on public.marketing_work_orders;
create policy "work_orders_admin_all"
on public.marketing_work_orders for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "work_orders_staff_assigned_select" on public.marketing_work_orders;
create policy "work_orders_staff_assigned_select"
on public.marketing_work_orders for select
to authenticated
using (assigned_staff_id = auth.uid());

drop policy if exists "work_orders_customer_select" on public.marketing_work_orders;
create policy "work_orders_customer_select"
on public.marketing_work_orders for select
to authenticated
using (customer_id = auth.uid() and visible_to_customer = true);

create or replace function public.admin_assign_work(
  p_work_id bigint,
  p_staff_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception '관리자 권한이 필요합니다.'; end if;
  if not exists(select 1 from public.profiles where id=p_staff_id and role='staff' and account_status='active') then
    raise exception '활성 직원 계정만 배정할 수 있습니다.';
  end if;
  update public.marketing_work_orders
  set assigned_staff_id=p_staff_id, status='assigned', assigned_at=now(), updated_at=now()
  where id=p_work_id;
  insert into public.admin_logs(admin_user_id, action, before_data, after_data)
  values(auth.uid(),'work_assign',jsonb_build_object('work_id',p_work_id),jsonb_build_object('staff_id',p_staff_id));
end;
$$;

create or replace function public.staff_submit_work(
  p_work_id bigint,
  p_result_title text,
  p_result_url text,
  p_result_note text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then raise exception '직원 권한이 필요합니다.'; end if;
  if not exists(select 1 from public.marketing_work_orders where id=p_work_id and assigned_staff_id=auth.uid()) then
    raise exception '본인에게 배정된 업무가 아닙니다.';
  end if;
  update public.marketing_work_orders
  set result_title=nullif(trim(p_result_title),''), result_url=nullif(trim(p_result_url),''),
      result_note=nullif(trim(p_result_note),''), status='review_requested', updated_at=now()
  where id=p_work_id;
end;
$$;

create or replace function public.admin_review_work(
  p_work_id bigint,
  p_approve boolean,
  p_note text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then raise exception '관리자 권한이 필요합니다.'; end if;
  update public.marketing_work_orders
  set status=case when p_approve then 'completed' else 'revision' end,
      visible_to_customer=p_approve,
      internal_note=case when not p_approve then coalesce(p_note,'') else internal_note end,
      completed_at=case when p_approve then now() else completed_at end,
      updated_at=now()
  where id=p_work_id;
end;
$$;

-- 현재 최고관리자 계정 지정: 실제 이메일로 바꿔 1회 실행하세요.
-- update public.profiles set role='super_admin' where email='본인이메일@example.com';
