import { createDecipheriv, createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAdmin, errorStatus } from "@/lib/server-auth";
import {
  AutomationApiError,
  callAutomationApi,
  normalizeInstagramUsername,
} from "@/lib/instagram-automation-server";
import { sendInstagramApprovedAlimtalk } from "@/lib/solapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function dateText(value: string | null | undefined): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function encryptionKey() {
  const secret = process.env.INSTAGRAM_CREDENTIAL_ENCRYPTION_KEY?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("인스타 로그인 암호화 키가 설정되지 않았습니다.");
  }
  return createHash("sha256").update(secret).digest();
}

function decrypt(ciphertext: string, iv: string, tag: string): string {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

export async function POST(request: NextRequest) {
  let username = "";
  let accountWasCreated = false;

  try {
    const { service, tokenClient } = await requireAdmin(request);
    const body = (await request.json()) as {
      orderId?: unknown;
      approve?: unknown;
      note?: unknown;
    };
    const orderId = Number(body.orderId);
    const approve = body.approve === true;
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 2000) : "";

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return NextResponse.json({ error: "올바른 신청 번호가 아닙니다." }, { status: 400 });
    }
    if (!approve && !note) {
      return NextResponse.json({ error: "반려 사유를 입력해 주세요." }, { status: 400 });
    }

    const { data: order, error: orderError } = await service
      .from("instagram_optimization_orders")
      .select(
        "id,user_id,status,instagram_username,password_ciphertext,password_iv,password_tag,follow_enabled,follow_keywords,feed_follow_limit,search_follow_limit,like_enabled,like_keywords,feed_like_limit,search_like_limit,story_enabled,story_daily_limit,comment_enabled,comment_daily_limit,comment_templates",
      )
      .eq("id", orderId)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ error: "신청을 찾을 수 없습니다." }, { status: 404 });
    }
    if (order.status !== "pending_approval") {
      return NextResponse.json({ error: "승인 대기 중인 신청만 처리할 수 있습니다." }, { status: 409 });
    }

    if (!approve) {
      const { error } = await tokenClient.rpc("admin_review_instagram_order", {
        p_order_id: orderId,
        p_approve: false,
        p_note: note,
      });
      if (error) throw new Error(error.message);
      return NextResponse.json({ ok: true, status: "rejected" });
    }

    if (!order.password_ciphertext || !order.password_iv || !order.password_tag) {
      return NextResponse.json({ error: "등록된 인스타 로그인 정보가 없습니다." }, { status: 400 });
    }

    username = normalizeInstagramUsername(order.instagram_username);
    const password = decrypt(order.password_ciphertext, order.password_iv, order.password_tag);

    try {
      await callAutomationApi<{ status?: string; id?: number }>(
        "/api/external/admin/accounts/add",
        {
          method: "POST",
          body: JSON.stringify({
            insta_id: username,
            insta_pw: password,
            proxy_ip_port: null,
          }),
        },
        20_000,
      );
      accountWasCreated = true;
    } catch (error) {
      if (!(error instanceof AutomationApiError) || error.status !== 400) throw error;
      // 이미 자동화 서버에 등록된 계정이면 설정 동기화와 재가동을 계속 진행합니다.
    }

    await callAutomationApi(
      `/api/external/admin/accounts/${encodeURIComponent(username)}/settings`,
      {
        method: "POST",
        body: JSON.stringify({
          follow_enabled: Boolean(order.follow_enabled),
          follow_keywords: order.follow_keywords ?? "",
          feed_follow_limit: Number(order.feed_follow_limit ?? 0),
          search_follow_limit: Number(order.search_follow_limit ?? 0),
          like_enabled: Boolean(order.like_enabled),
          like_keywords: order.like_keywords ?? "",
          feed_like_limit: Number(order.feed_like_limit ?? 0),
          search_like_limit: Number(order.search_like_limit ?? 0),
          story_enabled: Boolean(order.story_enabled),
          story_daily_limit: Number(order.story_daily_limit ?? 0),
          comment_enabled: Boolean(order.comment_enabled),
          comment_daily_limit: Number(order.comment_daily_limit ?? 0),
          comment_templates: order.comment_templates ?? "",
        }),
      },
      20_000,
    );

    await callAutomationApi(
      `/api/external/admin/accounts/${encodeURIComponent(username)}/start`,
      { method: "POST" },
      20_000,
    );

    const { error: reviewError } = await tokenClient.rpc("admin_review_instagram_order", {
      p_order_id: orderId,
      p_approve: true,
      p_note: "",
    });
    if (reviewError) throw new Error(reviewError.message);

    // 승인은 이미 완료된 상태입니다.
    // 알림톡 실패가 승인 결과에 영향을 주지 않도록 별도로 처리합니다.
    try {
      const [
        { data: approvedOrder, error: approvedOrderError },
        { data: profile, error: profileError },
      ] = await Promise.all([
        service
          .from("instagram_optimization_orders")
          .select("service_start_at,service_end_at")
          .eq("id", orderId)
          .single(),
        service
          .from("profiles")
          .select("manager_name,phone")
          .eq("id", order.user_id)
          .single(),
      ]);

      if (approvedOrderError) throw approvedOrderError;
      if (profileError) throw profileError;
      if (!profile?.phone) throw new Error("고객 연락처가 없습니다.");

      await sendInstagramApprovedAlimtalk({
        to: profile.phone,
        customerName: profile.manager_name?.trim() || "고객",
        instagramUsername: `@${username}`,
        startDate: dateText(approvedOrder?.service_start_at),
        endDate: dateText(approvedOrder?.service_end_at),
      });
    } catch (notificationError) {
      console.error("인스타 승인 알림톡 발송 실패:", notificationError);
    }

    return NextResponse.json({ ok: true, status: "active", username });
  } catch (error) {
    if (username) {
      await callAutomationApi(
        `/api/external/admin/accounts/${encodeURIComponent(username)}/stop`,
        { method: "POST" },
      ).catch(() => undefined);

      if (accountWasCreated) {
        await callAutomationApi(
          `/api/external/admin/accounts/${encodeURIComponent(username)}`,
          { method: "DELETE" },
        ).catch(() => undefined);
      }
    }

    const status = error instanceof AutomationApiError ? error.status : errorStatus(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "인스타 신청 처리 중 오류가 발생했습니다." },
      { status },
    );
  }
}
