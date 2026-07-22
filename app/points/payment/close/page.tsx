"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CircleSlash2 } from "lucide-react";
export default function PaymentClosePage() {
  const router = useRouter();
  const [orderNo, setOrderNo] = useState("");
  useEffect(() => { setOrderNo(new URLSearchParams(window.location.search).get("orderNo") || ""); }, []);
  return <main className="payment-result-page"><section className="payment-result-card"><span className="result-icon waiting"><CircleSlash2 size={34}/></span><p>MOSTAD POINT PAYMENT</p><h1>결제가 취소되었습니다</h1><div className="payment-result-message">결제창을 닫아 충전이 진행되지 않았습니다.</div><small>주문번호 {orderNo || "-"}</small><div className="payment-result-actions"><button onClick={() => router.replace("/points")}>포인트 충전으로 돌아가기</button><button className="secondary" onClick={() => router.replace("/dashboard")}>대시보드로 이동</button></div></section></main>;
}
