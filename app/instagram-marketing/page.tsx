"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, CheckCircle2, Clock3, Eye, Heart, Loader2, MessageCircle,
  Plus, RefreshCw, Settings2, Sparkles, UserPlus, XCircle,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { getPointBalance } from "@/lib/points";

type OrderStatus = "pending_approval" | "active" | "rejected" | "expired" | "canceled";
type InstagramOrder = {
  id:number; instagram_username:string; status:OrderStatus; price_points:number;
  follow_enabled:boolean; follow_keywords:string; feed_follow_limit:number; search_follow_limit:number;
  like_enabled:boolean; like_keywords:string; feed_like_limit:number; search_like_limit:number;
  story_enabled:boolean; story_daily_limit:number; comment_enabled:boolean; comment_daily_limit:number;
  comment_templates:string; rejection_reason:string|null; service_start_at:string|null;
  service_end_at:string|null; created_at:string;
};
type AutomationSchedule={
  insta_id:string;is_active:boolean;status_code:string;status_msg:string;updated_at:string;
  progress:{likes:{done:number;limit:number};follows:{done:number;limit:number};comments:{done:number;limit:number};stories:{done:number;limit:number}};
};
type AutomationLog={id:number;task_type:string;message:string;success:boolean;created_at:string;time?:string};
type LiveState={schedule?:AutomationSchedule;logs:AutomationLog[];loading:boolean;error?:string};

