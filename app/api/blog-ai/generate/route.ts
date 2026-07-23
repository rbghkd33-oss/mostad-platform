import { NextRequest } from "next/server";

export const runtime = "edge";
export const maxDuration = 300;

const BLOG_API_BASE = "https://place.bidamgil.com";
const BLOG_START_URL = `${BLOG_API_BASE}/api/generate-body-async`;
const COST = 1000;

type GenerateRequest = {
  requestId?: unknown;
  mainKeyword?: unknown;
  subKeyword?: unknown;
  mainRepeat?: unknown;
  targetChars?: unknown;
  paragraphCount?: unknown;
  tone?: unknown;
  style?: unknown;
  guide?: unknown;
};

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function numberValue(value: unknown, fallback: number, min: number, max: number) {
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
        if (!closed) {
          closed = true;
          controller.close();
        }
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
            headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
            cache: "no-store",
          });
          if (!userResponse.ok) throw new Error("로그인 정보가 만료되었습니다. 다시 로그인해 주세요.");
          const user = (await userResponse.json()) as { id?: string };
          if (!user.id) throw new Error("회원 정보를 확인하지 못했습니다.");

          const body = (await request.json().catch(() => null)) as GenerateRequest | null;
          const requestId = text(body?.requestId, 80);
          const mainKeyword = text(body?.mainKeyword, 100);
          const subKeyword = text(body?.subKeyword, 500);
          const mainRepeat = numberValue(body?.mainRepeat, 6, 1, 30);
          const targetChars = numberValue(body?.targetChars, 1500, 500, 10000);
          const paragraphCount = numberValue(body?.paragraphCount, 5, 2, 20);
          const tone = ["haeyo", "hapnida", "hada", "mix"].includes(text(body?.tone, 20)) ? text(body?.tone, 20) : "haeyo";
          const style = ["narrative", "quote"].includes(text(body?.style, 20)) ? text(body?.style, 20) : "narrative";
          const guide = text(body?.guide, 5000);
          if (!requestId) throw new Error("요청번호를 생성하지 못했습니다. 새로고침 후 다시 시도해 주세요.");
          if (!mainKeyword) throw new Error("메인 키워드를 입력해 주세요.");

          const profileResponse = await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=point_balance,account_status`, {
            headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
            cache: "no-store",
          });
          if (!profileResponse.ok) throw new Error("포인트 정보를 불러오지 못했습니다.");
          const profiles = (await profileResponse.json()) as Array<{ point_balance?: number; account_status?: string }>;
          const profile = profiles[0];
          if (!profile || profile.account_status !== "active") throw new Error("현재 이용할 수 없는 계정입니다.");
          if (Number(profile.point_balance ?? 0) < COST) {
            send("insufficient", { message: "보유 포인트가 부족합니다.", required: COST, balance: Number(profile.point_balance ?? 0) });
            finish();
            return;
          }

          send("status", { step: "generate", message: "AI가 원고를 작성하고 있습니다. 보통 30초~3분 정도 걸립니다.", elapsed: 0 });
          heartbeat = setInterval(() => {
            send("status", {
              step: "generate",
              message: "AI가 원고 분량과 키워드 반복 횟수를 맞추고 있습니다.",
              elapsed: Math.floor((Date.now() - startedAt) / 1000),
            });
          }, 10_000);

          const startResponse = await fetch(BLOG_START_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
            body: JSON.stringify({
              main_keyword: mainKeyword,
              sub_keyword: subKeyword,
              main_repeat: mainRepeat,
              target_chars: targetChars,
              paragraph_count: paragraphCount,
              tone,
              style,
              guide,
            }),
            cache: "no-store",
          });
          const startRaw = await startResponse.text();
          let startJob: Record<string, unknown> = {};
          try { startJob = JSON.parse(startRaw) as Record<string, unknown>; } catch {}
          if (!startResponse.ok || typeof startJob.job_id !== "string") {
            const detail = typeof startJob.detail === "string" ? startJob.detail : `원고 생성 작업 시작 실패 (${startResponse.status})`;
            throw new Error(detail);
          }

          const jobId = startJob.job_id;
          const deadline = Date.now() + 290_000;
          let result: Record<string, unknown> | null = null;
          while (Date.now() < deadline) {
            await new Promise(resolve => setTimeout(resolve, 4_000));
            const jobResponse = await fetch(`${BLOG_API_BASE}/api/job/${encodeURIComponent(jobId)}`, {
              headers: { "X-API-Key": apiKey },
              cache: "no-store",
            });
            const jobRaw = await jobResponse.text();
            let job: Record<string, unknown> = {};
            try { job = JSON.parse(jobRaw) as Record<string, unknown>; } catch {}
            if (!jobResponse.ok) {
              const detail = typeof job.detail === "string" ? job.detail : `원고 생성 상태 조회 실패 (${jobResponse.status})`;
              throw new Error(detail);
            }
            const jobStatus = typeof job.status === "string" ? job.status : "";
            send("status", {
              step: "generate",
              message: typeof job.progress === "string" ? job.progress : "AI가 원고를 작성하고 있습니다.",
              elapsed: Number(job.elapsed_seconds ?? Math.floor((Date.now() - startedAt) / 1000)),
            });
            if (jobStatus === "done") {
              result = job.result && typeof job.result === "object" ? job.result as Record<string, unknown> : null;
              break;
            }
            if (jobStatus === "failed") {
              throw new Error(typeof job.error === "string" ? job.error : "원고 생성에 실패했습니다.");
            }
          }
          if (heartbeat) clearInterval(heartbeat);
          if (!result || typeof result.body !== "string") {
            throw new Error("원고 생성 시간이 초과되었습니다. 포인트는 차감되지 않았습니다.");
          }

          send("status", { step: "charge", message: "원고 생성이 완료되어 1,000P를 차감하고 결과를 저장하고 있습니다." });
          const rpcResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/complete_blog_ai_generation`, {
            method: "POST",
            headers: {
              apikey: serviceKey,
              Authorization: `Bearer ${serviceKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              p_user_id: user.id,
              p_request_id: requestId,
              p_main_keyword: mainKeyword,
              p_sub_keyword: subKeyword,
              p_main_repeat: mainRepeat,
              p_target_chars: targetChars,
              p_paragraph_count: paragraphCount,
              p_tone: tone,
              p_style: style,
              p_guide: guide,
              p_body: result.body,
              p_char_count: Number(result.char_count ?? 0),
              p_retry_count: Number(result.retry_count ?? 0),
              p_reached_target: Boolean(result.reached_target),
            }),
          });
          const rpcText = await rpcResponse.text();
          let rpcResult: Record<string, unknown> = {};
          try { rpcResult = JSON.parse(rpcText) as Record<string, unknown>; } catch {}
          if (!rpcResponse.ok) {
            const message = typeof rpcResult.message === "string" ? rpcResult.message : typeof rpcResult.details === "string" ? rpcResult.details : "포인트 차감 중 오류가 발생했습니다.";
            throw new Error(message);
          }

          send("complete", {
            body: result.body,
            char_count: Number(result.char_count ?? 0),
            retry_count: Number(result.retry_count ?? 0),
            reached_target: Boolean(result.reached_target),
            balance: Number(rpcResult.balance ?? 0),
            cost: COST,
            elapsed_ms: Date.now() - startedAt,
          });
          finish();
        } catch (error) {
          if (heartbeat) clearInterval(heartbeat);
          const message = error instanceof Error && error.name === "AbortError"
            ? "원고 생성 시간이 너무 길어 요청이 종료되었습니다. 포인트는 차감되지 않았습니다."
            : error instanceof Error ? error.message : "원고 생성 중 오류가 발생했습니다.";
          send("error", { message });
          finish();
        }
      })();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
