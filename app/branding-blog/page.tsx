"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Check, ChevronRight, Coins, Loader2, NotebookTabs,
  ShieldCheck, Sparkles, WalletCards,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { getPointBalance } from "@/lib/points";

const packages = [
  { count: 10, price: 220000, label: "10회", description: "브랜드 블로그 운영을 가볍게 시작하는 기본 구성" },
  { count: 20, price: 440000, label: "20회", description: "검색 콘텐츠를 꾸준히 축적하는 집중 운영 구성", recommended: true },
  { count: 30, price: 660000, label: "30회", description: "장기적인 브랜드 자산을 만드는 프리미엄 구성" },
];

export default function BrandingBlogPage() {
  const router = useRouter();
  const [selectedCount, setSelectedCount] = useState(20);
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [blogUrl, setBlogUrl] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [requestNote, setRequestNote] = useState("");
  const [agreed, setAgreed] = useState(false);

  const selected = useMemo(() => packages.find((item) => item.count === selectedCount) ?? packages[1], [selectedCount]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/");
        return;
      }
      try {
        setBalance(await getPointBalance(supabase, data.user.id));
      } catch {
        setMessage("포인트 정보를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  async function submitOrder() {
    setMessage("");
    if (!blogUrl.trim()) {
      setMessage("운영할 블로그 주소를 입력해 주세요.");
      return;
    }
    if (!companyName.trim()) {
      setMessage("업체명을 입력해 주세요.");
      return;
    }
    if (!agreed) {
      setMessage("상품 진행 및 포인트 차감 안내에 동의해 주세요.");
      return;
    }
    if (balance < selected.price) {
      setMessage("보유 포인트가 부족합니다. 포인트를 충전한 뒤 다시 신청해 주세요.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setSubmitting(true);
    const { data, error } = await supabase.rpc("customer_purchase_branding_blog_v2", {
      p_package_count: selected.count,
      p_blog_url: blogUrl.trim(),
      p_company_name: companyName.trim(),
      p_request_note: requestNote.trim(),
    });
    setSubmitting(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setBalance((value) => value - selected.price);
    setMessage(`접수가 완료되었습니다. 접수번호 #${data} · 관리자가 담당 직원을 배정하면 진행이 시작됩니다.`);
    setTimeout(() => router.push("/my-marketing"), 1200);
  }

  if (loading) {
    return <main className="loading-screen"><Loader2 className="spin" size={32}/><span>상품 정보를 불러오고 있습니다.</span></main>;
  }

  return (
    <main className="branding-order-page">
      <header className="branding-order-topbar">
        <button onClick={() => router.push("/dashboard")}><ArrowLeft size={18}/> 대시보드</button>
        <div><span><Sparkles size={18}/></span><strong>모스트애드</strong></div>
      </header>

      <section className="branding-order-container">
        <div className="branding-order-hero">
          <div>
            <span>MOSTAD BRANDING BLOG</span>
            <h1>브랜딩 블로그<br/>최적화 관리</h1>
            <p>브랜드에 맞는 콘텐츠를 꾸준히 발행하고, 등록된 포스팅 링크와 진행 횟수를 고객 대시보드에서 확인하세요.</p>
          </div>
          <div className="branding-balance-card">
            <WalletCards size={24}/>
            <span>현재 보유 포인트</span>
            <strong>{balance.toLocaleString()}P</strong>
            <button onClick={() => router.push("/points")}>포인트 충전 <ChevronRight size={15}/></button>
          </div>
        </div>

        <section className="branding-order-section">
          <div className="branding-section-heading"><span>01</span><div><h2>운영 횟수를 선택하세요</h2><p>모든 상품은 1회당 22,000P이며, 신청 즉시 포인트가 차감됩니다.</p></div></div>
          <div className="branding-package-grid">
            {packages.map((item) => (
              <button key={item.count} className={`branding-package-card ${selectedCount === item.count ? "active" : ""}`} onClick={() => setSelectedCount(item.count)}>
                {item.recommended && <em>추천</em>}
                <span>{item.label}</span>
                <strong>{item.price.toLocaleString()}<small>P</small></strong>
                <p>{item.description}</p>
                <i>{selectedCount === item.count ? <Check size={17}/> : null}</i>
              </button>
            ))}
          </div>
        </section>

        <section className="branding-order-section">
          <div className="branding-section-heading"><span>02</span><div><h2>운영 정보를 입력하세요</h2><p>블로그 운영에 필요한 기본 정보만 간단히 입력해 주세요.</p></div></div>
          <div className="branding-form-grid">
            <label><span>블로그 주소 <b>필수</b></span><input value={blogUrl} onChange={(e) => setBlogUrl(e.target.value)} placeholder="https://blog.naver.com/..."/></label>
            <label><span>업체명 <b>필수</b></span><input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="운영할 업체명을 입력해 주세요."/></label>
            <label className="wide"><span>요청사항</span><textarea value={requestNote} onChange={(e) => setRequestNote(e.target.value)} placeholder="원하는 글 방향, 포함할 내용, 피해야 할 표현, 참고 링크 등을 입력해 주세요."/></label>
          </div>
        </section>

        <section className="branding-order-summary">
          <div className="branding-summary-icon"><NotebookTabs size={25}/></div>
          <div className="branding-summary-copy">
            <span>신청 상품</span>
            <strong>브랜딩 블로그 최적화 관리 · {selected.label}</strong>
            <p>접수 후 관리자가 담당 직원을 배정합니다. 직원이 포스팅을 등록할 때마다 고객 화면에 진행률과 링크가 표시됩니다.</p>
          </div>
          <div className="branding-summary-price"><span>차감 포인트</span><strong>{selected.price.toLocaleString()}P</strong></div>
        </section>

        <label className="branding-order-agree"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)}/><span><ShieldCheck size={17}/> 포인트 차감 및 서비스 진행 안내를 확인했습니다.</span></label>
        {message && <div className={`branding-order-message ${message.includes("완료") ? "success" : ""}`}>{message}</div>}
        <button className="branding-order-submit" disabled={submitting} onClick={submitOrder}>
          {submitting ? <><Loader2 className="spin" size={19}/> 접수 중...</> : <><Coins size={19}/> {selected.price.toLocaleString()}P로 접수하기</>}
        </button>
      </section>
    </main>
  );
}
