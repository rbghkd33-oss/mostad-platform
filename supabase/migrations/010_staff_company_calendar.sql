-- 모스트애드 직원별 필터/월간 달력/업체명 작업기록 v20

alter table public.marketing_work_entries
  add column if not exists company_name text;

-- 기존 브랜딩 블로그 기록은 고객 접수 업체명 또는 회원 업체명으로 보완
update public.marketing_work_entries e
set company_name = coalesce(
  nullif(trim(w.customer_request->>'company_name'), ''),
  nullif(trim(p.company_name), ''),
  nullif(trim(p.manager_name), '')
)
from public.marketing_work_orders w
left join public.profiles p on p.id = w.customer_id
where e.work_order_id = w.id
  and coalesce(trim(e.company_name), '') = '';

-- 기존 시그니처 제거 후 업체명 인자를 포함한 함수 재생성
drop function if exists public.staff_add_work_entry(bigint,date,text,text,text,integer,text,boolean);

create or replace function public.staff_add_work_entry(
  p_work_id bigint,
  p_entry_date date,
  p_entry_type text,
  p_company_name text default '',
  p_title text default '',
  p_result_url text default '',
  p_rank_value integer default null,
  p_note text default '',
  p_start_guarantee boolean default false
)
returns bigint
language plpgsql security definer set search_path=public
as $$
declare
  v_work public.marketing_work_orders%rowtype;
  v_entry bigint;
  v_count int;
  v_start date;
  v_company text;
begin
  if not public.is_staff() then raise exception '직원 권한이 필요합니다.'; end if;

  select * into v_work
  from public.marketing_work_orders
  where id=p_work_id and assigned_staff_id=auth.uid()
  for update;

  if not found then raise exception '본인에게 배정된 업무가 아닙니다.'; end if;
  if p_entry_type not in ('post','rank','note','start','complete') then raise exception '지원하지 않는 기록 유형입니다.'; end if;
  if p_entry_type='post' and coalesce(trim(p_result_url),'')='' then raise exception '포스팅 링크를 입력해 주세요.'; end if;
  if p_entry_type='rank' and p_rank_value is null then raise exception '순위를 입력해 주세요.'; end if;

  v_company := nullif(trim(p_company_name),'');
  if v_company is null then
    select coalesce(
      nullif(trim(v_work.customer_request->>'company_name'), ''),
      nullif(trim(p.company_name), ''),
      nullif(trim(p.manager_name), '')
    ) into v_company
    from public.profiles p
    where p.id=v_work.customer_id;
  end if;
  if v_company is null then raise exception '업체명을 입력해 주세요.'; end if;

  if p_start_guarantee and v_work.product_code='place_ranking' and v_work.guarantee_started_at is null then
    v_start := p_entry_date;
    update public.marketing_work_orders
    set guarantee_started_at=(p_entry_date::text||' 00:00:00+09')::timestamptz,
        service_start_date=p_entry_date,
        service_end_date=p_entry_date+24,
        status='in_progress',updated_at=now()
    where id=p_work_id;
  end if;

  insert into public.marketing_work_entries(
    work_order_id,entry_date,entry_type,company_name,title,result_url,rank_value,note,registered_by
  ) values(
    p_work_id,coalesce(p_entry_date,current_date),p_entry_type,v_company,
    nullif(trim(p_title),''),nullif(trim(p_result_url),''),p_rank_value,nullif(trim(p_note),''),auth.uid()
  ) returning id into v_entry;

  if p_entry_type='post' then
    select count(*) into v_count from public.marketing_work_entries where work_order_id=p_work_id and entry_type='post';
  elsif p_entry_type='rank' and v_work.progress_mode in ('daily_entry','guarantee_after_start','calendar') then
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

grant execute on function public.staff_add_work_entry(bigint,date,text,text,text,text,integer,text,boolean) to authenticated;
