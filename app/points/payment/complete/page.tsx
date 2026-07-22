"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Clock3, Loader2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export default function PaymentCompletePage() {
  const router = useRouter();
  const [orderNo, setOrderNo] = useState("");
  const [status, setStatus] = useState("pending");
  const [message, setMessage] = useState("결제 승인 결과를 확인하고 있습니다.");

  useEffect(() => {
    setOrderNo(new URLSearchParams(window.location.search).get("orderNo") || "");
  }, []);

  useEffect(() => {
    if (!orderNo) return;
    let stopped = false;
    let attempts = 0;

    async function check() {
      const supabase = getSupabaseBrowserClient();
      if (!supabase || !orderNo) return;
      const { data } = await supabase.from("payment_orders").select("status,point_amount").eq("order_no", orderNo).maybeSingle();
      if (stopped || !data) return;
      setStatus(data.status);
      if (data.status === "point_granted") {
        setMessage(`${Number(data.point_amount).toLocaleString()}P 충전이 완료되었습니다.`);
        return;
      }
      if (["failed", "canceled", "refunded"].includes(data.status)) {
        setMessage("결제가 승인되지 않았거나 취소되었습니다.");
        return;
      }
      attempts += 1;
      if (attempts < 20) window.setTimeout(check, 1500);
      else setMessage("결제는 완료되었지만 승인 노티를 기다리고 있습니다. 잠시 후 포인트 내역을 확인해 주세요.");
    }

    check();
    return () => { stopped = true; };
  }, [orderNo]);

  const done = status === "point_granted";
  return (
    <main className="payment-result-page">
      <section className="payment-result-card">
        <span className={done ? "result-icon success" : "result-icon waiting"}>{done ? <CheckCircle2 size={34} /> : <Clock3 size={34} />}</span>
        <p>MOSTAD POINT PAYMENT</p>
        <h1>{done ? "포인트 충전 완료" : "결제 결과 확인 중"}</h1>
        <div className="payment-result-message">{!done && status === "pending" && <Loader2 className="spin" size={18} />}{message}</div>
        <small>주문번호 {orderNo || "-"}</small>
        <div className="payment-result-actions">
          <button onClick={() => router.replace("/points")}>포인트 내역 확인</button>
          <button className="secondary" onClick={() => router.replace("/dashboard")}>대시보드로 이동</button>
        </div>
      </section>
    </main>
  );
}
