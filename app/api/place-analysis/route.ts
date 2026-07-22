import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient, getSupabaseTokenClient } from "@/lib/supabase-server";

export const runtime = "nodejs";
export const maxDuration = 60;

const REPORT_API_URL = "https://place.bidamgil.com/api/report";
const REPORT_ORIGIN = "https://place.bidamgil.com";

type DiagnosisBody = { placeId?: unknown; keyword?: unknown; clientName?: unknown };

function cleanText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function normalizePlaceId(value: string) {
  const direct = value.match(/^\d{5,20}$/)?.[0];
  if (direct) return direct;
  return value.match(/(?:place\/|place%2F)(\d{5,20})/i)?.[1] ?? value.match(/(\d{5,20})/)?.[1] ?? "";
}
function absoluteReportUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `${REPORT_ORIGIN}${value.startsWith("/") ? "" : "/"}${value}`;
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  try {
    const authorization = request.headers.get("authorization") ?? "";
    const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!accessToken) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

    const tokenClient = getSupabaseTokenClient(accessToken);
    const { data: userData, error: userError } = await tokenClient.auth.getUser(accessToken);
    if (userError || !userData.user) return NextResponse.json({ error: "로그인 정보가 만료되었습니다. 다시 로그인해 주세요." }, { status: 401 });

    const body = (await request.json().catch(() => null)) as DiagnosisBody | null;
    const placeId = normalizePlaceId(cleanText(body?.placeId, 300));
    const keyword = cleanText(body?.keyword, 80);
    const clientName = cleanText(body?.clientName, 100);
    if (!placeId) return NextResponse.json({ error: "올바른 네이버 플레이스 ID 또는 주소를 입력해 주세요." }, { status: 400 });
    if (!keyword) return NextResponse.json({ error: "진단할 키워드를 입력해 주세요." }, { status: 400 });

    const apiKey = process.env.PLACE_DIAG_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "플레이스 진단 API 키가 설정되지 않았습니다." }, { status: 500 });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 55_000);
    let response: Response;
    try {
      response = await fetch(REPORT_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
        body: JSON.stringify({ place_id: placeId, keywords: [keyword], ...(clientName ? { client_name: clientName } : {}), return_type: "url" }),
        cache: "no-store",
        signal: controller.signal,
      });
    } finally { clearTimeout(timer); }

    const rawText = await response.text();
    let payload: Record<string, unknown>;
    try { payload = JSON.parse(rawText) as Record<string, unknown>; }
    catch { payload = { ok: false, error: rawText.slice(0, 500) || "진단 서버 응답을 해석하지 못했습니다." }; }

    if (!response.ok || payload.ok === false) {
      const message = typeof payload.error === "string" ? payload.error : `진단 요청 실패 (${response.status})`;
      return NextResponse.json({ error: message }, { status: response.status >= 400 ? response.status : 502 });
    }

    const reportUrl = absoluteReportUrl(payload.report_url);
    const result = { ...payload, report_url: reportUrl, elapsed_ms: Date.now() - startedAt };

    try {
      const service = getSupabaseServiceClient();
      await service.from("place_analysis_history").insert({
        user_id: userData.user.id,
        place_id: placeId,
        keyword,
        client_name: clientName || null,
        place_name: (payload.place as Record<string, unknown> | undefined)?.name ?? null,
        my_rank: (payload.summary as Record<string, unknown> | undefined)?.my_rank ?? null,
        visitor_review_count: (payload.place as Record<string, unknown> | undefined)?.visitor_review_count ?? null,
        blog_review_count: (payload.place as Record<string, unknown> | undefined)?.blog_review_count ?? null,
        search_total: ((payload.keyword_stats as Array<Record<string, unknown>> | undefined)?.[0])?.search_total ?? null,
        report_url: reportUrl,
        result_json: result,
      });
    } catch (historyError) { console.error("place analysis history insert failed", historyError); }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return NextResponse.json({ error: "진단 시간이 길어 요청이 종료되었습니다. 잠시 후 다시 시도해 주세요." }, { status: 504 });
    console.error("place analysis proxy error", error);
    return NextResponse.json({ error: "플레이스 진단 중 오류가 발생했습니다." }, { status: 500 });
  }
}
