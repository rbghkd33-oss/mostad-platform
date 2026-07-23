"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle, ArrowLeft, BarChart3, Building2, CheckCircle2, ChevronRight,
  ClipboardCheck, Download, ExternalLink, FileText, History, Loader2, MapPin,
  Search, Sparkles, Store, TrendingUp, UsersRound
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type Issue = { severity: string; area: string; title: string; detail: string; action: string };
type Competitor = { rank: number; name: string; visitor_review: number; blog_review: number };
type DiagnosisResult = {
  ok: boolean;
  report_url: string | null;
  place: { id: string; name: string; category: string; visitor_review_count: number; blog_review_count: number };
  summary: { visitor_grade: string; blog_grade: string; my_rank: number | null; avg_visitor: number; avg_blog: number };
  keyword_stats: Array<{ keyword: string; total_businesses: number | null; biz_exact: boolean; search_pc: number | null; search_mobile: number | null; search_total: number | null; comp_idx: string }>;
  issues: Issue[];
  competition: Array<{ keyword: string; my_rank: number | null; verdict: string; verdict_type: string; cta_headline: string; cta_body: string; competitors: Competitor[] }>;
  collected_at: string;
  warnings: string[];
};
type HistoryRow = { id:number; place_id:string; keyword:string; place_name:string|null; my_rank:number|null; report_url:string|null; created_at:string };

const number=(value:number|null|undefined)=>value==null?"-":value.toLocaleString("ko-KR");
const gradeClass=(value:string)=>value==="양호"?"good":value==="보통"?"warning":"critical";