const PRICE = 150000;
const statusInfo:Record<OrderStatus,{label:string;className:string;description:string}> = {
  pending_approval:{label:"관리자 승인 요청 중",className:"pending",description:"관리자가 신청 내용을 확인하고 있습니다."},
  active:{label:"인스타 최적화 가동중",className:"active",description:"설정한 조건으로 최적화 서비스가 진행 중입니다."},
  rejected:{label:"승인 반려",className:"rejected",description:"신청 금액은 포인트로 자동 환불됩니다."},
  expired:{label:"30일 상품 종료",className:"expired",description:"이용 기간이 종료된 계정입니다."},
  canceled:{label:"서비스 취소",className:"canceled",description:"취소된 계정입니다."},
};
const numberValue=(value:string,max:number)=>Math.max(0,Math.min(Number(value.replace(/[^0-9]/g,""))||0,max));
const dateText=(value:string|null)=>value?new Intl.DateTimeFormat("ko-KR",{year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date(value)):"-";
const daysLeft=(end:string|null)=>end?Math.max(0,Math.ceil((new Date(end).getTime()-Date.now())/86400000)):0;

export default function InstagramMarketingPage(){
  const router=useRouter();
  const[loading,setLoading]=useState(true); const[submitting,setSubmitting]=useState(false);
  const[balance,setBalance]=useState(0); const[orders,setOrders]=useState<InstagramOrder[]>([]);
  const[liveStates,setLiveStates]=useState<Record<number,LiveState>>({});
  const[message,setMessage]=useState(""); const[error,setError]=useState("");
  const[username,setUsername]=useState("");
  const[password,setPassword]=useState("");
  const[showPassword,setShowPassword]=useState(false);
  const[followEnabled,setFollowEnabled]=useState(true); const[followKeywords,setFollowKeywords]=useState("맛집,카페");
  const[feedFollow,setFeedFollow]=useState(10); const[searchFollow,setSearchFollow]=useState(10);
  const[likeEnabled,setLikeEnabled]=useState(true); const[likeKeywords,setLikeKeywords]=useState("맛집,카페");
  const[feedLike,setFeedLike]=useState(25); const[searchLike,setSearchLike]=useState(25);
  const[storyEnabled,setStoryEnabled]=useState(true); const[storyLimit,setStoryLimit]=useState(30);
  const[commentEnabled,setCommentEnabled]=useState(true); const[commentLimit,setCommentLimit]=useState(5);
  const[comments,setComments]=useState("😊\n좋은 게시물이네요 😊");

  async function load(){
    const supabase=getSupabaseBrowserClient(); if(!supabase)return;
    const{data:{user}}=await supabase.auth.getUser(); if(!user){router.replace("/");return;}
    await supabase.rpc("refresh_instagram_order_expiry");
    const[{data:o,error:e},points]=await Promise.all([
      supabase.from("instagram_optimization_orders").select("id,instagram_username,status,price_points,follow_enabled,follow_keywords,feed_follow_limit,search_follow_limit,like_enabled,like_keywords,feed_like_limit,search_like_limit,story_enabled,story_daily_limit,comment_enabled,comment_daily_limit,comment_templates,rejection_reason,service_start_at,service_end_at,created_at").eq("user_id",user.id).order("created_at",{ascending:false}),
      getPointBalance(supabase,user.id),
    ]);
    if(e)throw e; setOrders((o??[]) as InstagramOrder[]);setBalance(points);
  }
  useEffect(()=>{load().catch(e=>setError(e instanceof Error?e.message:"정보를 불러오지 못했습니다.")).finally(()=>setLoading(false));},[]);

  useEffect(()=>{
    const activeOrders=orders.filter(order=>order.status==="active");
    if(!activeOrders.length){setLiveStates({});return;}
    let cancelled=false;
    async function poll(){
      const supabase=getSupabaseBrowserClient();if(!supabase)return;
      const{data:{session}}=await supabase.auth.getSession();if(!session)return;
      await Promise.all(activeOrders.map(async order=>{
        setLiveStates(prev=>({...prev,[order.id]:{...(prev[order.id]??{logs:[]}),loading:!prev[order.id]?.schedule}}));
        try{
          const headers={Authorization:`Bearer ${session.access_token}`};
          const[scheduleResponse,logsResponse]=await Promise.all([
            fetch(`/api/instagram-orders/${order.id}/schedule`,{headers,cache:"no-store"}),
            fetch(`/api/instagram-orders/${order.id}/logs`,{headers,cache:"no-store"}),
          ]);
          const scheduleData=await scheduleResponse.json().catch(()=>({}));
          const logsData=await logsResponse.json().catch(()=>[]);
          if(!scheduleResponse.ok)throw new Error(scheduleData.error||"자동화 현황을 불러오지 못했습니다.");
          if(!logsResponse.ok)throw new Error(logsData.error||"자동화 로그를 불러오지 못했습니다.");
          if(!cancelled)setLiveStates(prev=>({...prev,[order.id]:{schedule:scheduleData as AutomationSchedule,logs:Array.isArray(logsData)?logsData as AutomationLog[]:[],loading:false}}));
        }catch(e){
          if(!cancelled)setLiveStates(prev=>({...prev,[order.id]:{...(prev[order.id]??{logs:[]}),loading:false,error:e instanceof Error?e.message:"자동화 서버 연결 오류"}}));
        }
      }));
    }
    poll();
    const timer=window.setInterval(poll,4000);
    return()=>{cancelled=true;window.clearInterval(timer);};
  },[orders]);

  const activeCount=orders.filter(o=>o.status==="active").length;
  const pendingCount=orders.filter(o=>o.status==="pending_approval").length;
  const canSubmit=balance>=PRICE&&username.trim().length>0&&password.length>=4&&!submitting;

  async function submit(){
    if(!canSubmit)return; const supabase=getSupabaseBrowserClient();if(!supabase)return;
    setSubmitting(true);setError("");setMessage("");
    const{data:{session}}=await supabase.auth.getSession();
    if(!session){setError("로그인이 필요합니다.");setSubmitting(false);return;}
    const response=await fetch("/api/instagram-orders/create",{
      method:"POST",
      headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},
      body:JSON.stringify({
        instagramUsername:username.trim(),instagramPassword:password,
        followEnabled,followKeywords,feedFollowLimit:feedFollow,searchFollowLimit:searchFollow,
        likeEnabled,likeKeywords,feedLikeLimit:feedLike,searchLikeLimit:searchLike,
        storyEnabled,storyDailyLimit:storyLimit,commentEnabled,commentDailyLimit:commentLimit,
        commentTemplates:comments,
      }),
    });
    const data=await response.json().catch(()=>({}));
    if(!response.ok){setError(data.error||"계정 신청 중 오류가 발생했습니다.");setSubmitting(false);return;}
    setUsername("");setPassword("");setShowPassword(false);setMessage("계정 신청이 접수되었습니다. 관리자 승인 후 30일 동안 가동됩니다.");
    await load();setSubmitting(false);
  }

  if(loading)return <main className="loading-screen"><Loader2 className="spin" size={32}/><span>인스타 마케팅을 불러오고 있습니다.</span></main>;

  return <main className="instagram-page">
    <div className="instagram-shell">
      <button className="instagram-back" onClick={()=>router.push("/dashboard")}><ArrowLeft size={17}/>대시보드</button>
      <section className="instagram-hero">
        <div><span><Sparkles size={15}/> MOSTAD INSTAGRAM OPTIMIZER</span><h1>인스타 계정 최적화</h1><p>원하는 활동 조건을 설정하고 계정을 신청하세요.<br/>관리자 승인 후 30일 동안 최적화 서비스가 가동됩니다.</p></div>
        <div className="instagram-price"><small>계정 1개 · 30일</small><strong>150,000P</strong><span>승인 반려 시 자동 환불</span></div>
      </section>

      <section className="instagram-summary">
        <article><span>보유 포인트</span><strong>{balance.toLocaleString()}P</strong></article>
        <article><span>승인 요청 중</span><strong>{pendingCount}개</strong></article>
        <article><span>최적화 가동중</span><strong>{activeCount}개</strong></article>
      </section>

      <section className="instagram-account-card">
        <div className="instagram-section-title"><span><UserPlus size={20}/></span><div><h2>새 계정 추가</h2><p>인스타그램 로그인 정보를 입력하면 암호화되어 안전하게 저장됩니다.</p></div></div>
        <div className="instagram-login-grid">
          <div className="instagram-account-input"><span>@</span><input value={username} onChange={e=>setUsername(e.target.value.replace(/^@/,""))} placeholder="인스타그램 아이디" maxLength={100}/></div>
          <div className="instagram-password-input"><span>PW</span><input type={showPassword?"text":"password"} value={password} onChange={e=>setPassword(e.target.value)} placeholder="인스타그램 비밀번호" maxLength={200}/><button type="button" onClick={()=>setShowPassword(v=>!v)}>{showPassword?"숨기기":"보기"}</button></div>
        </div>
        <p className="instagram-security-note">비밀번호는 서버에서 암호화되어 저장되며 관리자 로그인 작업 시에만 확인됩니다.</p>
      </section>

      <section className="instagram-control-card">
        <div className="instagram-control-heading"><div><Settings2 size={20}/><h2>계정 활동 설정</h2></div><span>선택한 설정은 승인 후 적용됩니다.</span></div>
        <div className="instagram-control-grid">
          <SettingBox icon={<UserPlus size={18}/>} title="선팔로우 설정" checked={followEnabled} setChecked={setFollowEnabled}>
            <label>검색 키워드 <small>쉼표로 구분</small><input disabled={!followEnabled} value={followKeywords} onChange={e=>setFollowKeywords(e.target.value)} placeholder="맛집,카페"/></label>
            <div className="instagram-two-input"><label>피드 선팔 한도<input disabled={!followEnabled} value={feedFollow} onChange={e=>setFeedFollow(numberValue(e.target.value,500))}/></label><label>검색 선팔 한도<input disabled={!followEnabled} value={searchFollow} onChange={e=>setSearchFollow(numberValue(e.target.value,500))}/></label></div>
          </SettingBox>
          <SettingBox icon={<Heart size={18}/>} title="좋아요 설정" checked={likeEnabled} setChecked={setLikeEnabled}>
            <label>검색 키워드 <small>쉼표로 구분</small><input disabled={!likeEnabled} value={likeKeywords} onChange={e=>setLikeKeywords(e.target.value)} placeholder="맛집,카페"/></label>
            <div className="instagram-two-input"><label>피드 좋아요 한도<input disabled={!likeEnabled} value={feedLike} onChange={e=>setFeedLike(numberValue(e.target.value,1000))}/></label><label>검색 좋아요 한도<input disabled={!likeEnabled} value={searchLike} onChange={e=>setSearchLike(numberValue(e.target.value,1000))}/></label></div>
          </SettingBox>
          <SettingBox icon={<Eye size={18}/>} title="스토리 자동 시청" checked={storyEnabled} setChecked={setStoryEnabled}>
            <label>일일 시청 한도<input disabled={!storyEnabled} value={storyLimit} onChange={e=>setStoryLimit(numberValue(e.target.value,1000))}/></label>
          </SettingBox>
          <SettingBox icon={<MessageCircle size={18}/>} title="소통 댓글 설정" checked={commentEnabled} setChecked={setCommentEnabled}>
            <label>일일 최대 댓글 수<input disabled={!commentEnabled} value={commentLimit} onChange={e=>setCommentLimit(numberValue(e.target.value,100))}/></label>
            <label>댓글 템플릿 <small>한 줄에 하나</small><textarea disabled={!commentEnabled} value={comments} onChange={e=>setComments(e.target.value)} placeholder={'😊\n좋은 게시물이네요 😊'}/></label>
          </SettingBox>
        </div>
        {error&&<div className="instagram-alert error"><XCircle size={17}/>{error}</div>}
        {message&&<div className="instagram-alert success"><CheckCircle2 size={17}/>{message}</div>}
        <div className="instagram-submit-row"><div><span>신청 시 차감</span><strong>150,000P</strong><small>관리자 승인일부터 30일간 이용</small></div><button disabled={!canSubmit} onClick={submit}>{submitting?<><Loader2 className="spin" size={18}/>접수 중</>:<><Plus size={18}/>계정 추가 및 승인 요청</>}</button></div>
        {balance<PRICE&&<p className="instagram-point-warning">포인트가 부족합니다. 포인트 충전 후 신청할 수 있습니다.</p>}
      </section>

      <section className="instagram-orders">
        <div className="instagram-orders-heading"><div><h2>신청 계정 목록</h2><p>승인 상태와 30일 이용기간을 확인할 수 있습니다.</p></div><button onClick={()=>load()}><RefreshCw size={16}/>새로고침</button></div>
        {orders.length?<div className="instagram-order-list">{orders.map(order=>{const info=statusInfo[order.status];return <article key={order.id}>
          <div className="instagram-order-main"><span className="instagram-avatar">@</span><div><h3>@{order.instagram_username}</h3><p>신청일 {dateText(order.created_at)}</p></div><b className={`instagram-order-status ${info.className}`}>{info.label}</b></div>
          <div className="instagram-order-detail"><span><small>이용 기간</small><strong>{order.status==="active"?`${dateText(order.service_start_at)} ~ ${dateText(order.service_end_at)}`:"승인 후 30일"}</strong></span><span><small>남은 기간</small><strong>{order.status==="active"?`${daysLeft(order.service_end_at)}일`:"-"}</strong></span><span><small>사용 포인트</small><strong>{Number(order.price_points).toLocaleString()}P</strong></span></div>
          <p className="instagram-order-description">{order.status==="rejected"&&order.rejection_reason?order.rejection_reason:info.description}</p>
          <div className="instagram-feature-tags">{order.follow_enabled&&<span>선팔 {order.feed_follow_limit+order.search_follow_limit}</span>}{order.like_enabled&&<span>좋아요 {order.feed_like_limit+order.search_like_limit}</span>}{order.story_enabled&&<span>스토리 {order.story_daily_limit}</span>}{order.comment_enabled&&<span>댓글 {order.comment_daily_limit}</span>}</div>
          {order.status==="active"&&<LiveAutomationPanel state={liveStates[order.id]}/>} 
        </article>})}</div>:<div className="instagram-empty"><Clock3 size={30}/><strong>신청한 계정이 없습니다.</strong><span>설정을 완료하고 첫 계정을 추가해 보세요.</span></div>}
      </section>
    </div>
  </main>;
}

