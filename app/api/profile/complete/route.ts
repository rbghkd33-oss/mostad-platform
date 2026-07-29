import { NextResponse } from "next/server";
import { getSupabaseTokenClient } from "@/lib/supabase-server";

type ProfileCompleteBody = { managerName?: string; companyName?: string; phone?: string };

export async function POST(request: Request) {
  try {
    const authorization = request.headers.get("authorization");
    if (!authorization?.startsWith("Bearer ")) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    const accessToken = authorization.slice("Bearer ".length).trim();
    const supabase = getSupabaseTokenClient(accessToken);
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) return NextResponse.json({ error: "유효하지 않은 로그인 정보입니다." }, { status: 401 });
    const body = (await request.json()) as ProfileCompleteBody;
    const managerName = body.managerName?.trim() ?? "";
    const companyName = body.companyName?.trim() ?? "";
    const phone = body.phone?.trim() ?? "";
    if (!managerName || !companyName || !phone) return NextResponse.json({ error: "담당자명, 업체명, 연락처를 모두 입력해 주세요." }, { status: 400 });
    if (!/^010-\d{3,4}-\d{4}$/.test(phone)) return NextResponse.json({ error: "올바른 연락처를 입력해 주세요." }, { status: 400 });
    const email = userData.user.email ?? (typeof userData.user.user_metadata?.email === "string" ? userData.user.user_metadata.email : "");
    const { error: upsertError } = await supabase.from("profiles").upsert({ id:userData.user.id, email, manager_name:managerName, company_name:companyName, phone, role:"user" }, { onConflict:"id" });
    if (upsertError) { console.error("프로필 저장 실패:", upsertError); return NextResponse.json({ error: "프로필 저장 중 오류가 발생했습니다." }, { status: 500 }); }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("프로필 완료 API 오류:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
