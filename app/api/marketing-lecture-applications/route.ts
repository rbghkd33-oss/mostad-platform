import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = new Set([
  "new",
  "contacted",
  "confirmed",
  "completed",
  "canceled",
]);

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase 서버 환경변수가 설정되지 않았습니다.");
  }

  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getAccessToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") || "";
  return authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
}

async function requireAdmin(request: NextRequest) {
  const token = getAccessToken(request);
  if (!token) {
    return { error: NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 }) };
  }

  const admin = getAdminClient();
  const { data: { user }, error: userError } = await admin.auth.getUser(token);

  if (userError || !user) {
    return { error: NextResponse.json({ message: "로그인 정보를 확인할 수 없습니다." }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role,account_status")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.error("lecture admin profile error:", profileError);
    return { error: NextResponse.json({ message: "관리자 권한을 확인하지 못했습니다." }, { status: 500 }) };
  }

  if (!profile || !["admin", "super_admin"].includes(profile.role || "") || profile.account_status !== "active") {
    return { error: NextResponse.json({ message: "관리자 권한이 필요합니다." }, { status: 403 }) };
  }

  return { admin };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if ("error" in auth) return auth.error;

    // POST에서 실제로 저장하는 것으로 확인된 컬럼만 조회합니다.
    const { data, error } = await auth.admin
      .from("marketing_lecture_applications")
      .select("name,company,phone,interest,status,privacy_agreed_at,source")
      .order("privacy_agreed_at", { ascending: false })
      .limit(200);

    if (error) {
      console.error("lecture applications select error:", error);
      return NextResponse.json(
        { message: "무료강의 신청 내역을 불러오지 못했습니다.", detail: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ applications: data ?? [] });
  } catch (error) {
    console.error("lecture applications GET error:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "무료강의 신청 내역 조회 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if ("error" in auth) return auth.error;

    const body = (await request.json().catch(() => null)) as {
      phone?: unknown;
      privacy_agreed_at?: unknown;
      status?: unknown;
    } | null;

    const phone = typeof body?.phone === "string" ? body.phone.replace(/\D/g, "") : "";
    const privacyAgreedAt =
      typeof body?.privacy_agreed_at === "string" ? body.privacy_agreed_at.trim() : "";
    const status = typeof body?.status === "string" ? body.status.trim() : "";

    if (!phone || !privacyAgreedAt) {
      return NextResponse.json({ message: "신청 정보를 식별할 수 없습니다." }, { status: 400 });
    }
    if (!ALLOWED_STATUSES.has(status)) {
      return NextResponse.json({ message: "잘못된 상태 값입니다." }, { status: 400 });
    }

    const { error } = await auth.admin
      .from("marketing_lecture_applications")
      .update({ status })
      .eq("phone", phone)
      .eq("privacy_agreed_at", privacyAgreedAt);

    if (error) {
      console.error("lecture application update error:", error);
      return NextResponse.json(
        { message: "무료강의 신청 상태를 변경하지 못했습니다.", detail: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("lecture applications PATCH error:", error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "무료강의 신청 상태 변경 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
