import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { sendPointChargeCompletedAlimtalk } from "@/lib/solapi";

export const runtime = "nodejs";

function asNumber(value: unknown) {
  const number = Number(String(value ?? "").replace(/[^0-9-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

function koreanDateTime() {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date());
}

export async function POST(request: NextRequest) {
  try {
    const expectedSecret = process.env.LUCY_PAYMENTS_WEBHOOK_SECRET;
    const receivedSecret = request.nextUrl.searchParams.get("key");

    if (!expectedSecret || receivedSecret !== expectedSecret) {
      return NextResponse.json(
        { ok: false, error: "unauthorized" },
        { status: 401 },
      );
    }

    const payload = await request.json();
    const expectedMid = process.env.LUCY_PAYMENTS_MID;

    if (!expectedMid || payload.mid !== expectedMid) {
      return NextResponse.json(
        { ok: false, error: "MID mismatch" },
        { status: 400 },
      );
    }

    const merchantOrderNo = String(payload.tid || "").trim();

    if (!merchantOrderNo) {
      return NextResponse.json(
        { ok: false, error: "merchant order number missing" },
        { status: 400 },
      );
    }

    const service = getSupabaseServiceClient();

    const { data, error } = await service.rpc(
      "process_lucy_payment_notification",
      {
        p_merchant_order_no: merchantOrderNo,
        p_mid: String(payload.mid || ""),
        p_status: String(payload.status || ""),
        p_approve_amount: asNumber(payload.approve_amount),
        p_cancel_amount: asNumber(payload.cancel_amount),
        p_payload: payload,
      },
    );

    if (error) {
      console.error("Lucy notification RPC failed", error, payload);
      return NextResponse.json(
        { ok: false, error: error.message },
        { status: 400 },
      );
    }

    const { data: payment, error: paymentError } = await service
      .from("payment_orders")
      .select("id,user_id,order_no,amount,point_amount,status")
      .eq("order_no", merchantOrderNo)
      .maybeSingle();

    if (paymentError) {
      console.error("결제 주문 조회 실패:", paymentError);
    }

    if (payment?.status === "point_granted") {
      const eventKey = `point_charge:${payment.id}`;

      const { error: eventError } = await service
        .from("alimtalk_delivery_events")
        .insert({
          event_key: eventKey,
          event_type: "point_charge_completed",
          user_id: payment.user_id,
          reference_id: String(payment.id),
          status: "processing",
        });

      if (!eventError) {
        try {
          const { data: profile, error: profileError } = await service
            .from("profiles")
            .select("manager_name,phone,point_balance")
            .eq("id", payment.user_id)
            .single();

          if (profileError) throw profileError;
          if (!profile?.phone) throw new Error("고객 연락처가 없습니다.");

          await sendPointChargeCompletedAlimtalk({
            to: profile.phone,
            customerName: profile.manager_name?.trim() || "고객",
            chargedPoints: Number(payment.point_amount ?? 0),
            paidAmount: Number(payment.amount ?? 0),
            currentBalance: Number(profile.point_balance ?? 0),
            orderNumber: payment.order_no,
            processedAt: koreanDateTime(),
          });

          await service
            .from("alimtalk_delivery_events")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              error_message: null,
            })
            .eq("event_key", eventKey);
        } catch (notificationError) {
          console.error("포인트 충전 완료 알림톡 발송 실패:", notificationError);

          await service
            .from("alimtalk_delivery_events")
            .update({
              status: "failed",
              error_message:
                notificationError instanceof Error
                  ? notificationError.message.slice(0, 2000)
                  : "알 수 없는 알림톡 오류",
            })
            .eq("event_key", eventKey);
        }
      } else if (eventError.code !== "23505") {
        console.error("알림톡 중복 방지 이벤트 생성 실패:", eventError);
      }
    }

    return NextResponse.json({ ok: true, result: data });
  } catch (error) {
    console.error("Lucy notification error", error);

    return NextResponse.json(
      { ok: false, error: "invalid notification" },
      { status: 400 },
    );
  }
}
