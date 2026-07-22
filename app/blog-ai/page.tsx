"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Bot, CheckCircle2, Clipboard, Coins, Download, FileText, Loader2,
  RotateCcw, Sparkles, WalletCards
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { getPointBalance } from "@/lib/points";

type History = {
  id:number; main_keyword:string; sub_keyword:string|null; body:string; char_count:number;
  retry_count:number; reached_target:boolean; point_cost:number; created_at:string;
};
type Generated = { body:string; char_count:number; retry_count:number; reached_target:boolean; balance:number; cost:number; elapsed_ms:number };

const toneOptions=[
  {value:"haeyo",label:"했어요체",desc:"친근한 존댓말"},
  {value:"hapnida",label:"합니다체",desc:"정중한 존댓말"},
  {value:"hada",label:"했다체",desc:"평서·기사체"},
  {value:"mix",label:"혼합체",desc:"해요체와 자연스러운 구어체"},
];

export default function BlogAiPage(){
  const router=useRouter();
  const[loading,setLoading]=useState(true); const[generating,setGenerating]=useState(false);
  const[balance,setBalance]=useState(0); const[history,setHistory]=useState<History[]>([]);
  const[mainKeyword,setMainKeyword]=useState(""); const[subKeyword,setSubKeyword]=useState("");
  const[mainRepeat,setMainRepeat]=useState(6); const[targetChars,setTargetChars]=useState(2000);
  const[paragraphCount,setParagraphCount]=useState(7); const[tone,setTone]=useState("haeyo");
  const[style,setStyle]=useState("narrative"); const[guide,setGuide]=useState("");
  const[status,setStatus]=useState(""); const[elapsed,setElapsed]=useState(0); const[error,setError]=useState("");
  const[result,setResult]=useState<Generated|null>(null); const[copied,setCopied]=useState(false);
  const canGenerate=balance>=1000&&mainKeyword.trim().length>0&&!generating;

  useEffect(()=>{const supabase=getSupabaseBrowserClient();if(!supabase){setLoading(false);return;}(async()=>{
    const{data}=await supabase.auth.getUser();if(!data.user){router.replace("/");return;}
    await supabase.rpc("ensure_my_profile");
    try{setBalance(await getPointBalance(supabase,data.user.id));}catch{}
    const{data:h}=await supabase.from("blog_ai_generations").select("id,main_keyword,sub_keyword,body,char_count,retry_count,reached_target,point_cost,created_at").eq("user_id",data.user.id).order("created_at",{ascending:false}).limit(8);
    setHistory((h??[]) as History[]);setLoading(false);
  })();},[router]);

  const charGuide=useMemo(()=>`${targetChars.toLocaleString()}자 · ${paragraphCount}문단 · 메인 키워드 ${mainRepeat}회`,[targetChars,paragraphCount,mainRepeat]);

  async function generate(){
    if(!canGenerate)return;
    const supabase=getSupabaseBrowserClient();if(!supabase)return;
    setGenerating(true);setError("");setResult(null);setStatus("생성 요청을 준비하고 있습니다.");setElapsed(0);
    try{
      const{data:sessionData}=await supabase.auth.getSession();const token=sessionData.session?.access_token;
      if(!token)throw new Error("로그인이 필요합니다.");
      const response=await fetch("/api/blog-ai/generate",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({requestId:crypto.randomUUID(),mainKeyword,subKeyword,mainRepeat,targetChars,paragraphCount,tone,style,guide})});
      if(!response.ok||!response.body)throw new Error("원고 생성 서버에 연결하지 못했습니다.");
      const reader=response.body.getReader();const decoder=new TextDecoder();let buffer="";
      while(true){const{done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const chunks=buffer.split("\n\n");buffer=chunks.pop()??"";
        for(const chunk of chunks){const lines=chunk.split("\n");const eventName=lines.find(l=>l.startsWith("event:"))?.slice(6).trim();const dataLine=lines.find(l=>l.startsWith("data:"))?.slice(5).trim();if(!eventName||!dataLine)continue;const payload=JSON.parse(dataLine);
          if(eventName==="status"){setStatus(payload.message||"원고를 생성하고 있습니다.");setElapsed(Number(payload.elapsed||0));}
          if(eventName==="insufficient"){setBalance(Number(payload.balance||0));throw new Error(payload.message||"보유 포인트가 부족합니다.");}
          if(eventName==="error")throw new Error(payload.message||"원고 생성 중 오류가 발생했습니다.");
          if(eventName==="complete"){const completed=payload as Generated;setResult(completed);setBalance(completed.balance);setStatus("원고 생성이 완료되었습니다.");
            const{data:h}=await supabase.from("blog_ai_generations").select("id,main_keyword,sub_keyword,body,char_count,retry_count,reached_target,point_cost,created_at").order("created_at",{ascending:false}).limit(8);setHistory((h??[]) as History[]);}
        }
      }
    }catch(e){setError(e instanceof Error?e.message:"원고 생성 중 오류가 발생했습니다.");}
    finally{setGenerating(false);}
  }
  async function copyBody(){if(!result?.body)return;await navigator.clipboard.writeText(result.body);setCopied(true);setTimeout(()=>setCopied(false),1800);}
  function downloadBody(){if(!result?.body)return;const blob=new Blob([result.body],{type:"text/plain;charset=utf-8"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download=`${mainKeyword||"블로그원고"}.txt`;a.click();URL.revokeObjectURL(url);}
  function loadHistory(item:History){setMainKeyword(item.main_keyword);setSubKeyword(item.sub_keyword||"");setResult({body:item.body,char_count:item.char_count,retry_count:item.retry_count,reached_target:item.reached_target,balance,cost:item.point_cost,elapsed_ms:0});window.scrollTo({top:0,behavior:"smooth"});}
  if(loading)return <main className="loading-screen"><Loader2 className="spin" size={32}/><span>블로그 AI 글쓰기 화면을 불러오고 있습니다.</span></main>;

  return <main className="blog-ai-page">
    <header className="blog-ai-header"><button onClick={()=>router.push("/dashboard")}><ArrowLeft size={19}/>대시보드</button><div className="blog-ai-balance"><WalletCards size={18}/><span>보유 포인트</span><strong>{balance.toLocaleString()}P</strong></div></header>
    <section className="blog-ai-hero"><span><Sparkles size={15}/> MOSTAD BLOG AI</span><h1>블로그 AI 글쓰기</h1><p>키워드와 원하는 조건을 입력하면 목표 글자수와 반복 횟수에 맞춘 블로그 원고를 자동으로 작성합니다.</p><div><Coins size={18}/><strong>원고 1편당 1,000P</strong><em>생성 성공 후에만 차감</em></div></section>
    <div className="blog-ai-layout">
      <section className="blog-ai-form-card">
        <div className="blog-ai-section-title"><span>01</span><div><h2>원고 조건 설정</h2><p>메인 키워드는 필수이며 나머지는 원하는 방식으로 조절할 수 있습니다.</p></div></div>
        <div className="blog-ai-form-grid"><label><span>메인 키워드 <b>필수</b></span><input value={mainKeyword} onChange={e=>setMainKeyword(e.target.value)} placeholder="예: 강남 공유오피스" maxLength={100}/></label><label><span>서브 키워드</span><input value={subKeyword} onChange={e=>setSubKeyword(e.target.value)} placeholder="예: 잠실 공유오피스, 송파 소호사무실" maxLength={500}/></label></div>
        <div className="blog-ai-range-grid"><label><span>목표 글자수 <strong>{targetChars.toLocaleString()}자</strong></span><input type="range" min="500" max="5000" step="100" value={targetChars} onChange={e=>setTargetChars(Number(e.target.value))}/></label><label><span>문단 수 <strong>{paragraphCount}개</strong></span><input type="range" min="2" max="15" value={paragraphCount} onChange={e=>setParagraphCount(Number(e.target.value))}/></label><label><span>메인 키워드 반복 <strong>{mainRepeat}회</strong></span><input type="range" min="1" max="20" value={mainRepeat} onChange={e=>setMainRepeat(Number(e.target.value))}/></label></div>
        <div className="blog-ai-form-grid"><label><span>어조</span><select value={tone} onChange={e=>setTone(e.target.value)}>{toneOptions.map(o=><option key={o.value} value={o.value}>{o.label} · {o.desc}</option>)}</select></label><label><span>글 스타일</span><select value={style} onChange={e=>setStyle(e.target.value)}><option value="narrative">서술형 · 자연스러운 줄글</option><option value="quote">인용구 포함 · 강조 문구 2~3회</option></select></label></div>
        <label className="blog-ai-guide"><span>추가 가이드</span><textarea value={guide} onChange={e=>setGuide(e.target.value)} placeholder="반드시 포함할 내용, 피해야 할 표현, 업체 특징, 원하는 구성 등을 입력해 주세요." maxLength={5000}/></label>
        <div className="blog-ai-order-summary"><div><FileText size={20}/><span>생성 조건</span><strong>{charGuide}</strong></div><div><Coins size={20}/><span>차감 포인트</span><strong>1,000P</strong></div></div>
        {balance<1000&&<div className="blog-ai-warning">보유 포인트가 부족합니다. 포인트 충전 후 원고를 생성할 수 있습니다.<button onClick={()=>router.push("/points")}>포인트 충전</button></div>}
        {error&&<div className="blog-ai-error">{error}</div>}
        <button className="blog-ai-generate" disabled={!canGenerate} onClick={generate}>{generating?<><Loader2 className="spin" size={20}/>{status||"원고 생성 중..."}</>:<><Bot size={20}/>1,000P로 원고 생성하기</>}</button>
        {generating&&<div className="blog-ai-progress"><div><i/><i/><i/></div><strong>{status}</strong><span>{elapsed>0?`${elapsed}초 경과 · `:""}창을 닫지 말고 잠시 기다려 주세요.</span></div>}
      </section>
      <aside className="blog-ai-history"><div className="blog-ai-section-title compact"><span>02</span><div><h2>최근 생성 원고</h2><p>최근 8개의 원고를 다시 열 수 있습니다.</p></div></div>{history.length?history.map(h=><button key={h.id} onClick={()=>loadHistory(h)}><div><strong>{h.main_keyword}</strong><span>{new Intl.DateTimeFormat("ko-KR",{dateStyle:"medium"}).format(new Date(h.created_at))}</span></div><small>{h.char_count.toLocaleString()}자 · {h.point_cost.toLocaleString()}P</small></button>):<div className="blog-ai-history-empty">아직 생성한 원고가 없습니다.</div>}</aside>
    </div>
    {result&&<section className="blog-ai-result"><div className="blog-ai-result-head"><div><span><CheckCircle2 size={17}/>생성 완료</span><h2>{mainKeyword} 원고</h2><p>공백 제외 {result.char_count.toLocaleString()}자 · 자동 보완 {result.retry_count}회 · {result.reached_target?"목표 분량 도달":"목표 분량 근접"}</p></div><div><button onClick={copyBody}><Clipboard size={17}/>{copied?"복사 완료":"전체 복사"}</button><button onClick={downloadBody}><Download size={17}/>TXT 저장</button><button onClick={()=>{setResult(null);setError("");}}><RotateCcw size={17}/>새 원고</button></div></div><article className="blog-ai-output">{result.body}</article></section>}
  </main>;
}
