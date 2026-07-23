import { NextRequest } from "next/server";
export const runtime="edge";
export const maxDuration=180;
const BASE="https://place.bidamgil.com";
const COST=250;
const evt=(name:string,data:unknown)=>`event: ${name}\ndata: ${JSON.stringify(data)}\n\n`;
const txt=(v:unknown,max:number)=>typeof v==="string"?v.trim().slice(0,max):"";
export async function POST(request:NextRequest){
 const encoder=new TextEncoder();
 const stream=new ReadableStream<Uint8Array>({start(controller){let closed=false;const send=(n:string,d:unknown)=>{if(!closed)controller.enqueue(encoder.encode(evt(n,d)))};const finish=()=>{if(!closed){closed=true;controller.close()}};
 void(async()=>{try{
  const auth=request.headers.get("authorization")||""; const token=auth.startsWith("Bearer ")?auth.slice(7):""; if(!token)throw new Error("로그인이 필요합니다.");
  const supabaseUrl=process.env.NEXT_PUBLIC_SUPABASE_URL, anon=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, service=process.env.SUPABASE_SERVICE_ROLE_KEY;
  const apiKey=process.env.BLOG_AI_API_KEY||process.env.PLACE_DIAG_API_KEY; if(!supabaseUrl||!anon||!service||!apiKey)throw new Error("서버 환경변수가 설정되지 않았습니다.");
  const ur=await fetch(`${supabaseUrl}/auth/v1/user`,{headers:{apikey:anon,Authorization:`Bearer ${token}`},cache:"no-store"}); if(!ur.ok)throw new Error("로그인 정보가 만료되었습니다."); const user=await ur.json() as {id?:string}; if(!user.id)throw new Error("회원 정보를 확인하지 못했습니다.");
  const input=await request.json().catch(()=>null) as {seedKeyword?:unknown;requestId?:unknown}|null; const seed=txt(input?.seedKeyword,100), requestId=txt(input?.requestId,80); if(!seed)throw new Error("분석할 키워드를 입력해 주세요."); if(!requestId)throw new Error("요청번호가 없습니다.");
  const pr=await fetch(`${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=point_balance,account_status`,{headers:{apikey:service,Authorization:`Bearer ${service}`},cache:"no-store"}); const profiles=await pr.json() as Array<{point_balance?:number;account_status?:string}>; const profile=profiles[0]; if(!profile||profile.account_status!=="active")throw new Error("현재 이용할 수 없는 계정입니다."); if(Number(profile.point_balance||0)<COST){send("insufficient",{message:"포인트가 부족합니다.",required:COST,balance:Number(profile.point_balance||0)});finish();return;}
  send("status",{message:"키워드 분석 작업을 시작하고 있습니다.",elapsed:0});
  const start=await fetch(`${BASE}/api/keyword-analyze-async`,{method:"POST",headers:{"Content-Type":"application/json","X-API-Key":apiKey},body:JSON.stringify({seed_keyword:seed}),cache:"no-store"}); const startData=await start.json().catch(()=>({})) as Record<string,unknown>; if(!start.ok||typeof startData.job_id!=="string")throw new Error(typeof startData.detail==="string"?startData.detail:`분석 시작 실패 (${start.status})`);
  const jobId=startData.job_id; const began=Date.now(); const deadline=began+170000; let result:Record<string,unknown>|null=null;
  while(Date.now()<deadline){await new Promise(r=>setTimeout(r,4000)); const jr=await fetch(`${BASE}/api/job/${encodeURIComponent(jobId)}`,{headers:{"X-API-Key":apiKey},cache:"no-store"}); const job=await jr.json().catch(()=>({})) as Record<string,unknown>; if(!jr.ok)throw new Error(typeof job.detail==="string"?job.detail:`상태 조회 실패 (${jr.status})`); send("status",{message:typeof job.progress==="string"?job.progress:"검색량과 경쟁률을 분석하고 있습니다.",elapsed:Number(job.elapsed_seconds||Math.floor((Date.now()-began)/1000))}); if(job.status==="done"){result=job.result&&typeof job.result==="object"?job.result as Record<string,unknown>:null;break;} if(job.status==="failed")throw new Error(typeof job.error==="string"?job.error:"키워드 분석에 실패했습니다.");}
  if(!result)throw new Error("분석 시간이 초과되었습니다. 포인트는 차감되지 않았습니다.");
  const rr=await fetch(`${supabaseUrl}/rest/v1/rpc/complete_keyword_analysis`,{method:"POST",headers:{apikey:service,Authorization:`Bearer ${service}`,"Content-Type":"application/json"},body:JSON.stringify({p_user_id:user.id,p_request_id:requestId,p_seed_keyword:seed,p_result:result})}); const done=await rr.json().catch(()=>({})) as Record<string,unknown>; if(!rr.ok)throw new Error(typeof done.message==="string"?done.message:"포인트 차감 중 오류가 발생했습니다.");
  send("complete",{result,balance:Number(done.balance||0),cost:COST});finish();
 }catch(e){send("error",{message:e instanceof Error?e.message:"키워드 분석 중 오류가 발생했습니다."});finish();}})();}});
 return new Response(stream,{headers:{"Content-Type":"text/event-stream; charset=utf-8","Cache-Control":"no-cache, no-transform","X-Accel-Buffering":"no"}});
}
