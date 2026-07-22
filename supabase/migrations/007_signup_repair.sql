-- 회원가입 저장 오류 복구 및 프로필 자동 보정 v17
-- Supabase SQL Editor에서 전체 실행하세요.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    insert into public.profiles (
      id, email, manager_name, company_name, phone, point_balance, role, account_status
    )
    values (
      new.id,
      coalesce(new.email, ''),
      coalesce(new.raw_user_meta_data ->> 'manager_name', new.raw_user_meta_data ->> 'name', ''),
      coalesce(new.raw_user_meta_data ->> 'company_name', new.raw_user_meta_data ->> 'company', ''),
      coalesce(new.raw_user_meta_data ->> 'phone', ''),
      0,
      'user',
      'active'
    )
    on conflict (id) do update set
      email = excluded.email,
      manager_name = case
        when coalesce(public.profiles.manager_name, '') = '' then excluded.manager_name
        else public.profiles.manager_name
      end,
      company_name = case
        when coalesce(public.profiles.company_name, '') = '' then excluded.company_name
        else public.profiles.company_name
      end,
      phone = case
        when coalesce(public.profiles.phone, '') = '' then excluded.phone
        else public.profiles.phone
      end,
      updated_at = now();
  exception when others then
    -- 프로필 부가정보 오류 때문에 Auth 회원가입 자체가 막히지 않도록 합니다.
    raise warning 'MOSTAD profile trigger warning for user %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

-- 로그인한 사용자가 본인 프로필을 안전하게 생성/복구할 수 있는 함수입니다.
create or replace function public.ensure_my_profile()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user auth.users%rowtype;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다.';
  end if;

  select * into v_user
  from auth.users
  where id = auth.uid();

  if v_user.id is null then
    raise exception '회원정보를 찾을 수 없습니다.';
  end if;

  insert into public.profiles (
    id, email, manager_name, company_name, phone, point_balance, role, account_status
  )
  values (
    v_user.id,
    coalesce(v_user.email, ''),
    coalesce(v_user.raw_user_meta_data ->> 'manager_name', v_user.raw_user_meta_data ->> 'name', ''),
    coalesce(v_user.raw_user_meta_data ->> 'company_name', v_user.raw_user_meta_data ->> 'company', ''),
    coalesce(v_user.raw_user_meta_data ->> 'phone', ''),
    0,
    'user',
    'active'
  )
  on conflict (id) do update set
    email = excluded.email,
    manager_name = case
      when coalesce(public.profiles.manager_name, '') = '' then excluded.manager_name
      else public.profiles.manager_name
    end,
    company_name = case
      when coalesce(public.profiles.company_name, '') = '' then excluded.company_name
      else public.profiles.company_name
    end,
    phone = case
      when coalesce(public.profiles.phone, '') = '' then excluded.phone
      else public.profiles.phone
    end,
    updated_at = now();
end;
$$;

grant execute on function public.ensure_my_profile() to authenticated;

-- 이미 생성됐지만 profiles가 누락된 회원도 일괄 복구합니다.
insert into public.profiles (
  id, email, manager_name, company_name, phone, point_balance, role, account_status
)
select
  u.id,
  coalesce(u.email, ''),
  coalesce(u.raw_user_meta_data ->> 'manager_name', u.raw_user_meta_data ->> 'name', ''),
  coalesce(u.raw_user_meta_data ->> 'company_name', u.raw_user_meta_data ->> 'company', ''),
  coalesce(u.raw_user_meta_data ->> 'phone', ''),
  0,
  'user',
  'active'
from auth.users u
on conflict (id) do update set
  email = excluded.email,
  manager_name = case when coalesce(public.profiles.manager_name, '') = '' then excluded.manager_name else public.profiles.manager_name end,
  company_name = case when coalesce(public.profiles.company_name, '') = '' then excluded.company_name else public.profiles.company_name end,
  phone = case when coalesce(public.profiles.phone, '') = '' then excluded.phone else public.profiles.phone end,
  updated_at = now();
