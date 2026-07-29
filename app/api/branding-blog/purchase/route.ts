import { NextResponse } from "next/server";
import { getSupabaseTokenClient } from "@/lib/supabase-server";
import {
  sendAdminOrderAlimtalk,
  sendCustomerPointUseAlimtalk,
} from "@/lib/solapi";

const PRICES: Record<number, number> = {
  10: 220000,
  20: 440000,
  30: 660000,
};

function koDate() {
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

export async function POST(request: Request) {
  try {
    const auth = request.headers.get("authorization");
    if (!auth?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
    }

    const supabase = getSupabaseTokenClient(auth.slice(7).trim());
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      return NextResponse.json({ error: "로그인 정보가 유효하지 않습니다." }, { status: 401 });
    }

    const body = await request.json();
    const count = Number(body.packageCount);
    const price = PRICES[count];
    const blogUrl = String(body.blogUrl ?? "").trim();
    const companyName = String(body.companyName ?? "").trim();
    const requestNote = String(body.requestNote ?? "").trim();

    if (!price) {
      return NextResponse.json({ error: "올바른 상품 구성을 선택해 주세요." }, { status: 400 });
    }
    if (!blogUrl || !companyName) {
      return NextResponse.json({ error: "블로그 주소와 업체명을 입력해 주세요." }, { status: 400 });
    }

    const { data: orderId, error: purchaseError } = await supabase.rpc(
      "customer_purchase_branding_blog_v2",
      {
        p_package_count: count,
        p_blog_url: blogUrl,
        p_company_name: companyName,
        p_request_note: requestNote,
      },
    );

    if (purchaseError) {
      return NextResponse.json({ error: purchaseError.message }, { status: 400 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("manager_name,company_name,phone,point_balance")
      .eq("id", userData.user.id)
      .single();

    if (profileError || !profile) {
      console.error("주문 후 프로필 조회 실패:", profileError);
      return NextResponse.json({ ok: true, orderId, balance: null });
    }

    const productName = `브랜딩 블로그 최적화 관리 ${count}회`;
    const customerName = profile.manager_name?.trim() || userData.user.email || "고객";
    const time = koDate();

    const notifications = await Promise.allSettled([
      profile.phone
        ? sendCustomerPointUseAlimtalk({
            to: profile.phone,
            customerName,
            productName,
            usedPoints: price,
            remainingPoints: Number(profile.point_balance ?? 0),
            processedAt: time,
          })
        : Promise.reject(new Error("고객 연락처가 없습니다.")),
      sendAdminOrderAlimtalk({
        customerName,
        companyName: profile.company_name?.trim() || companyName,
        productName,
        usedPoints: price,
        requestedAt: time,
      }),
    ]);

    notifications.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(index === 0 ? "고객 알림톡 실패:" : "관리자 알림톡 실패:", result.reason);
      }
    });

    return NextResponse.json({
      ok: true,
      orderId,
      balance: Number(profile.point_balance ?? 0),
    });
  } catch (error) {
    console.error("브랜딩 블로그 구매 API 오류:", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
