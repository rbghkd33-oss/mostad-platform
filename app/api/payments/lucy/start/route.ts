import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient, getSupabaseTokenClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

const LUCY_READY_URL = "https://lucypayments.com/api/pay/ready";
const LUCY_AUTH_URL = "https://lucypayments.com/api/pay/auth";

function makeOrderNo() {
  const now = new Date();
  const stamp = [
    now.getUTCFullYear(),
    String(now.getUTCMonth() + 1).padStart(2, "0"),
    String(now.getUTCDate()).padStart(2, "0"),
    String(now.getUTCHours()).padStart(2, "0"),
    String(now.getUTCMinutes()).padStart(2, "0"),
    String(now.getUTCSeconds()).padStart(2, "0"),
    String(now.getUTCMilliseconds()).padStart(3, "0"),
  ].join("");
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase();
  return `MOSTAD${stamp}${random}`;
}

function extractToken(payload: unknown): string | null {
  if (typeof payload === "string") {
    const trimmed = payload.trim();
    if (!trimmed) return null;
    try {
      return extractToken(JSON.parse(trimmed));
    } catch {
      return trimmed.replace(/^"|"$/g, "");
    }
  }
  if (!payload || typeof payload !== "object") return null;
  const value = payload as Record<string, unknown>;
  const candidates = [value.TOKEN, value.token, value.access_token, value.data];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    if (candidate && typeof candidate === "object") {
      const nested = extractToken(candidate);
      if (nested) return nested;
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const authorization = request.headers.get("authorization") || "";
    const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!accessToken) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

    const tokenClient = getSupabaseTokenClient(accessToken);
    const { data: userData, error: userError } = await tokenClient.auth.getUser(accessToken);
    if (userError || !userData.user) {
      return NextResponse.json({ error: "로그인 정보가 만료되었습니다." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const pointAmount = Number(body.pointAmount);
    const paymentAmount = Number(body.paymentAmount);
    const deviceType = body.deviceType === "M" ? "M" : "P";

    if (!Number.isSafeInteger(pointAmount) || pointAmount < 10000) {
      return NextResponse.json({ error: "최소 충전 포인트는 10,000P입니다." }, { status: 400 });
    }
    if (!Number.isSafeInteger(paymentAmount) || paymentAmount <= 0) {
      return NextResponse.json({ error: "결제금액이 올바르지 않습니다." }, { status: 400 });
    }

    const mid = process.env.LUCY_PAYMENTS_MID;
    const apiKey = process.env.LUCY_PAYMENTS_API_KEY;
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://mplatform.kr").replace(/\/$/, "");
    if (!mid || !apiKey) {
      return NextResponse.json({ error: "루시페이먼츠 환경변수가 설정되지 않았습니다." }, { status: 500 });
    }

    const orderNo = makeOrderNo();
    const service = getSupabaseServiceClient();
    const metadata = userData.user.user_metadata || {};
    const buyerName = String(metadata.name || metadata.manager_name || userData.user.email || "모스트애드 회원").slice(0, 24);

    const { error: insertError } = await service.from("payment_orders").insert({
      order_no: orderNo,
      user_id: userData.user.id,
      amount: paymentAmount,
      point_amount: pointAmount,
      status: "pending",
      payment_method: "AUTH",
      pg_provider: "lucypayments",
    });
    if (insertError) {
      console.error("payment order insert failed", insertError);
      return NextResponse.json({ error: "결제 주문을 생성하지 못했습니다." }, { status: 500 });
    }

    const readyResponse = await fetch(LUCY_READY_URL, {
      method: "POST",
      headers: { Authorization: apiKey, Accept: "application/json, text/plain, */*" },
      cache: "no-store",
    });
    const readyText = await readyResponse.text();
    const token = extractToken(readyText);

    if (!readyResponse.ok || !token) {
      await service.from("payment_orders").update({
        status: "failed",
        last_error: `TOKEN 발급 실패 (${readyResponse.status})`,
        raw_result: { ready_status: readyResponse.status, ready_response: readyText.slice(0, 2000) },
      }).eq("order_no", orderNo);
      return NextResponse.json({ error: "결제 인증토큰을 발급받지 못했습니다." }, { status: 502 });
    }

    const query = `orderNo=${encodeURIComponent(orderNo)}`;
    const fields: Record<string, string> = {
      MID: mid,
      TYPE: deviceType,
      ORDERNO: orderNo,
      PRODUCTNAME: `${pointAmount.toLocaleString("ko-KR")}P 포인트 충전`,
      PRODUCTCODE: "POINT",
      PRODUCTTYPE: "2",
      TAXFREECD: "00",
      AMOUNT: String(paymentAmount),
      USERNAME: buyerName,
      CPQUOTA: "0:2:3:4:5:6:7:8:9:10:11:12",
      BILLTYPE: "1",
      HOMEURL: `${siteUrl}/points/payment/complete?${query}`,
      FAILURL: `${siteUrl}/points/payment/fail?${query}`,
      CLOSEURL: `${siteUrl}/points/payment/close?${query}`,
      RESERVEDINDEX: orderNo,
      TOKEN: token,
    };

    return NextResponse.json({ authUrl: LUCY_AUTH_URL, fields, orderNo });
  } catch (error) {
    console.error("Lucy payment start error", error);
    return NextResponse.json({ error: "결제 준비 중 오류가 발생했습니다." }, { status: 500 });
  }
}
