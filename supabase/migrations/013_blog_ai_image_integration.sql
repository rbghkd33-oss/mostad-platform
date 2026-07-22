-- v23 이미지 분석 블로그 원고 생성
alter table public.blog_ai_generations add column if not exists generation_type text not null default 'text';
alter table public.blog_ai_generations add column if not exists image_names text[];
create index if not exists blog_ai_generations_type_idx on public.blog_ai_generations(user_id,generation_type,created_at desc);

create or replace function public.complete_blog_ai_image_generation(
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
  p_reached_target boolean,
  p_image_names text[]
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
  if coalesce(array_length(p_image_names,1),0)=0 then raise exception '첨부 이미지 정보가 없습니다.'; end if;

  select * into v_existing from public.blog_ai_generations where request_id=p_request_id;
  if found then
    select point_balance into v_balance from public.profiles where id=p_user_id;
    return jsonb_build_object('ok',true,'balance',coalesce(v_balance,0),'generation_id',v_existing.id,'duplicate',true);
  end if;

  select point_balance into v_balance from public.profiles where id=p_user_id and account_status='active' for update;
  if not found then raise exception '이용 가능한 회원 계정을 찾을 수 없습니다.'; end if;
  if coalesce(v_balance,0)<v_cost then raise exception '원고 생성은 완료되었지만 보유 포인트가 부족해 저장할 수 없습니다.'; end if;

  update public.profiles set point_balance=point_balance-v_cost,updated_at=now() where id=p_user_id;
  insert into public.point_transactions(user_id,transaction_type,amount,balance_after,description)
  values(p_user_id,'use',v_cost,v_balance-v_cost,format('이미지 분석 블로그 AI 원고 생성 · %s',trim(p_main_keyword)));

  insert into public.blog_ai_generations(
    user_id,request_id,main_keyword,sub_keyword,main_repeat,target_chars,paragraph_count,tone,style,guide,
    body,char_count,retry_count,reached_target,point_cost,generation_type,image_names
  ) values(
    p_user_id,trim(p_request_id),trim(p_main_keyword),nullif(trim(p_sub_keyword),''),p_main_repeat,p_target_chars,p_paragraph_count,
    p_tone,p_style,nullif(trim(p_guide),''),p_body,greatest(p_char_count,0),greatest(p_retry_count,0),p_reached_target,v_cost,'image',p_image_names
  ) returning id into v_existing.id;

  return jsonb_build_object('ok',true,'balance',v_balance-v_cost,'generation_id',v_existing.id,'duplicate',false);
end;
$$;
revoke all on function public.complete_blog_ai_image_generation(uuid,text,text,text,integer,integer,integer,text,text,text,text,integer,integer,boolean,text[]) from public,anon,authenticated;
grant execute on function public.complete_blog_ai_image_generation(uuid,text,text,text,integer,integer,integer,text,text,text,text,integer,integer,boolean,text[]) to service_role;
