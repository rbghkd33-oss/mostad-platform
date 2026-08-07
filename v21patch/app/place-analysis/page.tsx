"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";

const interests = ["네이버 플레이스","네이버 블로그","인스타그램","유튜브","구글 광고","브랜딩","온라인 창업","기타"];

export default function FreeMarketingClassPage() {
  const [form, setForm] = useState({ name:"", company:"", phone:"", interest:"", privacyAgreed:false });
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setNotice(""); setSuccess(false);
    if (!form.name.trim()) return setNotice("이름을 입력해 주세요.");
    if (!/^01[016789]-?\d{3,4}-?\d{4}$/.test(form.phone.trim())) return setNotice("휴대전화 번호를 정확히 입력해 주세요.");
    if (!form.interest) return setNotice("관심 마케팅 분야를 선택해 주세요.");
    if (!form.privacyAgreed) return setNotice("개인정보 수집 및 이용에 동의해 주세요.");
    setSubmitting(true);
    try {
      const response = await fetch("/api/free-marketing-class/apply", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(form) });
      const data = (await response.json().catch(()=>({}))) as { message?: string };
      if (!response.ok) throw new Error(data.message || "신청 접수 중 오류가 발생했습니다.");
      setSuccess(true); setNotice("무료 강의 신청이 접수되었습니다. 담당자가 확인 후 연락드리겠습니다.");
      setForm({ name:"", company:"", phone:"", interest:"", privacyAgreed:false });
    } catch (error) { setNotice(error instanceof Error ? error.message : "신청 접수 중 오류가 발생했습니다."); }
    finally { setSubmitting(false); }
  }

  const goForm = () => document.getElementById("apply-form")?.scrollIntoView({behavior:"smooth",block:"start"});

  return <>
    <main className="fc-page">
      <header className="fc-top"><div className="fc-shell fc-topin">
        <Image src="/mostad-logo.png" alt="모스트애드" width={130} height={40} className="fc-logo" priority />
        <button onClick={goForm}>무료 신청하기</button>
      </div></header>

      <section className="fc-hero"><div className="fc-shell fc-hero-grid">
        <div>
          <div className="fc-tags"><span>MOSTAD FREE MARKETING CLASS</span><b>선착순 무료</b></div>
          <p className="fc-kicker">2026 OFFLINE SPECIAL CLASS</p>
          <h1>광고비를 쓰기 전에<br/>꼭 알아야 할<br/><em>실전 마케팅</em></h1>
          <p className="fc-desc">네이버 플레이스, 블로그, 인스타그램 등 온라인 채널을 활용해 실제 고객 유입과 문의 전환을 만드는 방법을 사례 중심으로 알려드립니다.</p>
          <div className="fc-info">
            <article><small>강의 일시</small><strong>9월 3일 · 14:00~17:00</strong></article>
            <article><small>진행 장소</small><strong>마곡나루역 인근</strong></article>
            <article className="gold"><small>참가 비용</small><strong>0원 · 무료</strong></article>
          </div>
          <button className="fc-mainbtn" onClick={goForm}>지금 무료로 신청하기 →</button>
        </div>
        <div>
          <div className="fc-imagebox"><Image src="/free-marketing-class-hero.png" alt="마케팅 실전 오프라인 무료 특강" width={2048} height={1152} priority /></div>
          <div className="fc-smallcards"><article><small>CLASS POINT</small><strong>실무 중심</strong><p>바로 적용 가능한 내용</p></article><article className="gold"><small>LIMITED SEATS</small><strong>선착순 접수</strong><p>좌석 마감 시 종료</p></article></div>
        </div>
      </div></section>

      <section className="fc-section alt"><div className="fc-shell">
        <p className="fc-eyebrow">WHO IS THIS FOR?</p><h2>이런 분께 추천합니다</h2><p className="fc-sub">마케팅을 하고 있지만 방향이 막막했다면, 이번 강의에서 기준부터 잡아보세요.</p>
        <div className="fc-four">{[
          "광고를 하고 있지만 효과를 체감하지 못하는 분","네이버 플레이스 노출과 방문 전환을 높이고 싶은 분","블로그·인스타그램 운영 방향이 막막한 분","우리 업체에 맞는 마케팅 전략을 찾고 싶은 분"
        ].map((x,i)=><article key={x}><b>0{i+1}</b><p>{x}</p></article>)}</div>
      </div></section>

      <section className="fc-section"><div className="fc-shell">
        <p className="fc-eyebrow">WHAT YOU WILL LEARN</p><h2>3시간 동안 이것만큼은 확실히</h2><p className="fc-sub">복잡한 이론보다 실제 사업자에게 필요한 핵심 내용을 중심으로 구성했습니다.</p>
        <div className="fc-two">{[
          ["01","NAVER PLACE","네이버 플레이스","검색 노출 구조부터 플레이스 관리와 고객 문의 전환까지 핵심만 알려드립니다."],
          ["02","BLOG CONTENT","블로그 마케팅","검색되는 콘텐츠와 단순히 글만 발행하는 콘텐츠의 차이를 실제 사례로 설명합니다."],
          ["03","SNS MARKETING","인스타그램 마케팅","팔로워보다 중요한 도달·콘텐츠·전환 구조를 이해하기 쉽게 알려드립니다."],
          ["04","MARKETING STRATEGY","실전 마케팅 전략","우리 업종에 어떤 마케팅부터 시작해야 하는지 광고비 우선순위를 잡아드립니다."]
        ].map(([n,k,t,d])=><article key={n}><div><small>{k}</small><h3>{t}</h3></div><b>{n}</b><p>{d}</p></article>)}</div>
      </div></section>

      <section className="fc-apply"><div className="fc-shell fc-apply-grid">
        <div className="fc-copy"><p className="fc-eyebrow">FREE APPLICATION</p><h2>마케팅,<br/>무작정 시작하지 마세요.</h2><p>우리 업체에 필요한 마케팅부터 알고 시작하면 같은 광고비로도 결과는 달라질 수 있습니다.</p>
          <div className="fc-checks">{["2026년 9월 3일 목요일","오후 2시 ~ 오후 5시","마곡나루역 인근","참가비 무료"].map(x=><div key={x}><i>✓</i>{x}</div>)}</div>
        </div>
        <form id="apply-form" onSubmit={submit} className="fc-form">
          <div className="fc-formhead"><div><p>0원 무료 신청</p><h2>무료 마케팅 강의 신청</h2></div><span>선착순 접수</span></div>
          <p className="fc-formdesc">아래 정보를 남겨주시면 신청 내용을 확인한 뒤 담당자가 입력하신 연락처로 안내드립니다.</p>
          <div className="fc-fields">
            <label><span>이름 <b>*</b></span><input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="이름을 입력해 주세요"/></label>
            <label><span>업체명</span><input value={form.company} onChange={e=>setForm({...form,company:e.target.value})} placeholder="업체명 또는 상호명"/></label>
            <label><span>전화번호 <b>*</b></span><input value={form.phone} onChange={e=>setForm({...form,phone:e.target.value.replace(/[^0-9-]/g,"")})} inputMode="tel" placeholder="010-0000-0000"/></label>
            <label><span>관심 마케팅 분야 <b>*</b></span><select value={form.interest} onChange={e=>setForm({...form,interest:e.target.value})}><option value="">관심 분야를 선택해 주세요</option>{interests.map(x=><option key={x}>{x}</option>)}</select></label>
          </div>
          <div className="fc-privacy"><label><input type="checkbox" checked={form.privacyAgreed} onChange={e=>setForm({...form,privacyAgreed:e.target.checked})}/><span><b>[필수]</b> 개인정보 수집 및 이용 동의</span></label><div>수집 항목: 이름, 업체명, 전화번호, 관심 마케팅 분야<br/>수집 목적: 무료 마케팅 강의 신청 접수 및 안내<br/>보유 기간: 강의 종료 후 3개월 또는 동의 철회 시까지</div></div>
          {notice && <div className={`fc-notice ${success?"ok":"bad"}`}>{notice}</div>}
          <button className="fc-submit" disabled={submitting}>{submitting?"신청 접수 중...":"무료 강의 신청하기 →"}</button>
        </form>
      </div></section>

      <section className="fc-bottom"><div className="fc-shell"><div><small>MOSTAD FREE CLASS</small><h2>지금 필요한 마케팅부터 제대로 시작하세요.</h2><p>9월 3일, 마곡나루에서 실제 고객을 만드는 마케팅의 기준을 알려드립니다.</p><button onClick={goForm}>무료로 자리 신청하기</button></div></div></section>
      <button className="fc-mobile" onClick={goForm}>무료 강의 신청하기</button>
    </main>

    <style jsx global>{`
      *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0}.fc-page{min-height:100vh;background:radial-gradient(circle at 10% 8%,rgba(79,70,229,.22),transparent 28%),radial-gradient(circle at 90% 35%,rgba(14,165,233,.14),transparent 25%),#07101f;color:#fff;font-family:Pretendard,"Noto Sans KR",Arial,sans-serif}.fc-shell{width:min(1240px,calc(100% - 40px));margin:auto}.fc-top{position:sticky;top:0;z-index:50;background:rgba(7,16,31,.86);backdrop-filter:blur(16px);border-bottom:1px solid rgba(255,255,255,.08)}.fc-topin{height:72px;display:flex;align-items:center;justify-content:space-between}.fc-logo{width:auto;height:34px}.fc-top button,.fc-mainbtn,.fc-bottom button{border:0;cursor:pointer;font-weight:900}.fc-top button{color:white;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);padding:11px 20px;border-radius:999px}.fc-hero{padding:62px 0 80px}.fc-hero-grid{display:grid;grid-template-columns:1.05fr .95fr;gap:50px;align-items:center}.fc-tags{display:flex;gap:8px;flex-wrap:wrap}.fc-tags span,.fc-tags b{font-size:11px;padding:9px 13px;border-radius:999px}.fc-tags span{color:#99f6e4;border:1px solid rgba(94,234,212,.25);background:rgba(94,234,212,.08)}.fc-tags b{color:#fde68a;border:1px solid rgba(251,191,36,.25);background:rgba(251,191,36,.08)}.fc-kicker{margin-top:20px;color:rgba(255,255,255,.38);font-size:12px;font-weight:800;letter-spacing:.18em}.fc-hero h1{font-size:clamp(44px,5vw,68px);line-height:1.13;letter-spacing:-.045em;margin:12px 0 0;font-weight:950}.fc-hero h1 em{font-style:normal;background:linear-gradient(90deg,#60a5fa,#818cf8,#c084fc);background-clip:text;-webkit-background-clip:text;color:transparent}.fc-desc{max-width:650px;color:rgba(255,255,255,.62);font-size:17px;line-height:1.8}.fc-info{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:28px}.fc-info article,.fc-smallcards article{border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.045);border-radius:18px;padding:18px}.fc-info small,.fc-smallcards small{display:block;color:rgba(255,255,255,.4);font-weight:700;margin-bottom:8px}.fc-info strong{font-size:14px}.gold{border-color:rgba(251,191,36,.22)!important;background:rgba(251,191,36,.07)!important}.gold strong{color:#fde68a}.fc-mainbtn{margin-top:26px;min-height:56px;padding:0 28px;border-radius:16px;color:#fff;background:linear-gradient(90deg,#4f46e5,#7c3aed);box-shadow:0 18px 40px rgba(79,70,229,.3)}.fc-imagebox{padding:8px;border:1px solid rgba(255,255,255,.1);border-radius:30px;background:rgba(255,255,255,.04);box-shadow:0 28px 70px rgba(0,0,0,.35)}.fc-imagebox img{display:block;width:100%;height:auto;border-radius:23px}.fc-smallcards{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:13px}.fc-smallcards strong{display:block;font-size:19px}.fc-smallcards p{font-size:12px;color:rgba(255,255,255,.48);margin:5px 0 0}.fc-section{padding:86px 0}.alt{background:rgba(255,255,255,.02);border-top:1px solid rgba(255,255,255,.08);border-bottom:1px solid rgba(255,255,255,.08)}.fc-eyebrow{color:#818cf8;font-size:12px;font-weight:900;letter-spacing:.18em}.fc-section h2,.fc-bottom h2{font-size:38px;letter-spacing:-.035em;margin:10px 0}.fc-sub{color:rgba(255,255,255,.52);line-height:1.7}.fc-four{display:grid;grid-template-columns:repeat(4,1fr);gap:15px;margin-top:34px}.fc-four article{min-height:165px;padding:24px;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04);border-radius:22px}.fc-four b{color:#818cf8}.fc-four p{margin-top:24px;line-height:1.7;font-weight:800}.fc-two{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:34px}.fc-two article{position:relative;padding:27px;border:1px solid rgba(255,255,255,.1);background:linear-gradient(145deg,rgba(255,255,255,.06),rgba(255,255,255,.025));border-radius:24px}.fc-two small{color:#818cf8;font-weight:900;letter-spacing:.12em}.fc-two h3{font-size:23px;margin:10px 0}.fc-two article>b{position:absolute;right:25px;top:20px;color:rgba(255,255,255,.07);font-size:38px}.fc-two article>p{color:rgba(255,255,255,.5);line-height:1.75;font-size:14px}.fc-apply{padding:90px 0;background:#0b1324;border-block:1px solid rgba(255,255,255,.08)}.fc-apply-grid{display:grid;grid-template-columns:.9fr 1.1fr;gap:54px;align-items:start}.fc-copy h2{font-size:48px;line-height:1.2;letter-spacing:-.04em}.fc-copy>p:last-of-type{color:rgba(255,255,255,.55);line-height:1.8}.fc-checks{display:grid;gap:10px;margin-top:25px}.fc-checks div{display:flex;gap:12px;align-items:center;padding:14px 16px;border:1px solid rgba(255,255,255,.09);background:rgba(255,255,255,.035);border-radius:15px;color:rgba(255,255,255,.72);font-weight:700}.fc-checks i{width:27px;height:27px;border-radius:50%;display:grid;place-items:center;background:rgba(79,70,229,.2);color:#a5b4fc;font-style:normal}.fc-form{scroll-margin-top:100px;background:#fff;color:#111827;padding:36px;border-radius:28px;box-shadow:0 30px 80px rgba(0,0,0,.28)}.fc-formhead{display:flex;justify-content:space-between;gap:14px}.fc-formhead p{margin:0;color:#ef4444;font-size:13px;font-weight:900}.fc-formhead h2{margin:7px 0;font-size:29px}.fc-formhead>span{height:fit-content;padding:9px 13px;border-radius:999px;background:#eef2ff;color:#4f46e5;font-size:11px;font-weight:900}.fc-formdesc{color:#64748b;font-size:13px;line-height:1.7}.fc-fields{display:grid;grid-template-columns:1fr 1fr;gap:17px;margin-top:25px}.fc-fields label>span{display:block;margin-bottom:8px;color:#334155;font-size:13px;font-weight:800}.fc-fields label>span b{color:#ef4444}.fc-fields input,.fc-fields select{width:100%;height:54px;border:1px solid #e2e8f0;border-radius:14px;padding:0 14px;font-size:14px;outline:none;background:#fff;color:#111827}.fc-fields input:focus,.fc-fields select:focus{border-color:#6366f1;box-shadow:0 0 0 4px rgba(99,102,241,.09)}.fc-privacy{margin-top:20px;padding:18px;border:1px solid #e2e8f0;border-radius:16px;background:#f8fafc}.fc-privacy>label{display:flex;gap:9px;align-items:flex-start;font-size:13px;font-weight:800}.fc-privacy>label b{color:#4f46e5}.fc-privacy>div{margin-top:12px;padding:13px;border-radius:12px;background:#fff;color:#64748b;font-size:11px;line-height:1.8}.fc-notice{margin-top:16px;padding:13px 15px;border-radius:13px;font-size:13px;font-weight:800}.fc-notice.ok{background:#ecfdf5;color:#047857}.fc-notice.bad{background:#fef2f2;color:#dc2626}.fc-submit{width:100%;height:60px;margin-top:20px;border:0;border-radius:15px;color:#fff;font-size:15px;font-weight:900;background:linear-gradient(90deg,#4f46e5,#6366f1,#7c3aed);box-shadow:0 15px 34px rgba(79,70,229,.25)}.fc-bottom{padding:70px 0}.fc-bottom .fc-shell>div{text-align:center;padding:52px 35px;border-radius:30px;background:linear-gradient(100deg,#312e81,#4338ca,#6d28d9)}.fc-bottom small{color:rgba(255,255,255,.62);font-weight:900;letter-spacing:.14em}.fc-bottom p{color:rgba(255,255,255,.7)}.fc-bottom button{margin-top:14px;padding:15px 27px;border-radius:15px;background:#fff;color:#3730a3}.fc-mobile{display:none}@media(max-width:980px){.fc-hero-grid,.fc-apply-grid{grid-template-columns:1fr}.fc-four{grid-template-columns:1fr 1fr}}@media(max-width:680px){.fc-shell,.fc-topin{width:calc(100% - 28px)}.fc-topin{height:62px}.fc-logo{height:28px}.fc-hero{padding:38px 0 52px}.fc-hero h1{font-size:42px}.fc-info,.fc-four,.fc-two,.fc-fields{grid-template-columns:1fr}.fc-section{padding:60px 0}.fc-apply{padding:60px 0 90px}.fc-copy h2{font-size:38px}.fc-form{padding:24px 18px}.fc-formhead{flex-direction:column}.fc-mobile{display:block;position:fixed;z-index:100;left:14px;right:14px;bottom:14px;width:calc(100% - 28px);height:54px;border:0;border-radius:15px;color:#fff;font-weight:900;background:linear-gradient(90deg,#4f46e5,#7c3aed);box-shadow:0 15px 36px rgba(0,0,0,.35)}}
    `}</style>
  </>;
}
