import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import {
  sendAdminOrderAlimtalk,
  sendCustomerPointUseAlimtalk,
} from "@/lib/solapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PRICE = 150000;

const text = (value: unknown, maxLength: number) =>
  typeof value === "string" ? value.trim().slice(0, maxLength) : "";

const numberValue = (value: unknown, fallback: number, max: number) =>
  Number.isFinite(Number(value))
    ? Math.max(0, Math.min(Math.trunc(Number(value)), max))
    : fallback;

function encryptionKey() {
  const secret = process.env.INSTAGRAM_CREDENTIAL_ENCRYPTION_KEY?.trim();

  if (!secret || secret.length < 32) {
    throw new Error("인스타 로그인 암호화 키가 설정되지 않았습니다.");
  }

  return createHash("sha256").update(secret).digest();
}

function encrypt(password: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(password, "utf8"),
    cipher.final(),
  ]);

  return {
    ciphertext: encrypted.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
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
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return NextResponse.json(
        { error: "서버 환경변수가 설정되지 않았습니다." },
        { status: 500 },
      );
    }

    const authorization = request.headers.get("authorization") ?? "";
    const accessToken = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : "";

    if (!accessToken) {
      return NextResponse.json(
        { error: "로그인이 필요합니다." },
        { status: 401 },
      );
    }

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!userResponse.ok) {
      return NextResponse.json(
        { error: "로그인 정보가 만료되었습니다." },
        { status: 401 },
      );
    }

    const user = (await userResponse.json()) as {
      id?: string;
      email?: string;
    };

    if (!user.id) {
      return NextResponse.json(
        { error: "회원 정보를 확인하지 못했습니다." },
        { status: 401 },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    const instagramUsername = text(body.instagramUsername, 100).replace(/^@/, "");
    const instagramPassword =
      typeof body.instagramPassword === "string"
        ? body.instagramPassword
        : "";

    if (!instagramUsername) {
      return NextResponse.json(
        { error: "인스타그램 아이디를 입력해 주세요." },
        { status: 400 },
      );
    }

    if (instagramPassword.length < 4 || instagramPassword.length > 200) {
      return NextResponse.json(
        { error: "인스타그램 비밀번호를 정확히 입력해 주세요." },
        { status: 400 },
      );
    }

    const encrypted = encrypt(instagramPassword);

    const rpcResponse = await fetch(
      `${supabaseUrl}/rest/v1/rpc/create_instagram_optimization_order_secure`,
      {
        method: "POST",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          p_user_id: user.id,
          p_instagram_username: instagramUsername,
          p_password_ciphertext: encrypted.ciphertext,
          p_password_iv: encrypted.iv,
          p_password_tag: encrypted.tag,
          p_follow_enabled: Boolean(body.followEnabled),
          p_follow_keywords: text(body.followKeywords, 500),
          p_feed_follow_limit: numberValue(body.feedFollowLimit, 10, 500),
          p_search_follow_limit: numberValue(body.searchFollowLimit, 10, 500),
          p_like_enabled: Boolean(body.likeEnabled),
          p_like_keywords: text(body.likeKeywords, 500),
          p_feed_like_limit: numberValue(body.feedLikeLimit, 25, 1000),
          p_search_like_limit: numberValue(body.searchLikeLimit, 25, 1000),
          p_story_enabled: Boolean(body.storyEnabled),
          p_story_daily_limit: numberValue(body.storyDailyLimit, 30, 1000),
          p_comment_enabled: Boolean(body.commentEnabled),
          p_comment_daily_limit: numberValue(body.commentDailyLimit, 5, 100),
          p_comment_templates: text(body.commentTemplates, 5000),
        }),
      },
    );

    const rpcData = (await rpcResponse.json().catch(() => null)) as
      | { message?: string }
      | number
      | null;

    if (!rpcResponse.ok) {
      return NextResponse.json(
        {
          error:
            rpcData &&
            typeof rpcData === "object" &&
            "message" in rpcData
              ? String(rpcData.message)
              : "인스타 계정 신청 중 오류가 발생했습니다.",
        },
        { status: 400 },
      );
    }

    // 주문 생성 및 포인트 차감 성공 후 프로필/잔액을 조회합니다.
    const profileResponse = await fetch(
      `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(
        user.id,
      )}&select=manager_name,company_name,phone,point_balance`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        cache: "no-store",
      },
    );

    const profiles = profileResponse.ok
      ? ((await profileResponse.json()) as Array<{
          manager_name?: string | null;
          company_name?: string | null;
          phone?: string | null;
          point_balance?: number | null;
        }>)
      : [];

    const profile = profiles[0];
    const customerName =
      profile?.manager_name?.trim() || user.email || "고객";
    const companyName =
      profile?.company_name?.trim() || "업체명 미등록";
    const remainingPoints = Number(profile?.point_balance ?? 0);
    const productName = `인스타 계정 최적화 @${instagramUsername}`;
    const processedAt = koreanDateTime();

    // 알림톡 실패는 주문과 포인트 차감에 영향을 주지 않습니다.
    const notifications = await Promise.allSettled([
      profile?.phone
        ? sendCustomerPointUseAlimtalk({
            to: profile.phone,
            customerName,
            productName,
            usedPoints: PRICE,
            remainingPoints,
            processedAt,
          })
        : Promise.reject(new Error("고객 연락처가 없습니다.")),
      sendAdminOrderAlimtalk({
        customerName,
        companyName,
        productName,
        usedPoints: PRICE,
        requestedAt: processedAt,
      }),
    ]);

    notifications.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(
          index === 0
            ? "인스타 신청 고객 알림톡 발송 실패:"
            : "인스타 신청 관리자 알림톡 발송 실패:",
          result.reason,
        );
      }
    });

    return NextResponse.json({
      ok: true,
      orderId: rpcData,
      balance: remainingPoints,
    });
  } catch (error) {
    console.error("인스타 계정 신청 오류:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "인스타 계정 신청 중 오류가 발생했습니다.",
      },
      { status: 500 },
    );
  }
}
