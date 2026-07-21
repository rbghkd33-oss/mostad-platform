import type { SupabaseClient } from "@supabase/supabase-js";

export type PointTransaction = {
  id: number;
  transaction_type: "charge" | "use" | "refund" | "admin_adjustment";
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
};

export async function getPointBalance(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("point_balance")
    .eq("id", userId)
    .single();

  if (error) throw error;
  return Number(data?.point_balance ?? 0);
}

export async function getPointTransactions(supabase: SupabaseClient, userId: string, limit = 10) {
  const { data, error } = await supabase
    .from("point_transactions")
    .select("id, transaction_type, amount, balance_after, description, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as PointTransaction[];
}
