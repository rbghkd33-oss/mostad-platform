-- 인스타 로그인 정보 암호화 저장 및 관리자 열람 기록 v32

alter table public.instagram_optimization_orders
  add column if not exists password_ciphertext text,
  add column if not exists password_iv text,
  add column if not exists password_tag text,
  add column if not exists credential_registered_at timestamptz;

create table if not exists public.instagram_credential_access_logs (
  id bigint generated always as identity primary key,
  order_id bigint not null references public.instagram_optimization_orders(id) on delete cascade,
  viewed_by uuid not null references auth.users(id) on delete restrict,
  viewed_at timestamptz not null default now()
);

create index if not exists instagram_credential_access_order_idx
  on public.instagram_credential_access_logs(order_id, viewed_at desc);

alter table public.instagram_credential_access_logs enable row level security;

drop policy if exists "instagram_credential_logs_admin_select" on public.instagram_credential_access_logs;
create policy "instagram_credential_logs_admin_select"
on public.instagram_credential_access_logs for select
to authenticated
using (public.is_admin());

-- 이 함수는 Next.js 서버에서 service_role로만 호출합니다.
create or replace function public.create_instagram_optimization_order_secure(
  p_user_id uuid,
  p_instagram_username text,
  p_password_ciphertext text,
  p_password_iv text,
  p_password_tag text,
  p_follow_enabled boolean,
  p_follow_keywords text,
  p_feed_follow_limit integer,
  p_search_follow_limit integer,
  p_like_enabled boolean,
  p_like_keywords text,
  p_feed_like_limit integer,
  p_search_like_limit integer,
  p_story_enabled boolean,
  p_story_daily_limit integer,
  p_comment_enabled boolean,
  p_comment_daily_limit integer,
  p_comment_templates text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
  v_order_id bigint;
  v_price integer := 150000;
  v_username text := regexp_replace(trim(coalesce(p_instagram_username,'')), '^@', '');
begin
  if p_user_id is null then raise exception '회원 정보가 없습니다.'; end if;
  if v_username = '' then raise exception '인스타그램 아이디를 입력해 주세요.'; end if;
  if length(v_username) > 100 then raise exception '인스타그램 아이디가 너무 깁니다.'; end if;
  if coalesce(trim(p_password_ciphertext),'') = '' or coalesce(trim(p_password_iv),'') = '' or coalesce(trim(p_password_tag),'') = '' then
    raise exception '인스타그램 로그인 정보가 없습니다.';
  end if;
  if not exists(select 1 from public.profiles where id=p_user_id and account_status='active') then
    raise exception '현재 이용할 수 없는 계정입니다.';
  end if;

  select point_balance into v_balance
  from public.profiles
  where id=p_user_id
  for update;

  if coalesce(v_balance,0) < v_price then
    raise exception '포인트가 부족합니다. 인스타 계정 1개 신청에는 150,000P가 필요합니다.';
  end if;

  update public.profiles
  set point_balance = point_balance - v_price, updated_at = now()
  where id=p_user_id;

  insert into public.instagram_optimization_orders(
    user_id, instagram_username,
    password_ciphertext, password_iv, password_tag, credential_registered_at,
    follow_enabled, follow_keywords, feed_follow_limit, search_follow_limit,
    like_enabled, like_keywords, feed_like_limit, search_like_limit,
    story_enabled, story_daily_limit,
    comment_enabled, comment_daily_limit, comment_templates
  ) values (
    p_user_id, v_username,
    p_password_ciphertext, p_password_iv, p_password_tag, now(),
    coalesce(p_follow_enabled,true), trim(coalesce(p_follow_keywords,'')), greatest(0,least(coalesce(p_feed_follow_limit,10),500)), greatest(0,least(coalesce(p_search_follow_limit,10),500)),
    coalesce(p_like_enabled,true), trim(coalesce(p_like_keywords,'')), greatest(0,least(coalesce(p_feed_like_limit,25),1000)), greatest(0,least(coalesce(p_search_like_limit,25),1000)),
    coalesce(p_story_enabled,true), greatest(0,least(coalesce(p_story_daily_limit,30),1000)),
    coalesce(p_comment_enabled,true), greatest(0,least(coalesce(p_comment_daily_limit,5),100)), trim(coalesce(p_comment_templates,''))
  ) returning id into v_order_id;

  insert into public.point_transactions(user_id, transaction_type, amount, balance_after, description)
  values(p_user_id, 'use', v_price, v_balance-v_price, '인스타 최적화 30일 상품 신청 #' || v_order_id::text);

  return v_order_id;
end;
$$;

revoke all on function public.create_instagram_optimization_order_secure(uuid,text,text,text,text,boolean,text,integer,integer,boolean,text,integer,integer,boolean,integer,boolean,integer,text) from public;
revoke all on function public.create_instagram_optimization_order_secure(uuid,text,text,text,text,boolean,text,integer,integer,boolean,text,integer,integer,boolean,integer,boolean,integer,text) from authenticated;
grant execute on function public.create_instagram_optimization_order_secure(uuid,text,text,text,text,boolean,text,integer,integer,boolean,text,integer,integer,boolean,integer,boolean,integer,text) to service_role;

-- 반려·종료·취소 계정은 비밀번호를 지웁니다.
create or replace function public.clear_inactive_instagram_credentials()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  update public.instagram_optimization_orders
  set password_ciphertext=null, password_iv=null, password_tag=null, updated_at=now()
  where status in ('rejected','expired','canceled')
    and password_ciphertext is not null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
grant execute on function public.clear_inactive_instagram_credentials() to authenticated;
