import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

function asNumber(value: unknown) {
  const number = Number(String(value ?? "").replace(/[^0-9-]/g, ""));
  return Number.isFinite(number) ? number : 0;
}

export async function POST(request: NextRequest) {
  try {
    const expectedSecret = process.env.LUCY_PAYMENTS_WEBHOOK_SECRET;
    const receivedSecret = request.nextUrl.searchParams.get("key");
    if (!expectedSecret || receivedSecret !== expectedSecret) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
    }

    const payload = await request.json();
    const expectedMid = process.env.LUCY_PAYMENTS_MID;
    if (!expectedMid || payload.mid !== expectedMid) {
      return NextResponse.json({ ok: false, error: "MID mismatch" }, { status: 400 });
    }

    const merchantOrderNo = String(payload.tid || "").trim();
    if (!merchantOrderNo) {
      return NextResponse.json({ ok: false, error: "merchant order number missing" }, { status: 400 });
    }

    const service = getSupabaseServiceClient();
    const { data, error } = await service.rpc("process_lucy_payment_notification", {
      p_merchant_order_no: merchantOrderNo,
      p_mid: String(payload.mid || ""),
      p_status: String(payload.status || ""),
      p_approve_amount: asNumber(payload.approve_amount),
      p_cancel_amount: asNumber(payload.cancel_amount),
      p_payload: payload,
    });

    if (error) {
      console.error("Lucy notification RPC failed", error, payload);
      return NextResponse.json({ ok: false, error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, result: data });
  } catch (error) {
    console.error("Lucy notification error", error);
    return NextResponse.json({ ok: false, error: "invalid notification" }, { status: 400 });
  }
}
