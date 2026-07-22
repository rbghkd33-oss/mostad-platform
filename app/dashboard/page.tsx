"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3, Bell, Bot, ChevronRight, CircleHelp, Coins, CreditCard, ExternalLink,
  FolderKanban, Gauge, LayoutDashboard, Loader2, LogOut, Menu, MessageSquareText,
  Search, Settings, ShieldCheck, Sparkles, Store, UserRound, WalletCards, X,
  Megaphone, MapPin, NotebookTabs, CheckCircle2
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { getPointBalance } from "@/lib/points";

type Work = {
  id:number; product_name:string; product_code:string|null; package_option:string|null; status:string;
  total_units:number; completed_units:number; guarantee_days:number; service_start_date:string|null;
  service_end_date:string|null; current_rank:number|null; created_at:string; updated_at:string;
};
type Entry = { id:number; work_order_id:number; entry_date:string; entry_type:string; title:string|null; result_url:string|null; rank_value:number|null; note:string|null; created_at:string };

const navItems = [
  { label:"대시보드", icon:LayoutDashboard, active:true },
  { label:"플레이스분석", icon:Store, href:"/place-analysis" }, { label:"검색량 조회", icon:Search },
  { label:"인스타 마케팅", icon:Sparkles }, { label:"블로그 AI 글쓰기", icon:Bot },
  { label:"브랜딩 블로그 최적화 관리", icon:NotebookTabs, href:"/branding-blog" },
  { label:"전체 마케팅 보기", icon:Megaphone, href:"/marketing" },
  { label:"내 마케팅 진행", icon:FolderKanban, href:"/my-marketing" },
  { label:"포인트 충전", icon:CreditCard, href:"/points" },
];
const quickActions = [
  { title:"플레이스분석", description:"플레이스 순위와 경쟁업체 현황을 확인하세요.", icon:Store, tone:"purple", href:"/place-analysis" },
  { title:"검색량 조회", description:"키워드의 월간 검색량을 빠르게 조회하세요.", icon:Search, tone:"blue" },
  { title:"인스타 마케팅", description:"릴스 부스팅과 인스타 상품을 확인하세요.", icon:Sparkles, tone:"pink" },
  { title:"블로그 AI 글쓰기", description:"키워드에 맞는 블로그 원고를 작성하세요.", icon:Bot, tone:"orange" },
  { title:"브랜딩 블로그 최적화 관리", description:"10·20·30회 운영 상품을 포인트로 바로 신청하세요.", icon:NotebookTabs, tone:"blue", href:"/branding-blog" },
  { title:"포인트 충전", description:"서비스 이용에 필요한 포인트를 충전하세요.", icon:CreditCard, tone:"green", href:"/points" },
];
const statusLabel:Record<string,string>={received:"접수 완료",assigned:"담당자 배정",in_progress:"진행 중",review_requested:"검수 중",completed:"완료",cancelled:"취소"};
const formatDate=(v:string|null)=>v?new Intl.DateTimeFormat("ko-KR",{month:"2-digit",day:"2-digit"}).format(new Date(`${v}T00:00:00`)):"-";
const progressOf=(w:Work)=>{const total=w.total_units||w.guarantee_days||1;return Math.min(100,Math.round((w.completed_units/total)*100));};
const detailOf=(w:Work)=>{
  if(w.product_code==="branding_blog") return `${w.completed_units}/${w.total_units}회 진행`;
  if(w.current_rank) return `최근 ${w.current_rank}위 · ${w.completed_units}/${w.total_units}일`;
  if(w.service_end_date) return `${formatDate(w.service_start_date)} ~ ${formatDate(w.service_end_date)}`;
  return `${w.completed_units}/${w.total_units||w.guarantee_days} 진행`;
};

