"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  Coins,
  CreditCard,
  Loader2,
  LockKeyhole,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  WalletCards,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { getPointBalance, getPointTransactions, type PointTransaction } from "@/lib/points";

const amounts = [50000, 100000, 300000, 500000, 1000000];

const transactionLabels = {
  charge: "포인트 충전",
  use: "포인트 사용",
  refund: "포인트 환불",
  admin_adjustment: "관리자 조정",
};

export default function PointsPage() {
  const router = useRouter();
  const [selectedAmount, setSelectedAmount] = useState(100000);
  const [customAmount, setCustomAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("card");
  const [agreed, setAgreed] = useState(false);
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<PointTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState("");
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const paymentPopupRef = useRef<Window | null>(null);

  const loadPoints = useCallback(async () => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      router.replace("/");
      return;
    }

    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      router.replace("/");
      return;
    }

    try {
      const [currentBalance, history] = await Promise.all([
        getPointBalance(supabase, data.user.id),
        getPointTransactions(supabase, data.user.id, 10),
      ]);
      setBalance(currentBalance);
      setTransactions(history);
      setDbError("");
    } catch {
      setDbError("Supabase SQL Editor에서 포인트 시스템 SQL을 먼저 실행해 주세요.");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    loadPoints();
  }, [loadPoints]);

  useEffect(() => {
    function handlePaymentMessage(event: MessageEvent) {
      const allowedOrigins = new Set([
        window.location.origin,
        "https://mplatform.kr",
        "https://www.mplatform.kr",
      ]);
      if (!allowedOrigins.has(event.origin)) return;
      if (!event.data || typeof event.data !== "object") return;
      if (event.data.type !== "MOSTAD_LUCY_PAYMENT_RESULT") return;

      setPaymentLoading(false);
      loadPoints();
      if (event.data.status === "point_granted") {
        setPaymentError("");
      } else if (["failed", "canceled", "refunded"].includes(event.data.status)) {
        setPaymentError("결제가 완료되지 않았습니다. 결제 내역을 확인해 주세요.");
      }
    }

    function handleWindowFocus() {
      if (paymentPopupRef.current?.closed) {
        paymentPopupRef.current = null;
        setPaymentLoading(false);
        loadPoints();
      }
    }

    window.addEventListener("message", handlePaymentMessage);
    window.addEventListener("focus", handleWindowFocus);
    return () => {
      window.removeEventListener("message", handlePaymentMessage);
      window.removeEventListener("focus", handleWindowFocus);
    };
  }, [loadPoints]);

  const amount = useMemo(() => {
    const custom = Number(customAmount.replace(/,/g, ""));
    return custom > 0 ? custom : selectedAmount;
  }, [customAmount, selectedAmount]);

  const vat = Math.floor(amount * 0.1);
  const total = amount + vat;

  function selectAmount(value: number) {
    setSelectedAmount(value);
    setCustomAmount("");
  }

  async function requestPayment() {
    setPaymentError("");
    if (amount < 10000) {
      setPaymentError("최소 충전 금액은 10,000원입니다.");
      return;
    }
    if (!agreed) {
      setPaymentError("결제 및 환불 정책에 동의해 주세요.");
      return;
    }
    if (paymentMethod !== "card") {
      setPaymentError("현재는 신용·체크카드 결제만 지원합니다.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setPaymentError("로그인 정보를 확인할 수 없습니다.");
      return;
    }

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const popupName = `mostadLucyPayment_${Date.now()}`;
    let popup: Window | null = null;

    // 팝업 차단을 피하려면 사용자 클릭 이벤트 안에서 먼저 빈 창을 열어야 합니다.
    if (!isMobile) {
      const width = 560;
      const height = 780;
      const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
      const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
      popup = window.open(
        "about:blank",
        popupName,
        `popup=yes,width=${width},height=${height},left=${Math.round(left)},top=${Math.round(top)},resizable=yes,scrollbars=yes`,
      );
      paymentPopupRef.current = popup;
      if (popup) {
        popup.document.write("<title>모스트애드 결제 준비 중</title><p style='font-family:sans-serif;padding:32px'>결제창을 준비하고 있습니다...</p>");
      }
    }

    setPaymentLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        if (popup && !popup.closed) popup.close();
        paymentPopupRef.current = null;
        setPaymentLoading(false);
        router.replace("/");
        return;
      }

      const response = await fetch("/api/payments/lucy/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          pointAmount: amount,
          paymentAmount: total,
          deviceType: /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ? "M" : "P",
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "결제를 준비하지 못했습니다.");

      const form = document.createElement("form");
      form.method = "POST";
      form.action = result.authUrl;
      form.acceptCharset = "UTF-8";
      form.target = popup ? popupName : "_self";
      Object.entries(result.fields as Record<string, string>).forEach(([key, value]) => {
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = key;
        input.value = value;
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
      form.remove();

      if (popup) {
        popup.focus();
        setPaymentLoading(false);
      }
    } catch (error) {
      if (popup && !popup.closed) popup.close();
      paymentPopupRef.current = null;
      setPaymentError(error instanceof Error ? error.message : "결제 준비 중 오류가 발생했습니다.");
      setPaymentLoading(false);
    }
  }

  return (
    <main className="points-page">
      <header className="points-topbar">
        <button onClick={() => router.push("/dashboard")}><ArrowLeft size={18} /> 대시보드</button>
        <div className="points-brand"><span><Sparkles size={18} /></span><strong>모스트애드</strong></div>
      </header>

      <section className="points-container">
        <div className="points-heading">
          <span>POINT CHARGE</span>
          <h1>포인트 충전</h1>
          <p>모스트애드 서비스 이용에 필요한 포인트를 안전하게 충전하세요.</p>
        </div>

        {dbError && <div className="points-db-alert">{dbError}</div>}

        <div className="points-balance-card">
          <div className="balance-icon"><Coins size={26} /></div>
          <div>
            <span>현재 보유 포인트</span>
            <strong>{loading ? <Loader2 className="spin" size={22} /> : balance.toLocaleString()}<em>P</em></strong>
          </div>
          <button onClick={() => document.getElementById("point-history")?.scrollIntoView({ behavior: "smooth" })}>이용 내역 <ChevronRight size={16} /></button>
        </div>

        <div className="points-layout">
          <section className="points-panel">
            <div className="panel-title"><span><WalletCards size={20} /></span><div><strong>충전 금액 선택</strong><small>충전할 포인트 금액을 선택해 주세요.</small></div></div>

            <div className="amount-grid">
              {amounts.map((value) => (
                <button key={value} className={!customAmount && selectedAmount === value ? "active" : ""} onClick={() => selectAmount(value)}>
                  {value.toLocaleString()}원
                  {selectedAmount === value && !customAmount && <Check size={15} />}
                </button>
              ))}
            </div>

            <label className="custom-amount">
              <span>직접 입력</span>
              <div><input value={customAmount} onChange={(e) => setCustomAmount(e.target.value.replace(/[^0-9]/g, ""))} placeholder="충전 금액을 입력해 주세요" /><em>원</em></div>
              <small>최소 충전 금액은 10,000원입니다.</small>
            </label>

            <div className="payment-methods">
              <strong>결제 수단</strong>
              <div>
                <button className={paymentMethod === "card" ? "active" : ""} onClick={() => setPaymentMethod("card")}><CreditCard size={19} /> 신용·체크카드</button>
                <button className={paymentMethod === "transfer" ? "active" : ""} onClick={() => setPaymentMethod("transfer")} disabled title="추후 지원 예정"><ReceiptText size={19} /> 계좌이체 <small>준비 중</small></button>
              </div>
            </div>

            <label className="payment-agree"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} /><span><i><Check size={12} /></i>결제 및 포인트 환불 정책에 동의합니다.</span><button type="button">내용 보기</button></label>
          </section>

          <aside className="payment-summary">
            <div className="summary-title"><ShieldCheck size={21} /><strong>결제 금액</strong></div>
            <div className="summary-list">
              <p><span>충전 포인트</span><strong>{amount.toLocaleString()}P</strong></p>
              <p><span>공급가액</span><strong>{amount.toLocaleString()}원</strong></p>
              <p><span>부가세</span><strong>{vat.toLocaleString()}원</strong></p>
            </div>
            <div className="summary-total"><span>최종 결제 금액</span><strong>{total.toLocaleString()}<em>원</em></strong></div>
            {paymentError && <div className="payment-inline-error">{paymentError}</div>}
            <button className="payment-button" onClick={requestPayment} disabled={paymentLoading}>{paymentLoading ? <><Loader2 className="spin" size={17} /> 결제창 준비 중</> : <>{total.toLocaleString()}원 결제하기 <ChevronRight size={17} /></>}</button>
            <div className="secure-note"><LockKeyhole size={15} /><span>결제 정보는 PG사를 통해 안전하게 처리됩니다.</span></div>
          </aside>
        </div>

        <section className="point-history-panel" id="point-history">
          <div className="point-history-heading">
            <div><span>POINT HISTORY</span><h2>포인트 이용 내역</h2></div>
            <strong>현재 {balance.toLocaleString()}P</strong>
          </div>

          {loading ? (
            <div className="point-history-empty"><Loader2 className="spin" size={24} /> 이용 내역을 불러오고 있습니다.</div>
          ) : transactions.length === 0 ? (
            <div className="point-history-empty"><ReceiptText size={25} /><strong>아직 포인트 이용 내역이 없습니다.</strong><span>충전이나 서비스 이용 후 내역이 표시됩니다.</span></div>
          ) : (
            <div className="point-history-list">
              {transactions.map((item) => {
                const isMinus = item.transaction_type === "use";
                const Icon = item.transaction_type === "refund" ? RotateCcw : isMinus ? ArrowUpRight : ArrowDownLeft;
                return (
                  <article key={item.id}>
                    <span className={isMinus ? "minus" : "plus"}><Icon size={18} /></span>
                    <div><strong>{transactionLabels[item.transaction_type]}</strong><small>{item.description} · {new Date(item.created_at).toLocaleString("ko-KR")}</small></div>
                    <div className="point-history-amount"><strong className={isMinus ? "minus" : "plus"}>{isMinus ? "-" : "+"}{item.amount.toLocaleString()}P</strong><small>잔액 {item.balance_after.toLocaleString()}P</small></div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </section>
    </main>
  );
}
