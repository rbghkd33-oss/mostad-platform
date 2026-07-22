"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { XCircle } from "lucide-react";
export default function PaymentFailPage() {
  const router = useRouter();
  const [orderNo, setOrderNo] = useState("");
  useEffect(() => { setOrderNo(new URLSearchParams(window.location.search).get("orderNo") || ""); }, []);
  return <main className="payment-result-page"><section className="payment-result-card"><span className="result-icon fail"><XCircle size={34}/></span><p>MOSTAD POINT PAYMENT</p><h1>결제가 완료되지 않았습니다</h1><div className="payment-result-message">카드 정보나 결제 한도를 확인한 뒤 다시 시도해 주세요.</div><small>주문번호 {orderNo || "-"}</small><div className="payment-result-actions"><button onClick={() => router.replace("/points")}>다시 결제하기</button><button className="secondary" onClick={() => router.replace("/dashboard")}>대시보드로 이동</button></div></section></main>;
}
