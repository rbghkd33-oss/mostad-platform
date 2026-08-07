import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_STATUSES = new Set(["new", "contacted", "confirmed", "completed", "canceled"]);

function env() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) throw new Error("Supabase 서버 환경변수가 설정되지 않았습니다.");
  return { supabaseUrl, serviceKey };
}

function tokenFrom(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

async function requireAdmin(request: NextRequest) {
  const { supabaseUrl, serviceKey } = env();
  const token = tokenFrom(request);
  if (!token) return { error: NextResponse.json({ message: "로그인이 필요합니다." }, { status: 401 }) };

  const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!userResponse.ok) {
    return { error: NextResponse.json({ message: "로그인 정보를 확인할 수 없습니다." }, { status: 401 }) };
  }

  const user = (await userResponse.json()) as { id?: string };
  if (!user.id) {
    return { error: NextResponse.json({ message: "로그인 정보를 확인할 수 없습니다." }, { status: 401 }) };
  }

  const profileResponse = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role,account_status&limit=1`,
    {
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
      },
      cache: "no-store",
    },
  );

  if (!profileResponse.ok) {
    return { error: NextResponse.json({ message: "관리자 권한을 확인하지 못했습니다." }, { status: 500 }) };
  }

  const profiles = (await profileResponse.json()) as Array<{ role?: string; account_status?: string }>;
  const profile = profiles[0];

  if (!profile || !["admin", "super_admin"].includes(profile.role || "") || profile.account_status !== "active") {
    return { error: NextResponse.json({ message: "관리자 권한이 필요합니다." }, { status: 403 }) };
  }

  return { supabaseUrl, serviceKey };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request);
    if ("error" in auth) return auth.error;

    const { supabaseUrl, serviceKey } = auth;
    const response = await fetch(
      `${supabaseUrl}/rest/v1/marketing_lecture_applications?select=id,name,company,phone,interest,status,created_at,privacy_agreed_at,source&order=created_at.desc&limit=200`,
      {
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      console.error(await response.text());
      return NextResponse.json({ message: "무료강의 신청 내역을 불러오지 못했습니다." }, { status: 500 });
    }

    return NextResponse.json({ applications: await response.json() });
  } catch (error) {
    console.error(error);
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

    const body = (await request.json().catch(() => null)) as { id?: unknown; status?: unknown } | null;
    const id = Number(body?.id);
    const status = typeof body?.status === "string" ? body.status.trim() : "";

    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ message: "잘못된 신청 번호입니다." }, { status: 400 });
    }
    if (!ALLOWED_STATUSES.has(status)) {
      return NextResponse.json({ message: "잘못된 상태 값입니다." }, { status: 400 });
    }

    const { supabaseUrl, serviceKey } = auth;
    const response = await fetch(
      `${supabaseUrl}/rest/v1/marketing_lecture_applications?id=eq.${id}`,
      {
        method: "PATCH",
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          "Content-Type": "application/json",
          Prefer: "return=minimal",
        },
        body: JSON.stringify({ status }),
        cache: "no-store",
      },
    );

    if (!response.ok) {
      console.error(await response.text());
      return NextResponse.json({ message: "무료강의 신청 상태를 변경하지 못했습니다." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { message: error instanceof Error ? error.message : "무료강의 신청 상태 변경 중 오류가 발생했습니다." },
      { status: 500 },
    );
  }
}
