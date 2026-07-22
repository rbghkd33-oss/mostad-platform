import { createHash } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

function text(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function isAllowedOrigin(request: NextRequest) {
  const origin = request.headers.get("origin");
  if (!origin) return true;
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const allowed = new Set([
    configured,
    "https://mplatform.kr",
    "https://www.mplatform.kr",
    "http://localhost:3000",
  ].filter(Boolean));
  return allowed.has(origin.replace(/\/$/, ""));
}

export async function POST(request: NextRequest) {
  try {
    if (!isAllowedOrigin(request)) {
      return NextResponse.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "회원가입 정보를 확인해 주세요." }, { status: 400 });
    }

    const managerName = text(body.managerName, 60);
    const companyName = text(body.companyName, 100);
    const phone = text(body.phone, 20);
    const email = text(body.email, 254).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";

    if (!managerName || !companyName || !phone || !email || !password) {
      return NextResponse.json({ error: "필수 정보를 모두 입력해 주세요." }, { status: 400 });
    }
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "올바른 이메일 주소를 입력해 주세요." }, { status: 400 });
    }
    if (password.length < 8 || password.length > 72) {
      return NextResponse.json({ error: "비밀번호는 8자 이상 72자 이하로 입력해 주세요." }, { status: 400 });
    }

    const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    const userAgent = request.headers.get("user-agent") ?? "unknown";
    const fingerprint = createHash("sha256")
      .update(`${forwardedFor}|${userAgent}|${process.env.LUCY_PAYMENTS_WEBHOOK_SECRET ?? "mostad"}`)
      .digest("hex");

    const service = getSupabaseServiceClient();
    const { data: allowed, error: rateError } = await service.rpc("consume_public_signup_attempt", {
      p_fingerprint: fingerprint,
    });

    if (rateError) {
      console.error("signup rate limit error", rateError);
      return NextResponse.json({ error: "회원가입 처리 준비 중 오류가 발생했습니다." }, { status: 500 });
    }
    if (!allowed) {
      return NextResponse.json({ error: "회원가입 요청이 너무 많습니다. 1시간 뒤 다시 시도해 주세요." }, { status: 429 });
    }

    const { data, error } = await service.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        manager_name: managerName,
        company_name: companyName,
        phone,
      },
    });

    if (error) {
      const lower = error.message.toLowerCase();
      if (lower.includes("already") || lower.includes("registered") || lower.includes("exists")) {
        return NextResponse.json({ error: "이미 가입된 이메일입니다. 로그인해 주세요." }, { status: 409 });
      }
      console.error("admin create user error", error);
      return NextResponse.json({ error: `회원가입 오류: ${error.message}` }, { status: 400 });
    }

    if (!data.user) {
      return NextResponse.json({ error: "회원 계정을 생성하지 못했습니다." }, { status: 500 });
    }

    const { error: profileError } = await service.from("profiles").upsert({
      id: data.user.id,
      email,
      manager_name: managerName,
      company_name: companyName,
      phone,
      point_balance: 0,
      role: "user",
      account_status: "active",
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });

    if (profileError) {
      console.error("profile upsert error", profileError);
      await service.auth.admin.deleteUser(data.user.id).catch(() => undefined);
      return NextResponse.json({ error: "회원정보 저장에 실패했습니다. 다시 시도해 주세요." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("signup route error", error);
    return NextResponse.json({ error: "회원가입 처리 중 오류가 발생했습니다." }, { status: 500 });
  }
}
