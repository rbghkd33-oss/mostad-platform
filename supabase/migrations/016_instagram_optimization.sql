-- 모스트애드 인스타 최적화 30일 상품 v31
-- 계정 1개 신청 시 150,000P 차감, 관리자 승인 후 30일 가동

create extension if not exists pgcrypto;

create table if not exists public.instagram_optimization_orders (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete restrict,
  instagram_username text not null,
  status text not null default 'pending_approval'
    check (status in ('pending_approval','active','rejected','expired','canceled')),
  price_points integer not null default 150000 check (price_points >= 0),

  follow_enabled boolean not null default true,
  follow_keywords text not null default '',
  feed_follow_limit integer not null default 10 check (feed_follow_limit between 0 and 500),
  search_follow_limit integer not null default 10 check (search_follow_limit between 0 and 500),

  like_enabled boolean not null default true,
  like_keywords text not null default '',
  feed_like_limit integer not null default 25 check (feed_like_limit between 0 and 1000),
  search_like_limit integer not null default 25 check (search_like_limit between 0 and 1000),

  story_enabled boolean not null default true,
  story_daily_limit integer not null default 30 check (story_daily_limit between 0 and 1000),

  comment_enabled boolean not null default true,
  comment_daily_limit integer not null default 5 check (comment_daily_limit between 0 and 100),
  comment_templates text not null default '',

  admin_note text not null default '',
  rejection_reason text,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  service_start_at timestamptz,
  service_end_at timestamptz,
  refunded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists instagram_orders_user_created_idx
  on public.instagram_optimization_orders(user_id, created_at desc);
create index if not exists instagram_orders_status_created_idx
  on public.instagram_optimization_orders(status, created_at desc);

alter table public.instagram_optimization_orders enable row level security;

drop policy if exists "instagram_order_customer_select" on public.instagram_optimization_orders;
create policy "instagram_order_customer_select"
on public.instagram_optimization_orders for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "instagram_order_admin_all" on public.instagram_optimization_orders;
create policy "instagram_order_admin_all"
on public.instagram_optimization_orders for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- 고객 신청: 포인트 확인, 차감, 신청 생성, 포인트 이력을 한 트랜잭션으로 처리합니다.
create or replace function public.create_instagram_optimization_order(
  p_instagram_username text,
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
  v_user_id uuid := auth.uid();
  v_balance bigint;
  v_order_id bigint;
  v_price integer := 150000;
  v_username text := regexp_replace(trim(coalesce(p_instagram_username,'')), '^@', '');
begin
  if v_user_id is null then raise exception '로그인이 필요합니다.'; end if;
  if v_username = '' then raise exception '인스타그램 아이디를 입력해 주세요.'; end if;
  if length(v_username) > 100 then raise exception '인스타그램 아이디가 너무 깁니다.'; end if;
  if not exists(select 1 from public.profiles where id=v_user_id and account_status='active') then
    raise exception '현재 이용할 수 없는 계정입니다.';
  end if;

  select point_balance into v_balance
  from public.profiles
  where id=v_user_id
  for update;

  if coalesce(v_balance,0) < v_price then
    raise exception '포인트가 부족합니다. 인스타 계정 1개 신청에는 150,000P가 필요합니다.';
  end if;

  update public.profiles
  set point_balance = point_balance - v_price, updated_at = now()
  where id=v_user_id;

  insert into public.instagram_optimization_orders(
    user_id, instagram_username,
    follow_enabled, follow_keywords, feed_follow_limit, search_follow_limit,
    like_enabled, like_keywords, feed_like_limit, search_like_limit,
    story_enabled, story_daily_limit,
    comment_enabled, comment_daily_limit, comment_templates
  ) values (
    v_user_id, v_username,
    coalesce(p_follow_enabled,true), trim(coalesce(p_follow_keywords,'')), greatest(0,least(coalesce(p_feed_follow_limit,10),500)), greatest(0,least(coalesce(p_search_follow_limit,10),500)),
    coalesce(p_like_enabled,true), trim(coalesce(p_like_keywords,'')), greatest(0,least(coalesce(p_feed_like_limit,25),1000)), greatest(0,least(coalesce(p_search_like_limit,25),1000)),
    coalesce(p_story_enabled,true), greatest(0,least(coalesce(p_story_daily_limit,30),1000)),
    coalesce(p_comment_enabled,true), greatest(0,least(coalesce(p_comment_daily_limit,5),100)), trim(coalesce(p_comment_templates,''))
  ) returning id into v_order_id;

  insert into public.point_transactions(user_id, transaction_type, amount, balance_after, description)
  values(v_user_id, 'use', v_price, v_balance-v_price, '인스타 최적화 30일 상품 신청 #' || v_order_id::text);

  return v_order_id;
end;
$$;

-- 관리자 승인: 승인 시점부터 30일 가동합니다.
create or replace function public.admin_review_instagram_order(
  p_order_id bigint,
  p_approve boolean,
  p_note text default ''
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.instagram_optimization_orders%rowtype;
  v_balance bigint;
begin
  if not public.is_admin() then raise exception '관리자 권한이 필요합니다.'; end if;

  select * into v_order
  from public.instagram_optimization_orders
  where id=p_order_id
  for update;

  if v_order.id is null then raise exception '신청을 찾을 수 없습니다.'; end if;
  if v_order.status <> 'pending_approval' then raise exception '승인 대기 중인 신청만 처리할 수 있습니다.'; end if;

  if p_approve then
    update public.instagram_optimization_orders
    set status='active', approved_by=auth.uid(), approved_at=now(),
        service_start_at=now(), service_end_at=now()+interval '30 days',
        admin_note=trim(coalesce(p_note,'')), updated_at=now()
    where id=p_order_id;
  else
    select point_balance into v_balance from public.profiles where id=v_order.user_id for update;
    update public.profiles set point_balance=point_balance+v_order.price_points, updated_at=now() where id=v_order.user_id;
    update public.instagram_optimization_orders
    set status='rejected', rejection_reason=nullif(trim(coalesce(p_note,'')),''),
        refunded_at=now(), updated_at=now()
    where id=p_order_id;
    insert into public.point_transactions(user_id, transaction_type, amount, balance_after, description)
    values(v_order.user_id, 'refund', v_order.price_points, v_balance+v_order.price_points,
      '인스타 최적화 신청 반려 환불 #' || p_order_id::text);
  end if;
end;
$$;

-- 기간이 지난 활성 상품을 종료 상태로 정리합니다. 고객/관리자 화면 진입 시 호출할 수 있습니다.
create or replace function public.refresh_instagram_order_expiry()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  update public.instagram_optimization_orders
  set status='expired', updated_at=now()
  where status='active' and service_end_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

grant execute on function public.create_instagram_optimization_order(text,boolean,text,integer,integer,boolean,text,integer,integer,boolean,integer,boolean,integer,text) to authenticated;
grant execute on function public.admin_review_instagram_order(bigint,boolean,text) to authenticated;
grant execute on function public.refresh_instagram_order_expiry() to authenticated;
