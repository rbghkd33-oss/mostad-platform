-- 모스트애드 상품별 진행관리/직원 일일기록/관리자 캘린더 v15

alter table public.marketing_work_orders
  add column if not exists product_code text,
  add column if not exists package_option text,
  add column if not exists point_price integer not null default 0,
  add column if not exists total_units integer not null default 0,
  add column if not exists completed_units integer not null default 0,
  add column if not exists guarantee_days integer not null default 0,
  add column if not exists service_start_date date,
  add column if not exists service_end_date date,
  add column if not exists guarantee_started_at timestamptz,
  add column if not exists current_rank integer,
  add column if not exists progress_mode text not null default 'count'
    check (progress_mode in ('count','daily_entry','calendar','guarantee_after_start'));

create table if not exists public.marketing_work_entries (
  id bigint generated always as identity primary key,
  work_order_id bigint not null references public.marketing_work_orders(id) on delete cascade,
  entry_date date not null default current_date,
  entry_type text not null check (entry_type in ('post','rank','note','start','complete')),
  title text,
  result_url text,
  rank_value integer,
  note text,
  registered_by uuid not null references auth.users(id) on delete restrict,
  visible_to_customer boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists marketing_work_entries_work_date_idx
  on public.marketing_work_entries(work_order_id, entry_date desc, created_at desc);
create index if not exists marketing_work_entries_staff_date_idx
  on public.marketing_work_entries(registered_by, entry_date desc);
create unique index if not exists marketing_work_entries_daily_rank_uq
  on public.marketing_work_entries(work_order_id, entry_date, entry_type)
  where entry_type = 'rank';

alter table public.marketing_work_entries enable row level security;

drop policy if exists "entries_admin_all" on public.marketing_work_entries;
create policy "entries_admin_all" on public.marketing_work_entries
for all to authenticated using (public.is_admin()) with check (public.is_admin());

drop policy if exists "entries_staff_assigned" on public.marketing_work_entries;
create policy "entries_staff_assigned" on public.marketing_work_entries
for all to authenticated
using (exists(select 1 from public.marketing_work_orders w where w.id=work_order_id and w.assigned_staff_id=auth.uid()))
with check (exists(select 1 from public.marketing_work_orders w where w.id=work_order_id and w.assigned_staff_id=auth.uid()));

drop policy if exists "entries_customer_select" on public.marketing_work_entries;
create policy "entries_customer_select" on public.marketing_work_entries
for select to authenticated
using (visible_to_customer and exists(select 1 from public.marketing_work_orders w where w.id=work_order_id and w.customer_id=auth.uid()));

create or replace function public.admin_create_product_work(
  p_customer_id uuid,
  p_product_code text,
  p_package_option text default '',
  p_staff_id uuid default null,
  p_customer_request jsonb default '{}'::jsonb
)
returns bigint
language plpgsql security definer set search_path=public
as $$
declare
  v_name text; v_category text; v_price int; v_total int; v_days int; v_mode text; v_start date; v_end date; v_id bigint;
begin
  if not public.is_admin() then raise exception '관리자 권한이 필요합니다.'; end if;
  if not exists(select 1 from public.profiles where id=p_customer_id) then raise exception '회원을 찾을 수 없습니다.'; end if;

  case p_product_code
    when 'branding_blog' then
      v_name := '브랜딩 블로그 최적화 관리'; v_category := '블로그'; v_mode := 'count';
      case p_package_option when '10' then v_price:=220000;v_total:=10; when '20' then v_price:=440000;v_total:=20; when '30' then v_price:=660000;v_total:=30; else raise exception '브랜딩 블로그 횟수는 10, 20, 30 중 하나입니다.'; end case;
    when 'place_ranking' then
      v_name := '플레이스 상위노출'; v_category := '플레이스'; v_mode := 'guarantee_after_start'; v_days:=25; v_total:=25;
    when 'place_management' then
      v_name := '플레이스 관리형'; v_category := '플레이스'; v_mode := 'calendar'; v_days:=25; v_total:=25; v_start:=current_date+1; v_end:=v_start+24;
    when 'blog_ranking' then
      v_name := '블로그 상위노출'; v_category := '블로그'; v_mode := 'daily_entry';
      if p_package_option='24h' then v_days:=1;v_total:=1; elsif p_package_option='25d' then v_days:=25;v_total:=25; else raise exception '블로그 상위노출 옵션은 24h 또는 25d입니다.'; end if;
    else raise exception '지원하지 않는 상품입니다.';
  end case;

  if p_staff_id is not null and not exists(select 1 from public.profiles where id=p_staff_id and role='staff' and account_status='active') then
    raise exception '활성 직원만 배정할 수 있습니다.';
  end if;

  insert into public.marketing_work_orders(customer_id,product_name,product_category,product_code,package_option,point_price,total_units,guarantee_days,progress_mode,service_start_date,service_end_date,customer_request,assigned_staff_id,status,assigned_at)
  values(p_customer_id,v_name,v_category,p_product_code,nullif(p_package_option,''),coalesce(v_price,0),coalesce(v_total,0),coalesce(v_days,0),v_mode,v_start,v_end,coalesce(p_customer_request,'{}'::jsonb),p_staff_id,case when p_staff_id is null then 'received' else 'assigned' end,case when p_staff_id is null then null else now() end)
  returning id into v_id;

  insert into public.admin_logs(admin_user_id,action,target_user_id,after_data)
  values(auth.uid(),'product_work_create',p_customer_id,jsonb_build_object('work_id',v_id,'product_code',p_product_code,'option',p_package_option,'staff_id',p_staff_id));
  return v_id;
end; $$;

create or replace function public.staff_add_work_entry(
  p_work_id bigint,
  p_entry_date date,
  p_entry_type text,
  p_title text default '',
  p_result_url text default '',
  p_rank_value integer default null,
  p_note text default '',
  p_start_guarantee boolean default false
)
returns bigint
language plpgsql security definer set search_path=public
as $$
declare v_work public.marketing_work_orders%rowtype; v_entry bigint; v_count int; v_start date;
begin
  if not public.is_staff() then raise exception '직원 권한이 필요합니다.'; end if;
  select * into v_work from public.marketing_work_orders where id=p_work_id and assigned_staff_id=auth.uid() for update;
  if not found then raise exception '본인에게 배정된 업무가 아닙니다.'; end if;
  if p_entry_type not in ('post','rank','note','start','complete') then raise exception '지원하지 않는 기록 유형입니다.'; end if;
  if p_entry_type='post' and coalesce(trim(p_result_url),'')='' then raise exception '포스팅 링크를 입력해 주세요.'; end if;
  if p_entry_type='rank' and p_rank_value is null then raise exception '순위를 입력해 주세요.'; end if;

  if p_start_guarantee and v_work.product_code='place_ranking' and v_work.guarantee_started_at is null then
    v_start := p_entry_date;
    update public.marketing_work_orders set guarantee_started_at=(p_entry_date::text||' 00:00:00+09')::timestamptz,service_start_date=p_entry_date,service_end_date=p_entry_date+24,status='in_progress',updated_at=now() where id=p_work_id;
  end if;

  insert into public.marketing_work_entries(work_order_id,entry_date,entry_type,title,result_url,rank_value,note,registered_by)
  values(p_work_id,coalesce(p_entry_date,current_date),p_entry_type,nullif(trim(p_title),''),nullif(trim(p_result_url),''),p_rank_value,nullif(trim(p_note),''),auth.uid())
  returning id into v_entry;

  if p_entry_type='post' then
    select count(*) into v_count from public.marketing_work_entries where work_order_id=p_work_id and entry_type='post';
  elsif p_entry_type='rank' and v_work.progress_mode in ('daily_entry','guarantee_after_start') then
    select count(distinct entry_date) into v_count from public.marketing_work_entries where work_order_id=p_work_id and entry_type='rank';
  else
    v_count := v_work.completed_units;
  end if;

  update public.marketing_work_orders
  set completed_units=least(greatest(coalesce(v_count,completed_units),0),greatest(total_units,0)),
      current_rank=case when p_entry_type='rank' then p_rank_value else current_rank end,
      status=case when total_units>0 and coalesce(v_count,completed_units)>=total_units then 'completed' when status in ('assigned','received') then 'in_progress' else status end,
      completed_at=case when total_units>0 and coalesce(v_count,completed_units)>=total_units then now() else completed_at end,
      visible_to_customer=true,updated_at=now()
  where id=p_work_id;
  return v_entry;
exception when unique_violation then
  raise exception '해당 날짜의 순위는 이미 등록되어 있습니다.';
end; $$;

create or replace function public.admin_delete_work_entry(p_entry_id bigint)
returns void language plpgsql security definer set search_path=public as $$
declare v_work_id bigint;
begin
  if not public.is_admin() then raise exception '관리자 권한이 필요합니다.'; end if;
  select work_order_id into v_work_id from public.marketing_work_entries where id=p_entry_id;
  delete from public.marketing_work_entries where id=p_entry_id;
  update public.marketing_work_orders w set completed_units=case
    when w.product_code='branding_blog' then (select count(*) from public.marketing_work_entries e where e.work_order_id=w.id and e.entry_type='post')
    when w.progress_mode in ('daily_entry','guarantee_after_start') then (select count(distinct e.entry_date) from public.marketing_work_entries e where e.work_order_id=w.id and e.entry_type='rank')
    else w.completed_units end, updated_at=now() where id=v_work_id;
end; $$;