export default function DashboardPage(){
  const router=useRouter();
  const[email,setEmail]=useState(""); const[displayName,setDisplayName]=useState("모스트애드 회원");
  const[loading,setLoading]=useState(true); const[mobileOpen,setMobileOpen]=useState(false);
  const[pointBalance,setPointBalance]=useState(0); const[pointError,setPointError]=useState("");
  const[userRole,setUserRole]=useState("user"); const[works,setWorks]=useState<Work[]>([]); const[entries,setEntries]=useState<Entry[]>([]);

  useEffect(()=>{const supabase=getSupabaseBrowserClient();if(!supabase){setLoading(false);return;}(async()=>{
    const{data}=await supabase.auth.getUser(); if(!data.user){router.replace("/");return;}
    const metadata=data.user.user_metadata??{}; setEmail(data.user.email??"");
    await supabase.rpc("ensure_my_profile");
    const{data:profile}=await supabase.from("profiles").select("role,manager_name,company_name").eq("id",data.user.id).single();
    setDisplayName(profile?.manager_name||profile?.company_name||metadata.manager_name||metadata.company_name||"모스트애드 회원");
    setUserRole(profile?.role??"user");
    try{setPointBalance(await getPointBalance(supabase,data.user.id));}catch{setPointError("포인트 DB 설정이 필요합니다.");}
    const[{data:w},{data:e}]=await Promise.all([
      supabase.from("marketing_work_orders").select("id,product_name,product_code,package_option,status,total_units,completed_units,guarantee_days,service_start_date,service_end_date,current_rank,created_at,updated_at").eq("customer_id",data.user.id).order("updated_at",{ascending:false}),
      supabase.from("marketing_work_entries").select("id,work_order_id,entry_date,entry_type,title,result_url,rank_value,note,created_at").order("created_at",{ascending:false}).limit(20)
    ]);
    setWorks((w??[]) as Work[]); setEntries((e??[]) as Entry[]); setLoading(false);
  })();},[router]);

  const initials=useMemo(()=>displayName.trim().slice(0,1)||"M",[displayName]);
  const activeWorks=works.filter(w=>w.status!=="completed"&&w.status!=="cancelled");
  const completedWorks=works.filter(w=>w.status==="completed");
  const latestEntry=entries[0];
  const stats=[
    {label:"진행 중인 마케팅",value:String(activeWorks.length),unit:"건",icon:Gauge,tone:"purple",change:activeWorks.length?"실시간 업무 데이터":"진행 중인 상품 없음"},
    {label:"완료된 작업",value:String(completedWorks.length),unit:"건",icon:CheckCircle2,tone:"blue",change:"누적 완료 기준"},
    {label:"보유 포인트",value:pointBalance.toLocaleString(),unit:"P",icon:WalletCards,tone:"green",change:pointError||"충전·사용 내역 자동 반영"},
  ];
  async function logout(){const s=getSupabaseBrowserClient();await s?.auth.signOut();router.replace("/");router.refresh();}
  if(loading)return <main className="loading-screen"><Loader2 className="spin" size={32}/><span>대시보드를 불러오고 있습니다.</span></main>;

  return <main className="app-dashboard">
    {mobileOpen&&<button className="dashboard-overlay" aria-label="메뉴 닫기" onClick={()=>setMobileOpen(false)}/>}
    <aside className={`dashboard-sidebar ${mobileOpen?"is-open":""}`}>
      <div className="sidebar-brand"><span className="brand-symbol"><Sparkles size={21}/></span><div><strong>모스트애드</strong><span>MARKETING PLATFORM</span></div><button className="sidebar-close" onClick={()=>setMobileOpen(false)}><X size={20}/></button></div>
      <nav className="sidebar-nav"><p>WORKSPACE</p>{navItems.map(({label,icon:Icon,active,href})=><button key={label} className={active?"active":""} onClick={()=>href&&router.push(href)}><Icon size={19}/><span>{label}</span></button>)}</nav>
      <nav className="sidebar-nav sidebar-nav-bottom"><p>ACCOUNT</p><button><MessageSquareText size={19}/><span>고객센터</span></button><button><Settings size={19}/><span>환경 설정</span></button>{["admin","super_admin"].includes(userRole)&&<button onClick={()=>router.push("/admin")}><ShieldCheck size={19}/><span>관리자 페이지</span></button>}{userRole==="staff"&&<button onClick={()=>router.push("/staff")}><ShieldCheck size={19}/><span>직원 업무</span></button>}</nav>
      <div className="sidebar-support"><CircleHelp size={21}/><div><strong>도움이 필요하신가요?</strong><span>모스트애드 담당자에게 문의하세요.</span></div><ChevronRight size={17}/></div>
      <div className="sidebar-profile"><span className="profile-avatar">{initials}</span><div><strong>{displayName}</strong><span>{email}</span></div><button onClick={logout}><LogOut size={18}/></button></div>
    </aside>
    <section className="dashboard-workspace">
      <header className="dashboard-header"><div className="header-left"><button className="mobile-menu-button" onClick={()=>setMobileOpen(true)}><Menu size={22}/></button><div><span>{new Intl.DateTimeFormat("ko-KR",{dateStyle:"long"}).format(new Date())}</span><h1>안녕하세요, {displayName}님 👋</h1></div></div><div className="header-actions"><button className="header-search"><Search size={18}/><span>메뉴 또는 서비스를 검색하세요</span><kbd>⌘ K</kbd></button><button className="icon-button notification-button"><Bell size={20}/>{latestEntry&&<i/>}</button><button className="profile-button"><span>{initials}</span><UserRound size={17}/></button></div></header>
      <div className="dashboard-content">
        <section className="welcome-banner"><div><span className="banner-label"><Sparkles size={14}/> MOSTAD SMART WORKSPACE</span><h2>{activeWorks.length?`${activeWorks.length}개의 마케팅이\n진행 중입니다.`:"새로운 마케팅을\n시작해 보세요."}</h2><p>직원이 작업 내용을 등록하면 진행률과 순위, 결과 링크가<br/>고객 대시보드에 실시간으로 반영됩니다.</p><button onClick={()=>router.push(activeWorks.length?"/my-marketing":"/marketing")}>{activeWorks.length?"진행 현황 자세히 보기":"새 마케팅 시작하기"}<ChevronRight size={17}/></button></div><div className="banner-visual" aria-hidden="true"><div className="visual-card visual-card-a"><BarChart3 size={22}/><span>진행 업무</span><strong>{activeWorks.length}건</strong></div><div className="visual-card visual-card-b"><NotebookTabs size={22}/><span>최근 기록</span><strong>{entries.length}개</strong></div><div className="visual-ring ring-one"/><div className="visual-ring ring-two"/></div></section>
        <section className="dashboard-stat-grid">{stats.map(({label,value,unit,icon:Icon,tone,change})=><article className="dashboard-stat-card" key={label}><div className={`stat-icon ${tone}`}><Icon size={21}/></div><div className="stat-card-copy"><span>{label}</span><strong>{value}<em>{unit}</em></strong><small>{change}</small></div></article>)}</section>
        <section className="dashboard-section"><div className="section-heading"><div><span>QUICK START</span><h2>빠른 실행</h2></div><button onClick={()=>router.push("/marketing")}>전체 서비스 보기 <ChevronRight size={16}/></button></div><div className="quick-action-grid">{quickActions.map(({title,description,icon:Icon,tone,href})=><button className="quick-action-card" key={title} onClick={()=>href&&router.push(href)}><span className={`quick-icon ${tone}`}><Icon size={22}/></span><div><strong>{title}</strong><span>{description}</span></div><ChevronRight size={18}/></button>)}</div></section>
        <div className="dashboard-bottom-grid">
          <section className="dashboard-section project-section"><div className="section-heading"><div><span>PROJECT STATUS</span><h2>진행 중인 마케팅</h2></div><button onClick={()=>router.push("/my-marketing")}>전체 보기 <ChevronRight size={16}/></button></div><div className="project-list">{activeWorks.length?activeWorks.slice(0,4).map(w=><article className="project-row" key={w.id}><div className="project-main"><span className="project-category">{w.product_code?.includes("place")?"플레이스":"블로그"}</span><div><strong>{w.product_name}</strong><small>{detailOf(w)}</small></div></div><div className="project-status-block"><div><span>{statusLabel[w.status]||"진행 중"}</span><strong>{progressOf(w)}%</strong></div><div className="progress-track"><i style={{width:`${progressOf(w)}%`}}/></div></div><button onClick={()=>router.push("/my-marketing")}><ChevronRight size={18}/></button></article>):<div className="dashboard-live-empty">현재 진행 중인 마케팅이 없습니다.</div>}</div></section>
          <section className="dashboard-section activity-section"><div className="section-heading"><div><span>RECENT ACTIVITY</span><h2>최근 작업 업데이트</h2></div></div><div className="activity-list">{entries.length?entries.slice(0,5).map(e=>{const w=works.find(x=>x.id===e.work_order_id);const Icon=e.entry_type==="post"?NotebookTabs:MapPin;return <article key={e.id}><span><Icon size={17}/></span><div><strong>{w?.product_name||"마케팅 작업"} · {e.entry_type==="post"?(e.title||"포스팅 등록"):`${e.rank_value??"-"}위 확인`}</strong><small>{e.entry_date}{e.note?` · ${e.note}`:""}</small></div>{e.result_url&&<a className="dashboard-result-link" href={e.result_url} target="_blank" rel="noreferrer"><ExternalLink size={15}/></a>}</article>}):<div className="dashboard-live-empty">직원이 등록한 작업이 아직 없습니다.</div>}</div><button className="activity-more" onClick={()=>router.push("/my-marketing")}>모든 작업 기록 확인하기 <ChevronRight size={16}/></button></section>
        </div>
      </div>
    </section>
  </main>;
}
