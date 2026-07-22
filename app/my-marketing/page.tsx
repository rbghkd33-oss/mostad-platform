"use client";
import {useEffect,useMemo,useState} from "react";
import {useRouter} from "next/navigation";
import {ArrowLeft,CalendarDays,CheckCircle2,Clock3,ExternalLink,Loader2,MapPin,NotebookTabs,RefreshCw} from "lucide-react";
import {getSupabaseBrowserClient} from "@/lib/supabase";

type W={id:number;product_name:string;product_code:string|null;package_option:string|null;status:string;total_units:number;completed_units:number;guarantee_days:number;service_start_date:string|null;service_end_date:string|null;current_rank:number|null;created_at:string;updated_at:string};
type E={id:number;work_order_id:number;entry_date:string;entry_type:string;title:string|null;result_url:string|null;rank_value:number|null;note:string|null;created_at:string};
const labels:Record<string,string>={received:"접수 완료",assigned:"담당자 배정",in_progress:"진행 중",review_requested:"검수 중",completed:"완료",cancelled:"취소"};
const date=(v:string|null)=>v?new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(`${v}T00:00:00`)):"-";
const today=new Date();today.setHours(0,0,0,0);
const remainingDays=(end:string|null)=>{if(!end)return null;const d=new Date(`${end}T00:00:00`);return Math.max(0,Math.ceil((d.getTime()-today.getTime())/86400000)+1);};

export default function MyMarketing(){
 const r=useRouter();const[loading,setLoading]=useState(true);const[refreshing,setRefreshing]=useState(false);const[works,setWorks]=useState<W[]>([]);const[entries,setEntries]=useState<E[]>([]);
 async function load(){const s=getSupabaseBrowserClient();if(!s){setLoading(false);return;}const{data:a}=await s.auth.getUser();if(!a.user){r.replace("/");return;}const[{data:w},{data:e}]=await Promise.all([s.from("marketing_work_orders").select("id,product_name,product_code,package_option,status,total_units,completed_units,guarantee_days,service_start_date,service_end_date,current_rank,created_at,updated_at").eq("customer_id",a.user.id).order("updated_at",{ascending:false}),s.from("marketing_work_entries").select("id,work_order_id,entry_date,entry_type,title,result_url,rank_value,note,created_at").order("entry_date",{ascending:false}).order("created_at",{ascending:false})]);setWorks((w??[])as W[]);setEntries((e??[])as E[]);setLoading(false);setRefreshing(false);}
 useEffect(()=>{load();},[]);
 const summary=useMemo(()=>({active:works.filter(w=>!["completed","cancelled"].includes(w.status)).length,done:works.filter(w=>w.status==="completed").length,updates:entries.length}),[works,entries]);
 if(loading)return <main className="loading-screen"><Loader2 className="spin"/>진행 현황을 불러오는 중입니다.</main>;
 return <main className="customer-progress-page"><header><button onClick={()=>r.push("/dashboard")}><ArrowLeft/>대시보드</button><div><small>MOSTAD SERVICE STATUS</small><h1>내 마케팅 진행 현황</h1></div><button className="customer-refresh" onClick={()=>{setRefreshing(true);load();}} disabled={refreshing}><RefreshCw className={refreshing?"spin":""}/>새로고침</button></header>
 <section className="customer-summary-grid"><article><Clock3/><span>진행 중</span><strong>{summary.active}건</strong></article><article><CheckCircle2/><span>완료</span><strong>{summary.done}건</strong></article><article><CalendarDays/><span>누적 업데이트</span><strong>{summary.updates}건</strong></article></section>
 <section className="customer-work-grid">{works.length?works.map(w=>{const es=entries.filter(e=>e.work_order_id===w.id);const total=w.total_units||w.guarantee_days||1;const pct=Math.min(100,Math.round(w.completed_units/total*100));const remain=remainingDays(w.service_end_date);const isBlog=w.product_code==="branding_blog";const option=w.product_code==="blog_ranking"?(w.package_option==="24h"?"24시간 노출 보장":"25일 노출 보장"):(w.package_option?`${w.package_option}회 상품`:"진행 상품");return <article className="customer-work-card" key={w.id}>
 <div className="customer-work-head"><span>{w.product_code?.includes("place")?<MapPin/>:<NotebookTabs/>}</span><div><small>{option}</small><h2>{w.product_name}</h2></div><b className={w.status==="completed"?"done":""}>{labels[w.status]||"진행 중"}</b></div>
 <div className="customer-progress-count"><strong>{w.completed_units}/{total}<em>{isBlog?"회":"일"}</em></strong><span>{w.current_rank?`최근 등록 순위 ${w.current_rank}위`:remain!==null?`남은 기간 ${remain}일`:w.service_start_date?`${date(w.service_start_date)} 시작`:"작업 기록 기준"}</span></div>
 <div className="progress-track"><i style={{width:`${pct}%`}}/></div>
 <div className="customer-work-meta"><span>진행률 <b>{pct}%</b></span><span>시작일 <b>{date(w.service_start_date)}</b></span><span>종료 예정 <b>{date(w.service_end_date)}</b></span><span>최근 업데이트 <b>{date(w.updated_at.slice(0,10))}</b></span></div>
 <div className="customer-entry-list"><h3><CalendarDays/>날짜별 작업 기록</h3>{es.length?es.map(e=><div key={e.id}><time>{e.entry_date}</time><span>{e.entry_type==="post"?(e.title||"포스팅 등록"):e.entry_type==="rank"?`${e.rank_value??"-"}위 확인`:(e.title||"작업 업데이트")}</span>{e.note&&<small>{e.note}</small>}{e.result_url&&<a href={e.result_url} target="_blank" rel="noreferrer" title="결과 링크 열기"><ExternalLink/></a>}</div>):<p>직원이 작업을 등록하면 날짜별 진행 내용과 결과 링크가 표시됩니다.</p>}</div>
 </article>}):<div className="admin-empty">현재 진행 중인 마케팅 상품이 없습니다.</div>}</section></main>;
}