function LiveAutomationPanel({state}:{state?:LiveState}){
  if(!state||state.loading)return <div className="instagram-live loading"><Loader2 className="spin" size={18}/><span>자동화 서버 현황을 연결하고 있습니다.</span></div>;
  if(state.error)return <div className="instagram-live error"><XCircle size={17}/><div><strong>자동화 서버 연결 확인 필요</strong><span>{state.error}</span></div></div>;
  const schedule=state.schedule;if(!schedule)return null;
  const items=[
    {label:"좋아요",icon:<Heart size={15}/>,value:schedule.progress.likes},
    {label:"팔로우",icon:<UserPlus size={15}/>,value:schedule.progress.follows},
    {label:"댓글",icon:<MessageCircle size={15}/>,value:schedule.progress.comments},
    {label:"스토리",icon:<Eye size={15}/>,value:schedule.progress.stories},
  ];
  return <div className="instagram-live">
    <div className="instagram-live-head"><div><span className={`instagram-live-dot ${schedule.status_code.toLowerCase()}`}/><div><strong>{schedule.status_msg||"자동화 상태 확인 중"}</strong><small>{schedule.status_code} · {new Date(schedule.updated_at).toLocaleTimeString("ko-KR")}</small></div></div><RefreshCw size={15}/></div>
    <div className="instagram-live-progress">{items.map(item=>{const max=Math.max(0,item.value.limit);const percent=max?Math.min(100,Math.round(item.value.done/max*100)):0;return <article key={item.label}><div><span>{item.icon}{item.label}</span><strong>{item.value.done}<small> / {item.value.limit}</small></strong></div><i><b style={{width:`${percent}%`}}/></i></article>;})}</div>
    <div className="instagram-live-logs"><div><strong>최근 작업 로그</strong><small>4초마다 자동 갱신</small></div>{state.logs.length?<ul>{state.logs.slice(0,8).map(log=><li key={log.id}><span className={log.success?"success":"failed"}>{log.success?<CheckCircle2 size={14}/>:<XCircle size={14}/>}</span><p><strong>{log.message}</strong><small>{log.time||new Date(log.created_at).toLocaleTimeString("ko-KR")}</small></p></li>)}</ul>:<p className="instagram-live-empty">아직 기록된 작업 로그가 없습니다.</p>}</div>
  </div>;
}

function SettingBox({icon,title,checked,setChecked,children}:{icon:ReactNode;title:string;checked:boolean;setChecked:(v:boolean)=>void;children:ReactNode}){
  return <article className={!checked?"disabled":""}><button type="button" className="instagram-setting-toggle" onClick={()=>setChecked(!checked)}><span className={checked?"checked":""}>{checked&&<CheckCircle2 size={15}/>}</span>{icon}<strong>{title}</strong></button><div className="instagram-setting-fields">{children}</div></article>;
}
