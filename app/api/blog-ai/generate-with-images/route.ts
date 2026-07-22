import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 300;

const BLOG_API_URL = "https://place.bidamgil.com/api/generate-body-with-images";
const COST = 1000;
const MAX_FILE_COUNT = 12;
const MAX_TOTAL_BYTES = 4 * 1024 * 1024;

function text(value: FormDataEntryValue | null, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function numberValue(value: FormDataEntryValue | null, fallback: number, min: number, max: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}
function event(name: string, data: unknown) {
  return `event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (name: string, data: unknown) => {
        if (!closed) controller.enqueue(encoder.encode(event(name, data)));
      };
      const finish = () => {
        if (!closed) { closed = true; controller.close(); }
      };

      void (async () => {
        const startedAt = Date.now();
        let heartbeat: ReturnType<typeof setInterval> | undefined;
        try {
          send("status", { step: "auth", message: "로그인 정보와 보유 포인트를 확인하고 있습니다." });
          const authorization = request.headers.get("authorization") ?? "";
          const accessToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
          if (!accessToken) throw new Error("로그인이 필요합니다.");

          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
          const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
          const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
          const apiKey = process.env.BLOG_AI_API_KEY || process.env.PLACE_DIAG_API_KEY;
          if (!supabaseUrl || !anonKey || !serviceKey) throw new Error("Supabase 서버 환경변수가 설정되지 않았습니다.");
          if (!apiKey) throw new Error("블로그 AI API 키가 설정되지 않았습니다.");

          const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
            headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` }, cache: "no-store",
          });
          if (!userResponse.ok) throw new Error("로그인 정보가 만료되었습니다. 다시 로그인해 주세요.");
          const user = (await userResponse.json()) as { id?: string };
          if (!user.id) throw new Error("회원 정보를 확인하지 못했습니다.");

          const input = await request.formData();
          const requestId = text(input.get("requestId"), 80);
          const mainKeyword = text(input.get("mainKeyword"), 100);
          const subKeyword = text(input.get("subKeyword"), 500);
          const mainRepeat = numberValue(input.get("mainRepeat"), 6, 1, 30);
          const targetChars = numberValue(input.get("targetChars"), 1500, 500, 10000);
          const paragraphCount = numberValue(input.get("paragraphCount"), 5, 2, 20);
          const toneRaw = text(input.get("tone"), 20);
          const styleRaw = text(input.get("style"), 20);
          const tone = ["haeyo", "hapnida", "hada", "mix"].includes(toneRaw) ? toneRaw : "haeyo";
          const style = ["narrative", "quote"].includes(styleRaw) ? styleRaw : "narrative";
          const guide = text(input.get("guide"), 5000);
          const files = input.getAll("files").filter((item): item is File => item instanceof File && item.size > 0);
          if (!requestId) throw new Error("요청번호를 생성하지 못했습니다. 새로고침 후 다시 시도해 주세요.");
          if (!mainKeyword) throw new Error("메인 키워드를 입력해 주세요.");
          if (!files.length) throw new Error("분석할 이미지를 1장 이상 첨부해 주세요.");
          if (files.length > MAX_FILE_COUNT) throw new Error(`이미지는 최대 ${MAX_FILE_COUNT}장까지 첨부할 수 있습니다.`);
          const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
          if (totalBytes > MAX_TOTAL_BYTES) throw new Error("이미지 전체 용량이 너무 큽니다. 이미지 수를 줄이거나 다시 압축해 주세요.");

          const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=point_balance,account_status`, {
            headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, cache: "no-store",
          });
          if (!profileResponse.ok) throw new Error("포인트 정보를 불러오지 못했습니다.");
          const profiles = (await profileResponse.json()) as Array<{ point_balance?: number; account_status?: string }>;
          const profile = profiles[0];
          if (!profile || profile.account_status !== "active") throw new Error("현재 이용할 수 없는 계정입니다.");
          if (Number(profile.point_balance ?? 0) < COST) {
            send("insufficient", { message: "보유 포인트가 부족합니다.", required: COST, balance: Number(profile.point_balance ?? 0) });
            finish(); return;
          }

          send("status", { step: "analyze", message: `${files.length}장의 이미지를 분석하고 원고를 작성하고 있습니다.`, elapsed: 0 });
          heartbeat = setInterval(() => send("status", {
            step: "analyze", message: "이미지의 장면과 내용을 원고에 자연스럽게 반영하고 있습니다.", elapsed: Math.floor((Date.now()-startedAt)/1000),
          }), 10_000);

          const outbound = new FormData();
          outbound.append("main_keyword", mainKeyword);
          outbound.append("sub_keyword", subKeyword);
          outbound.append("main_repeat", String(mainRepeat));
          outbound.append("target_chars", String(targetChars));
          outbound.append("paragraph_count", String(paragraphCount));
          outbound.append("tone", tone);
          outbound.append("style", style);
          outbound.append("guide", guide);
          files.forEach(file => outbound.append("files", file, file.name));

          const apiController = new AbortController();
          const timer = setTimeout(() => apiController.abort(), 285_000);
          let apiResponse: Response;
          try {
            apiResponse = await fetch(BLOG_API_URL, {
              method: "POST", headers: { "X-API-Key": apiKey }, body: outbound, cache: "no-store", signal: apiController.signal,
            });
          } finally {
            clearTimeout(timer); if (heartbeat) clearInterval(heartbeat);
          }

          const raw = await apiResponse.text();
          let result: Record<string, unknown>;
          try { result = JSON.parse(raw) as Record<string, unknown>; }
          catch { result = { detail: raw.slice(0,500) || "원고 생성 서버 응답을 해석하지 못했습니다." }; }
          if (!apiResponse.ok || typeof result.body !== "string") {
            throw new Error(typeof result.detail === "string" ? result.detail : `이미지 원고 생성 실패 (${apiResponse.status})`);
          }

          send("status", { step: "charge", message: "원고 생성이 완료되어 1,000P를 차감하고 결과를 저장하고 있습니다." });
          const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/complete_blog_ai_image_generation`, {
            method: "POST",
            headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              p_user_id: user.id, p_request_id: requestId, p_main_keyword: mainKeyword, p_sub_keyword: subKeyword,
              p_main_repeat: mainRepeat, p_target_chars: targetChars, p_paragraph_count: paragraphCount,
              p_tone: tone, p_style: style, p_guide: guide, p_body: result.body,
              p_char_count: Number(result.char_count ?? 0), p_retry_count: Number(result.retry_count ?? 0),
              p_reached_target: Boolean(result.reached_target), p_image_names: files.map(file => file.name),
            }),
          });
          const rpcText = await rpcResponse.text();
          let rpcResult: Record<string, unknown> = {};
          try { rpcResult = JSON.parse(rpcText) as Record<string, unknown>; } catch {}
          if (!rpcResponse.ok) throw new Error(typeof rpcResult.message === "string" ? rpcResult.message : "포인트 차감 중 오류가 발생했습니다.");

          send("complete", {
            body: result.body, char_count: Number(result.char_count ?? 0), retry_count: Number(result.retry_count ?? 0),
            reached_target: Boolean(result.reached_target), balance: Number(rpcResult.balance ?? 0), cost: COST,
            elapsed_ms: Date.now()-startedAt, image_names: files.map(file=>file.name),
          });
          finish();
        } catch (error) {
          if (heartbeat) clearInterval(heartbeat);
          const message = error instanceof Error && error.name === "AbortError"
            ? "이미지 원고 생성 시간이 너무 길어 요청이 종료되었습니다. 포인트는 차감되지 않았습니다."
            : error instanceof Error ? error.message : "이미지 원고 생성 중 오류가 발생했습니다.";
          send("error", { message }); finish();
        }
      })();
    },
  });
  return new Response(stream, { headers: { "Content-Type":"text/event-stream; charset=utf-8", "Cache-Control":"no-cache, no-transform", Connection:"keep-alive", "X-Accel-Buffering":"no" } });
}
