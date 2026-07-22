-- v18 브랜딩 블로그 고객 직접 접수 및 포인트 자동 차감

create or replace function public.customer_purchase_branding_blog(
  p_package_count integer,
  p_blog_url text,
  p_main_keyword text,
  p_brand_intro text default '',
  p_request_note text default ''
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_price bigint;
  v_balance bigint;
  v_work_id bigint;
begin
  if v_user_id is null then raise exception '로그인이 필요합니다.'; end if;
  if not exists(select 1 from public.profiles where id=v_user_id and account_status='active') then
    raise exception '이용 가능한 회원 계정을 찾을 수 없습니다.';
  end if;
  if p_package_count not in (10,20,30) then raise exception '10회, 20회, 30회 상품만 신청할 수 있습니다.'; end if;
  if coalesce(trim(p_blog_url),'')='' then raise exception '블로그 주소를 입력해 주세요.'; end if;
  if coalesce(trim(p_main_keyword),'')='' then raise exception '주요 키워드를 입력해 주세요.'; end if;

  v_price := p_package_count * 22000;
  select point_balance into v_balance from public.profiles where id=v_user_id for update;
  if coalesce(v_balance,0) < v_price then raise exception '보유 포인트가 부족합니다.'; end if;

  update public.profiles
  set point_balance=point_balance-v_price, updated_at=now()
  where id=v_user_id;

  insert into public.point_transactions(user_id,transaction_type,amount,balance_after,description)
  values(v_user_id,'use',v_price,v_balance-v_price,format('브랜딩 블로그 최적화 관리 %s회 접수',p_package_count));

  insert into public.marketing_work_orders(
    customer_id, product_name, product_category, product_code, package_option,
    point_price, total_units, completed_units, guarantee_days, progress_mode,
    work_type, status, customer_request, visible_to_customer
  ) values (
    v_user_id, '브랜딩 블로그 최적화 관리', '블로그', 'branding_blog', p_package_count::text,
    v_price, p_package_count, 0, 0, 'count',
    'manual', 'received', jsonb_build_object(
      'blog_url', trim(p_blog_url),
      'main_keyword', trim(p_main_keyword),
      'brand_intro', nullif(trim(p_brand_intro),''),
      'request_note', nullif(trim(p_request_note),'')
    ), true
  ) returning id into v_work_id;

  return v_work_id;
end;
$$;

grant execute on function public.customer_purchase_branding_blog(integer,text,text,text,text) to authenticated;
