import { getSupabaseServiceClient, getSupabaseTokenClient } from "@/lib/supabase-server";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} 환경변수가 없습니다.`);
  return value;
}

export function getBearerToken(request: Request): string {
  const auth = request.headers.get("authorization") ?? "";
  return auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
}

export async function requireAuthenticatedUser(request: Request) {
  const token = getBearerToken(request);
  if (!token) throw Object.assign(new Error("로그인이 필요합니다."), { status: 401 });

  const response = await fetch(`${requireEnv("NEXT_PUBLIC_SUPABASE_URL")}/auth/v1/user`, {
    headers: {
      apikey: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw Object.assign(new Error("로그인 정보가 만료되었습니다."), { status: 401 });
  }

  const user = (await response.json()) as { id?: string; email?: string };
  if (!user.id) throw Object.assign(new Error("회원 정보를 확인하지 못했습니다."), { status: 401 });

  return { userId: user.id, token, tokenClient: getSupabaseTokenClient(token) };
}

export async function requireAdmin(request: Request) {
  const auth = await requireAuthenticatedUser(request);
  const service = getSupabaseServiceClient();
  const { data: profile, error } = await service
    .from("profiles")
    .select("role,account_status")
    .eq("id", auth.userId)
    .single();

  if (error || !profile || !["admin", "super_admin"].includes(profile.role) || profile.account_status !== "active") {
    throw Object.assign(new Error("관리자 권한이 필요합니다."), { status: 403 });
  }

  return { ...auth, service, role: profile.role as "admin" | "super_admin" };
}

export function errorStatus(error: unknown, fallback = 500): number {
  return typeof error === "object" && error !== null && "status" in error
    ? Number((error as { status?: unknown }).status) || fallback
    : fallback;
}