export default function PlaceAnalysisPage(){
  const router=useRouter();
  const[placeId,setPlaceId]=useState("");
  const[keyword,setKeyword]=useState("");
  const[clientName,setClientName]=useState("");
  const[loading,setLoading]=useState(false);
  const[elapsed,setElapsed]=useState(0);
  const[error,setError]=useState("");
  const[result,setResult]=useState<DiagnosisResult|null>(null);
  const[history,setHistory]=useState<HistoryRow[]>([]);
  const[authLoading,setAuthLoading]=useState(true);

  useEffect(()=>{
    const supabase=getSupabaseBrowserClient();
    if(!supabase){setAuthLoading(false);return;}
    (async()=>{
      const{data}=await supabase.auth.getUser();
      if(!data.user){router.replace("/");return;}
      const{data:rows}=await supabase.from("place_analysis_history")
        .select("id,place_id,keyword,place_name,my_rank,report_url,created_at")
        .eq("user_id",data.user.id).order("created_at",{ascending:false}).limit(8);
      setHistory((rows??[]) as HistoryRow[]);
      setAuthLoading(false);
    })();
  },[router]);

  useEffect(()=>{
    if(!loading){setElapsed(0);return;}
    const started=Date.now();
    const id=setInterval(()=>setElapsed(Math.floor((Date.now()-started)/1000)),1000);
    return()=>clearInterval(id);
  },[loading]);

  const keywordStat=result?.keyword_stats?.[0];
  const competition=result?.competition?.[0];
  const cards=useMemo(()=>result?[
    {label:"방문자 리뷰",value:number(result.place.visitor_review_count),sub:`상위권 평균 ${number(result.summary.avg_visitor)}`,icon:UsersRound,tone:gradeClass(result.summary.visitor_grade),badge:result.summary.visitor_grade},
    {label:"블로그 리뷰",value:number(result.place.blog_review_count),sub:`상위권 평균 ${number(result.summary.avg_blog)}`,icon:FileText,tone:gradeClass(result.summary.blog_grade),badge:result.summary.blog_grade},
    {label:"현재 순위",value:result.summary.my_rank?`${result.summary.my_rank}위`:"미노출",sub:keywordStat?.keyword||keyword,icon:TrendingUp,tone:result.summary.my_rank&&result.summary.my_rank<=5?"good":"critical",badge:result.summary.my_rank&&result.summary.my_rank<=5?"상위권":"개선 필요"},
    {label:"월 검색량",value:number(keywordStat?.search_total),sub:`PC ${number(keywordStat?.search_pc)} · 모바일 ${number(keywordStat?.search_mobile)}`,icon:BarChart3,tone:"purple",badge:keywordStat?.comp_idx||"-"},
    {label:"노출 업체 수",value:keywordStat?.total_businesses==null?"-":`${number(keywordStat.total_businesses)}곳${keywordStat.biz_exact?"":" 이상"}`,sub:"검색 결과 경쟁 업체",icon:Building2,tone:"blue",badge:keywordStat?.biz_exact?"정확값":"근사값"}
  ]:[],[result,keyword,keywordStat]);

  async function reloadHistory(userId:string){
    const supabase=getSupabaseBrowserClient();
    const{data:rows}=await supabase!.from("place_analysis_history")
      .select("id,place_id,keyword,place_name,my_rank,report_url,created_at")
      .eq("user_id",userId).order("created_at",{ascending:false}).limit(8);
    setHistory((rows??[]) as HistoryRow[]);
  }

  async function submit(event:FormEvent){
    event.preventDefault();setError("");setResult(null);setLoading(true);
    try{
      const supabase=getSupabaseBrowserClient();
      const{data}=await supabase!.auth.getSession();
      const token=data.session?.access_token;
      if(!token)throw new Error("로그인이 필요합니다.");
      const response=await fetch("/api/place-analysis",{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
        body:JSON.stringify({placeId,keyword,clientName})
      });
      const payload=await response.json();
      if(!response.ok)throw new Error(payload.error||"진단 요청에 실패했습니다.");
      setResult(payload as DiagnosisResult);
      await reloadHistory(data.session!.user.id);
    }catch(e){setError(e instanceof Error?e.message:"진단 중 오류가 발생했습니다.");}
    finally{setLoading(false);}
  }

  if(authLoading)return <main className="loading-screen"><Loader2 className="spin" size={32}/><span>플레이스 분석을 준비하고 있습니다.</span></main>;

  return <main className="place-analysis-page">
    <header className="place-analysis-topbar">
      <button onClick={()=>router.push("/dashboard")}><ArrowLeft size={18}/>대시보드로 돌아가기</button>
      <div><img className="mostad-brand-logo" src="/mostad-logo.png" alt="모스트애드 로고"/><strong>모스트애드 플레이스 분석</strong></div>
    </header>

    <section className="place-analysis-container">
      <div className="place-analysis-hero">
        <div><span>MOSTAD PLACE DIAGNOSIS</span><h1>네이버 플레이스 경쟁력을<br/>한 번에 진단하세요.</h1><p>플레이스 ID와 핵심 키워드만 입력하면 순위, 리뷰 경쟁력, 검색량, 경쟁업체와 개선 과제를 분석합니다.</p></div>
        <div className="place-analysis-hero-card"><Store size={30}/><strong>20~30초</strong><span>평균 진단 시간</span></div>
      </div>

      <div className="place-analysis-layout">
        <section className="place-analysis-form-card">
          <div className="place-analysis-section-title"><span><Search size={19}/></span><div><strong>플레이스 진단 시작</strong><p>네이버 플레이스 주소 전체를 붙여넣어도 ID를 자동으로 찾습니다.</p></div></div>
          <form onSubmit={submit} className="place-analysis-form">
            <label><span>플레이스 ID 또는 주소 <b>필수</b></span><div><MapPin size={18}/><input value={placeId} onChange={e=>setPlaceId(e.target.value)} placeholder="예: 1838879829 또는 네이버 플레이스 주소" required/></div></label>
            <label><span>진단 키워드 <b>필수</b></span><div><Search size={18}/><input value={keyword} onChange={e=>setKeyword(e.target.value)} placeholder="예: 대전두피문신" required/></div></label>
            <label><span>매장명 <em>선택</em></span><div><Store size={18}/><input value={clientName} onChange={e=>setClientName(e.target.value)} placeholder="생략하면 자동으로 수집합니다."/></div></label>
            {error&&<div className="place-analysis-error"><AlertTriangle size={17}/>{error}</div>}
            <button type="submit" disabled={loading}>{loading?<><Loader2 className="spin" size={18}/>진단 중... {elapsed}초</>:<><Sparkles size={18}/>플레이스 분석 시작<ChevronRight size={18}/></>}</button>
          </form>
          {loading&&<div className="place-analysis-loading"><div className="analysis-loader-orbit"><Store size={25}/><i/><i/></div><strong>플레이스 정보를 수집하고 있습니다.</strong><p>순위 측정과 경쟁업체 비교, PDF 보고서 생성까지 약 20~30초 정도 소요됩니다. 창을 닫지 마세요.</p><div className="analysis-loading-steps"><span className="active">매장 정보</span><span className={elapsed>=6?"active":""}>순위 측정</span><span className={elapsed>=14?"active":""}>경쟁 분석</span><span className={elapsed>=22?"active":""}>보고서 생성</span></div></div>}
        </section>

        <aside className="place-analysis-history">
          <div className="place-analysis-section-title"><span><History size={19}/></span><div><strong>최근 진단</strong><p>최근 실행한 8개 결과입니다.</p></div></div>
          {history.length?<div className="analysis-history-list">{history.map(row=><article key={row.id}><div><strong>{row.place_name||`플레이스 ${row.place_id}`}</strong><span>{row.keyword} · {row.my_rank?`${row.my_rank}위`:"미노출"}</span><small>{new Intl.DateTimeFormat("ko-KR",{dateStyle:"medium",timeStyle:"short"}).format(new Date(row.created_at))}</small></div>{row.report_url&&<a href={row.report_url} target="_blank" rel="noreferrer" aria-label="PDF 열기"><ExternalLink size={17}/></a>}</article>)}</div>:<div className="analysis-history-empty"><ClipboardCheck size={28}/><strong>진단 기록이 없습니다.</strong><span>첫 플레이스 분석을 시작해 보세요.</span></div>}
        </aside>
      </div>

      {result&&<section className="place-analysis-result">
        <div className="analysis-result-heading"><div><span>DIAGNOSIS RESULT</span><h2>{result.place.name}</h2><p>{result.place.category} · 수집 시각 {result.collected_at}</p></div>{result.report_url&&<a href={result.report_url} target="_blank" rel="noreferrer"><Download size={18}/>PDF 진단 보고서</a>}</div>
        <div className="analysis-metric-grid">{cards.map(({label,value,sub,icon:Icon,tone,badge})=><article key={label}><div className={`analysis-metric-icon ${tone}`}><Icon size={21}/></div><span>{label}</span><strong>{value}</strong><small>{sub}</small><em className={tone}>{badge}</em></article>)}</div>
        <div className="analysis-result-grid">
          <section className="analysis-issues-card"><div className="place-analysis-section-title"><span><ClipboardCheck size={19}/></span><div><strong>개선 과제</strong><p>진단 결과를 바탕으로 우선순위를 정리했습니다.</p></div></div><div className="analysis-issue-list">{(result.issues||[]).map((issue,index)=><article className={issue.severity} key={`${issue.area}-${index}`}><div className="issue-head"><span><AlertTriangle size={16}/>{issue.severity==="critical"?"긴급":issue.severity==="good"?"양호":"주의"}</span><em>{issue.area}</em></div><strong>{issue.title}</strong><p>{issue.detail}</p><div><CheckCircle2 size={16}/><span>{issue.action}</span></div></article>)}</div></section>
          <section className="analysis-competition-card"><div className="place-analysis-section-title"><span><UsersRound size={19}/></span><div><strong>상위 경쟁업체 비교</strong><p>키워드 상위 3~5위 업체 기준입니다.</p></div></div><div className="analysis-competitor-table"><div className="competitor-head"><span>순위·업체</span><span>방문자 리뷰</span><span>블로그 리뷰</span></div>{(competition?.competitors||[]).map(item=><div className="competitor-row" key={`${item.rank}-${item.name}`}><span><b>{item.rank}위</b>{item.name}</span><strong>{number(item.visitor_review)}</strong><strong>{number(item.blog_review)}</strong></div>)}</div>{competition&&<div className="analysis-cta"><Sparkles size={20}/><div><strong>{competition.cta_headline}</strong><p>{competition.cta_body}</p></div></div>}</section>
        </div>
        {!!result.warnings?.length&&<div className="analysis-warning-box"><AlertTriangle size={17}/><div><strong>수집 참고사항</strong>{result.warnings.map((warning,index)=><p key={index}>{warning}</p>)}</div></div>}
      </section>}
    </section>
  </main>;
}
