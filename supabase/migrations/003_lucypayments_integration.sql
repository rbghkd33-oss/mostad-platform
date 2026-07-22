-- 루시페이먼츠 포인트 충전 연동
-- 001, 002 실행 후 Supabase SQL Editor에서 실행하세요.

alter table public.payment_orders add column if not exists pg_order_no text;
alter table public.payment_orders add column if not exists card_no_masked text;
alter table public.payment_orders add column if not exists card_code text;
alter table public.payment_orders add column if not exists quota text;
alter table public.payment_orders add column if not exists point_granted_at timestamptz;
alter table public.payment_orders add column if not exists notification_received_at timestamptz;
alter table public.payment_orders add column if not exists last_error text;

create unique index if not exists point_transactions_payment_id_unique
  on public.point_transactions(payment_id)
  where payment_id is not null;

create or replace function public.process_lucy_payment_notification(
  p_merchant_order_no text,
  p_mid text,
  p_status text,
  p_approve_amount bigint,
  p_cancel_amount bigint,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.payment_orders%rowtype;
  v_before bigint;
  v_after bigint;
  v_normalized_status text;
  v_granted boolean := false;
begin
  select * into v_order
  from public.payment_orders
  where order_no = p_merchant_order_no
  for update;

  if not found then
    raise exception '주문번호를 찾을 수 없습니다.';
  end if;

  if p_approve_amount <> v_order.amount then
    update public.payment_orders
    set status = 'failed', last_error = '승인금액 불일치', raw_result = p_payload,
        notification_received_at = now(), updated_at = now()
    where id = v_order.id;
    raise exception '승인금액이 주문금액과 일치하지 않습니다.';
  end if;

  v_normalized_status := case upper(p_status)
    when 'APPROVED' then 'approved'
    when 'CANCELED' then 'canceled'
    when 'PARTIAL' then 'partial_canceled'
    else 'failed'
  end;

  update public.payment_orders
  set status = case when upper(p_status) = 'APPROVED' and point_granted_at is not null then 'point_granted' else v_normalized_status end,
      pg_order_no = nullif(p_payload->>'order_no',''),
      pg_tid = coalesce(nullif(p_payload->>'pg_tid',''), nullif(p_payload->>'order_no','')),
      auth_no = nullif(p_payload->>'auth_no',''),
      payment_method = nullif(p_payload->>'pay_method',''),
      card_name = nullif(p_payload->>'card_name',''),
      card_no_masked = nullif(p_payload->>'card_no',''),
      card_code = nullif(p_payload->>'card_code',''),
      quota = nullif(p_payload->>'quota',''),
      canceled_amount = greatest(coalesce(p_cancel_amount, 0), 0),
      approved_at = case
        when coalesce(p_payload->>'approve_date','') ~ '^[0-9]{8}$' and coalesce(p_payload->>'approve_time','') ~ '^[0-9]{6}$'
        then to_timestamp((p_payload->>'approve_date') || (p_payload->>'approve_time'), 'YYYYMMDDHH24MISS')
        else approved_at
      end,
      raw_result = p_payload,
      notification_received_at = now(),
      updated_at = now()
  where id = v_order.id;

  if upper(p_status) = 'APPROVED' and v_order.point_granted_at is null then
    select point_balance into v_before from public.profiles where id = v_order.user_id for update;
    if v_before is null then raise exception '회원 포인트 계정을 찾을 수 없습니다.'; end if;

    v_after := v_before + v_order.point_amount;
    update public.profiles set point_balance = v_after, updated_at = now() where id = v_order.user_id;

    insert into public.point_transactions
      (user_id, transaction_type, amount, balance_after, description, payment_id)
    values
      (v_order.user_id, 'charge', v_order.point_amount, v_after,
       '[루시페이먼츠] 포인트 충전', v_order.order_no)
    on conflict (payment_id) where payment_id is not null do nothing;

    update public.payment_orders
    set status = 'point_granted', point_granted_at = now(), updated_at = now()
    where id = v_order.id and point_granted_at is null;
    v_granted := true;
  elsif upper(p_status) in ('CANCELED','PARTIAL') and v_order.point_granted_at is not null then
    update public.payment_orders
    set last_error = '결제 취소/부분취소 발생: 포인트 회수는 관리자 확인 필요', updated_at = now()
    where id = v_order.id;
  end if;

  return jsonb_build_object(
    'order_no', v_order.order_no,
    'status', case when v_granted then 'point_granted' else v_normalized_status end,
    'point_granted', v_granted
  );
end;
$$;

revoke all on function public.process_lucy_payment_notification(text,text,text,bigint,bigint,jsonb) from public, anon, authenticated;
grant execute on function public.process_lucy_payment_notification(text,text,text,bigint,bigint,jsonb) to service_role;
