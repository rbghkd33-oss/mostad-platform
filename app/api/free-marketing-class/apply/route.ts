import { NextRequest, NextResponse } from "next/server";
import { sendFreeClassApplicationAlimtalk } from "@/lib/solapi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const clean = (value: unknown, max: number) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      name?: unknown;
      company?: unknown;
      phone?: unknown;
      interest?: unknown;
      privacyAgreed?: unknown;
    } | null;

    const name = clean(body?.name, 30);
    const company = clean(body?.company, 80);
    const phone = clean(body?.phone, 20);
    const interest = clean(body?.interest, 50);
    const privacyAgreed = body?.privacyAgreed === true;

    if (!name) return NextResponse.json({ message: "이름을 입력해 주세요." }, { status: 400 });
    if (!/^01[016789]-?\d{3,4}-?\d{4}$/.test(phone)) {
      return NextResponse.json({ message: "휴대전화 번호를 정확히 입력해 주세요." }, { status: 400 });
    }
    if (!interest) return NextResponse.json({ message: "관심 마케팅 분야를 선택해 주세요." }, { status: 400 });
    if (!privacyAgreed) {
      return NextResponse.json({ message: "개인정보 수집 및 이용 동의가 필요합니다." }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !service) {
      return NextResponse.json({ message: "서버 환경변수가 설정되지 않았습니다." }, { status: 500 });
    }

    const normalizedPhone = phone.replace(/\D/g, "");
    const response = await fetch(`${supabaseUrl}/rest/v1/marketing_lecture_applications`, {
      method: "POST",
      headers: {
        apikey: service,
        Authorization: `Bearer ${service}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({
        name,
        company: company || null,
        phone: normalizedPhone,
        interest,
        privacy_agreed: true,
        privacy_agreed_at: new Date().toISOString(),
        source: "free-marketing-class-landing",
        status: "new",
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      console.error(await response.text());
      return NextResponse.json({ message: "신청 접수 중 오류가 발생했습니다." }, { status: 500 });
    }

    try {
      await sendFreeClassApplicationAlimtalk({
        to: normalizedPhone,
        customerName: name,
        companyName: company,
        interest,
      });
    } catch (alimtalkError) {
      console.error("무료강의 신청완료 알림톡 발송 실패:", alimtalkError);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ message: "신청 접수 중 오류가 발생했습니다." }, { status: 500 });
  }
}
