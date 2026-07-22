-- v22 블로그 AI 원고 생성 및 성공 후 1,000P 자동 차감
create table if not exists public.blog_ai_generations (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id text not null unique,
  main_keyword text not null,
  sub_keyword text,
  main_repeat integer not null default 6,
  target_chars integer not null default 1500,
  paragraph_count integer not null default 5,
  tone text not null default 'haeyo',
  style text not null default 'narrative',
  guide text,
  body text not null,
  char_count integer not null default 0,
  retry_count integer not null default 0,
  reached_target boolean not null default false,
  point_cost bigint not null default 1000,
  created_at timestamptz not null default now()
);
create index if not exists blog_ai_generations_user_created_idx on public.blog_ai_generations(user_id, created_at desc);
alter table public.blog_ai_generations enable row level security;
drop policy if exists "blog_ai_generations_select_own" on public.blog_ai_generations;
create policy "blog_ai_generations_select_own" on public.blog_ai_generations for select to authenticated using (auth.uid()=user_id);

create or replace function public.complete_blog_ai_generation(
  p_user_id uuid,
  p_request_id text,
  p_main_keyword text,
  p_sub_keyword text,
  p_main_repeat integer,
  p_target_chars integer,
  p_paragraph_count integer,
  p_tone text,
  p_style text,
  p_guide text,
  p_body text,
  p_char_count integer,
  p_retry_count integer,
  p_reached_target boolean
) returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v_balance bigint;
  v_existing public.blog_ai_generations%rowtype;
  v_cost constant bigint := 1000;
begin
  if p_user_id is null then raise exception '회원 정보가 없습니다.'; end if;
  if coalesce(trim(p_request_id),'')='' then raise exception '요청번호가 없습니다.'; end if;
  if coalesce(trim(p_body),'')='' then raise exception '생성된 원고가 없습니다.'; end if;

  select * into v_existing from public.blog_ai_generations where request_id=p_request_id;
  if found then
    select point_balance into v_balance from public.profiles where id=p_user_id;
    return jsonb_build_object('ok',true,'balance',coalesce(v_balance,0),'generation_id',v_existing.id,'duplicate',true);
  end if;

  select point_balance into v_balance from public.profiles where id=p_user_id and account_status='active' for update;
  if not found then raise exception '이용 가능한 회원 계정을 찾을 수 없습니다.'; end if;
  if coalesce(v_balance,0) < v_cost then raise exception '원고 생성은 완료되었지만 보유 포인트가 부족해 저장할 수 없습니다.'; end if;

  update public.profiles set point_balance=point_balance-v_cost, updated_at=now() where id=p_user_id;
  insert into public.point_transactions(user_id,transaction_type,amount,balance_after,description)
  values(p_user_id,'use',v_cost,v_balance-v_cost,format('블로그 AI 원고 생성 · %s',trim(p_main_keyword)));

  insert into public.blog_ai_generations(
    user_id,request_id,main_keyword,sub_keyword,main_repeat,target_chars,paragraph_count,tone,style,guide,
    body,char_count,retry_count,reached_target,point_cost
  ) values(
    p_user_id,trim(p_request_id),trim(p_main_keyword),nullif(trim(p_sub_keyword),''),p_main_repeat,p_target_chars,p_paragraph_count,
    p_tone,p_style,nullif(trim(p_guide),''),p_body,greatest(p_char_count,0),greatest(p_retry_count,0),p_reached_target,v_cost
  ) returning id into v_existing.id;

  return jsonb_build_object('ok',true,'balance',v_balance-v_cost,'generation_id',v_existing.id,'duplicate',false);
end;
$$;
revoke all on function public.complete_blog_ai_generation(uuid,text,text,text,integer,integer,integer,text,text,text,text,integer,integer,boolean) from public,anon,authenticated;
grant execute on function public.complete_blog_ai_generation(uuid,text,text,text,integer,integer,integer,text,text,text,text,integer,integer,boolean) to service_role;
