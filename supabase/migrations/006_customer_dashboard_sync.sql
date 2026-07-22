-- v16 고객 대시보드 진행률 정확도 보정
-- 플레이스 관리형도 날짜별 순위 등록 수만큼 진행 일수가 증가하도록 처리합니다.

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
    update public.marketing_work_orders
    set guarantee_started_at=(p_entry_date::text||' 00:00:00+09')::timestamptz,
        service_start_date=p_entry_date, service_end_date=p_entry_date+24,
        status='in_progress', updated_at=now()
    where id=p_work_id;
  end if;

  insert into public.marketing_work_entries(work_order_id,entry_date,entry_type,title,result_url,rank_value,note,registered_by)
  values(p_work_id,coalesce(p_entry_date,current_date),p_entry_type,nullif(trim(p_title),''),nullif(trim(p_result_url),''),p_rank_value,nullif(trim(p_note),''),auth.uid())
  returning id into v_entry;

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
      service_start_date=case
        when product_code='blog_ranking' and service_start_date is null and p_entry_type='rank' then p_entry_date
        else service_start_date end,
      service_end_date=case
        when product_code='blog_ranking' and service_end_date is null and p_entry_type='rank' then p_entry_date + greatest(total_units-1,0)
        else service_end_date end,
      status=case
        when total_units>0 and coalesce(v_count,completed_units)>=total_units then 'completed'
        when status in ('assigned','received') then 'in_progress'
        else status end,
      completed_at=case when total_units>0 and coalesce(v_count,completed_units)>=total_units then now() else completed_at end,
      visible_to_customer=true, updated_at=now()
  where id=p_work_id;
  return v_entry;
exception when unique_violation then
  raise exception '해당 날짜의 순위는 이미 등록되어 있습니다.';
end; $$;

-- 기존 플레이스 관리형 기록도 실제 날짜별 순위 개수로 진행률 재계산
update public.marketing_work_orders w
set completed_units=least(w.total_units, coalesce((
  select count(distinct e.entry_date)::integer
  from public.marketing_work_entries e
  where e.work_order_id=w.id and e.entry_type='rank'
),0)), updated_at=now()
where w.progress_mode='calendar';
