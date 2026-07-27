import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceClient } from "@/lib/supabase-server";
import { requireAuthenticatedUser, errorStatus } from "@/lib/server-auth";
import {
  AutomationApiError,
  type AutomationSchedule,
  callAutomationApi,
  normalizeInstagramUsername,
} from "@/lib/instagram-automation-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ orderId: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const { userId } = await requireAuthenticatedUser(request);
    const { orderId } = await context.params;
    const id = Number(orderId);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ error: "올바른 신청 번호가 아닙니다." }, { status: 400 });
    }

    const service = getSupabaseServiceClient();
    const { data: order, error } = await service
      .from("instagram_optimization_orders")
      .select("id,user_id,instagram_username,status")
      .eq("id", id)
      .single();

    if (error || !order || order.user_id !== userId) {
      return NextResponse.json({ error: "신청 계정을 찾을 수 없습니다." }, { status: 404 });
    }
    if (order.status !== "active") {
      return NextResponse.json({ error: "가동 중인 계정만 현황을 조회할 수 있습니다." }, { status: 409 });
    }

    const username = normalizeInstagramUsername(order.instagram_username);
    const schedule = await callAutomationApi<AutomationSchedule>(
      `/api/external/accounts/${encodeURIComponent(username)}/schedule`,
    );
    return NextResponse.json(schedule);
  } catch (error) {
    const status = error instanceof AutomationApiError ? error.status : errorStatus(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "현황을 불러오지 못했습니다." },
      { status },
    );
  }
}
