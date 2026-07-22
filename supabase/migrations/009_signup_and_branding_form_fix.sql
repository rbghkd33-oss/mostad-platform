-- v19 회원가입 이메일 발송 제한 우회용 서버 가입 보호 및 브랜딩 블로그 간소화
create table if not exists public.signup_rate_limits (
  fingerprint text primary key,
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0,
  updated_at timestamptz not null default now()
);
revoke all on public.signup_rate_limits from anon, authenticated;
create or replace function public.consume_public_signup_attempt(p_fingerprint text)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_row public.signup_rate_limits%rowtype;
begin
  if coalesce(trim(p_fingerprint), '') = '' then return false; end if;
  insert into public.signup_rate_limits(fingerprint, window_started_at, attempts, updated_at)
  values (p_fingerprint, now(), 1, now())
  on conflict (fingerprint) do update set
    window_started_at = case when public.signup_rate_limits.window_started_at < now() - interval '1 hour' then now() else public.signup_rate_limits.window_started_at end,
    attempts = case when public.signup_rate_limits.window_started_at < now() - interval '1 hour' then 1 else public.signup_rate_limits.attempts + 1 end,
    updated_at = now()
  returning * into v_row;
  return v_row.attempts <= 5;
end; $$;
revoke all on function public.consume_public_signup_attempt(text) from public, anon, authenticated;
grant execute on function public.consume_public_signup_attempt(text) to service_role;

create or replace function public.customer_purchase_branding_blog_v2(
  p_package_count integer, p_blog_url text, p_company_name text, p_request_note text default ''
) returns bigint language plpgsql security definer set search_path = public as $$
declare v_user_id uuid := auth.uid(); v_price bigint; v_balance bigint; v_work_id bigint;
begin
  if v_user_id is null then raise exception '로그인이 필요합니다.'; end if;
  if not exists(select 1 from public.profiles where id=v_user_id and account_status='active') then raise exception '이용 가능한 회원 계정을 찾을 수 없습니다.'; end if;
  if p_package_count not in (10,20,30) then raise exception '10회, 20회, 30회 상품만 신청할 수 있습니다.'; end if;
  if coalesce(trim(p_blog_url),'')='' then raise exception '블로그 주소를 입력해 주세요.'; end if;
  if coalesce(trim(p_company_name),'')='' then raise exception '업체명을 입력해 주세요.'; end if;
  v_price := p_package_count * 22000;
  select point_balance into v_balance from public.profiles where id=v_user_id for update;
  if coalesce(v_balance,0) < v_price then raise exception '보유 포인트가 부족합니다.'; end if;
  update public.profiles set point_balance=point_balance-v_price, updated_at=now() where id=v_user_id;
  insert into public.point_transactions(user_id,transaction_type,amount,balance_after,description)
  values(v_user_id,'use',v_price,v_balance-v_price,format('브랜딩 블로그 최적화 관리 %s회 접수',p_package_count));
  insert into public.marketing_work_orders(
    customer_id, product_name, product_category, product_code, package_option,
    point_price, total_units, completed_units, guarantee_days, progress_mode,
    work_type, status, customer_request, visible_to_customer
  ) values (
    v_user_id, '브랜딩 블로그 최적화 관리', '블로그', 'branding_blog', p_package_count::text,
    v_price, p_package_count, 0, 0, 'count', 'manual', 'received',
    jsonb_build_object('blog_url', trim(p_blog_url), 'company_name', trim(p_company_name), 'request_note', nullif(trim(p_request_note),'')), true
  ) returning id into v_work_id;
  return v_work_id;
end; $$;
grant execute on function public.customer_purchase_branding_blog_v2(integer,text,text,text) to authenticated;
