const DEFAULT_TIMEOUT_MS = 10_000;

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} 환경변수가 없습니다.`);
  return value;
}

export function normalizeInstagramUsername(value: string): string {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

export type AutomationProgressItem = { done: number; limit: number };
export type AutomationSchedule = {
  insta_id: string;
  is_active: boolean;
  status_code:
    | "WAITING"
    | "RUNNING"
    | "PAUSED"
    | "LOGIN_REQUIRED"
    | "TWO_FACTOR_REQUIRED"
    | "ERROR"
    | "COMPLETED";
  status_msg: string;
  updated_at: string;
  progress: {
    likes: AutomationProgressItem;
    follows: AutomationProgressItem;
    comments: AutomationProgressItem;
    stories: AutomationProgressItem;
  };
};

export type AutomationLog = {
  id: number;
  task_type: string;
  message: string;
  success: boolean;
  created_at: string;
  time?: string;
};

export class AutomationApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload?: unknown,
  ) {
    super(message);
  }
}

export async function callAutomationApi<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<T> {
  const baseUrl = requireEnv("INSTAGRAM_AUTOMATION_API_BASE_URL").replace(/\/+$/, "");
  const apiKey = requireEnv("INSTAGRAM_AUTOMATION_API_KEY");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      cache: "no-store",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
        ...(init.headers ?? {}),
      },
    });

    const contentType = response.headers.get("content-type") ?? "";
    const payload = contentType.includes("application/json")
      ? await response.json().catch(() => null)
      : await response.text().catch(() => "");

    if (!response.ok) {
      const detail =
        payload && typeof payload === "object" && "detail" in payload
          ? String((payload as { detail?: unknown }).detail ?? "")
          : "";
      throw new AutomationApiError(
        detail || `자동화 서버 요청에 실패했습니다. (${response.status})`,
        response.status,
        payload,
      );
    }

    return payload as T;
  } catch (error) {
    if (error instanceof AutomationApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new AutomationApiError("자동화 서버 응답 시간이 초과되었습니다.", 504);
    }
    throw new AutomationApiError(
      error instanceof Error ? error.message : "자동화 서버에 연결하지 못했습니다.",
      502,
    );
  } finally {
    clearTimeout(timeout);
  }
}
