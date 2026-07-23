-- 검색량·키워드 분석을 무료 서비스로 변경합니다.
-- 기존 분석 기록은 유지하며, 앞으로 생성되는 기록의 point_cost는 0으로 저장됩니다.

alter table public.keyword_analysis_history
  alter column point_cost set default 0;

create or replace function public.complete_keyword_analysis(
  p_user_id uuid,
  p_request_id text,
  p_seed_keyword text,
  p_result jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.keyword_analysis_history%rowtype;
begin
  select * into v_existing
  from public.keyword_analysis_history
  where user_id = p_user_id
    and request_id = p_request_id;

  if found then
    return jsonb_build_object(
      'ok', true,
      'already_completed', true,
      'cost', 0,
      'free', true
    );
  end if;

  if not exists (
    select 1
    from public.profiles
    where id = p_user_id
      and account_status = 'active'
  ) then
    raise exception '현재 이용할 수 없는 계정입니다.';
  end if;

  insert into public.keyword_analysis_history(
    user_id,
    request_id,
    seed_keyword,
    result,
    point_cost
  ) values (
    p_user_id,
    p_request_id,
    p_seed_keyword,
    p_result,
    0
  );

  return jsonb_build_object(
    'ok', true,
    'cost', 0,
    'free', true
  );
end;
$$;

revoke all on function public.complete_keyword_analysis(uuid, text, text, jsonb) from public;
grant execute on function public.complete_keyword_analysis(uuid, text, text, jsonb) to service_role;
