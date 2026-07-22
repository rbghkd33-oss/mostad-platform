"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle, ArrowDownCircle, ArrowUpCircle, BadgeCheck, BriefcaseBusiness,
  ChevronRight, CircleDollarSign, CreditCard, LayoutDashboard, Loader2, LogOut,
  Search, ShieldCheck, Sparkles, UserCog, UserRoundCog, Users, X,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type Role = "user" | "staff" | "admin" | "super_admin";
type Member = {
  id: string; email: string | null; manager_name: string | null; company_name: string | null;
  phone: string | null; point_balance: number; role: Role;
  account_status: "active" | "suspended"; admin_note: string | null; created_at: string;
};
type Payment = { id:number; order_no:string; amount:number; point_amount:number; status:string; payment_method:string|null; pg_provider:string; created_at:string; user_id:string; };
type WorkOrder = { id:number; customer_id:string; product_name:string; product_category:string; work_type:string; status:string; assigned_staff_id:string|null; result_url:string|null; created_at:string; };

const roleLabel: Record<Role,string> = { user:"일반 회원", staff:"직원", admin:"관리자", super_admin:"최고관리자" };
const statusLabel: Record<string,string> = { pending:"결제 대기", approved:"결제 승인", point_granted:"포인트 지급 완료", failed:"결제 실패", canceled:"결제 취소", partial_canceled:"부분 취소", refunded:"전액 환불" };
const workStatusLabel: Record<string,string> = { received:"접수", assigned:"직원 배정", in_progress:"진행 중", review_requested:"검수 요청", revision:"수정 요청", completed:"완료", canceled:"취소" };

export default function AdminPage() {
  const router = useRouter();
  const [loading,setLoading]=useState(true);
  const [authorized,setAuthorized]=useState(false);
  const [currentRole,setCurrentRole]=useState<Role>("user");
  const [members,setMembers]=useState<Member[]>([]);
  const [payments,setPayments]=useState<Payment[]>([]);
  const [works,setWorks]=useState<WorkOrder[]>([]);
  const [query,setQuery]=useState("");
  const [tab,setTab]=useState<"members"|"staff"|"works"|"payments">("members");
  const [selected,setSelected]=useState<Member|null>(null);
  const [amount,setAmount]=useState("");
  const [reason,setReason]=useState("");
  const [note,setNote]=useState("");
  const [actionLoading,setActionLoading]=useState(false);
  const [message,setMessage]=useState("");

  async function loadData(){
    const supabase=getSupabaseBrowserClient(); if(!supabase)return;
    const [m,p,w]=await Promise.all([
      supabase.from("profiles").select("id,email,manager_name,company_name,phone,point_balance,role,account_status,admin_note,created_at").order("created_at",{ascending:false}),
      supabase.from("payment_orders").select("id,order_no,user_id,amount,point_amount,status,payment_method,pg_provider,created_at").order("created_at",{ascending:false}).limit(100),
      supabase.from("marketing_work_orders").select("id,customer_id,product_name,product_category,work_type,status,assigned_staff_id,result_url,created_at").order("created_at",{ascending:false}).limit(100),
    ]);
    if(m.error) throw m.error;
    setMembers((m.data??[]) as Member[]); setPayments((p.data??[]) as Payment[]); setWorks((w.data??[]) as WorkOrder[]);
  }

  useEffect(()=>{ const supabase=getSupabaseBrowserClient(); if(!supabase){setLoading(false);return;}
    (async()=>{ const {data:a}=await supabase.auth.getUser(); if(!a.user){router.replace("/");return;}
      const {data:profile}=await supabase.from("profiles").select("role,account_status").eq("id",a.user.id).single();
      const role=(profile?.role??"user") as Role; setCurrentRole(role);
      if(!["admin","super_admin"].includes(role)||profile?.account_status!=="active"){setLoading(false);return;}
      setAuthorized(true); try{await loadData();}catch(e){setMessage(e instanceof Error?e.message:"관리자 데이터를 불러오지 못했습니다.");} setLoading(false);
    })(); },[router]);

  const filtered=useMemo(()=>{ const k=query.trim().toLowerCase(); const base=tab==="staff"?members.filter(m=>m.role!=="user"):members; if(!k)return base;
    return base.filter(m=>[m.email,m.manager_name,m.company_name,m.phone,roleLabel[m.role]].filter(Boolean).some(v=>String(v).toLowerCase().includes(k))); },[members,query,tab]);
  const staffMembers=members.filter(m=>m.role==="staff"&&m.account_status==="active");

  function openMember(m:Member){setSelected(m);setNote(m.admin_note??"");setAmount("");setReason("");setMessage("");}
  async function adjustPoints(direction:"add"|"subtract"){
    const n=Number(amount.replace(/,/g,"")); if(!selected||!Number.isInteger(n)||n<=0||!reason.trim()){setMessage("포인트와 처리 사유를 입력해 주세요.");return;}
    const supabase=getSupabaseBrowserClient(); if(!supabase)return; setActionLoading(true);
    const {data,error}=await supabase.rpc("admin_adjust_points",{p_user_id:selected.id,p_amount:n,p_direction:direction,p_reason:reason.trim()}); setActionLoading(false);
    if(error){setMessage(error.message);return;} const balance=Number(data); const updated={...selected,point_balance:balance}; setSelected(updated); setMembers(x=>x.map(i=>i.id===updated.id?updated:i)); setAmount("");setReason("");setMessage("포인트 처리가 완료되었습니다.");
  }
  async function saveMember(){ if(!selected)return; const supabase=getSupabaseBrowserClient(); if(!supabase)return; setActionLoading(true);
    const {error}=await supabase.rpc("admin_update_member",{p_user_id:selected.id,p_status:selected.account_status,p_note:note}); setActionLoading(false);
    if(error){setMessage(error.message);return;} const updated={...selected,admin_note:note};setSelected(updated);setMembers(x=>x.map(i=>i.id===updated.id?updated:i));setMessage("회원 정보를 저장했습니다."); }
  async function changeRole(member:Member,role:Role){
    if(currentRole!=="super_admin"){setMessage("최고관리자만 권한을 변경할 수 있습니다.");return;}
    const supabase=getSupabaseBrowserClient(); if(!supabase)return; setActionLoading(true);
    const {error}=await supabase.rpc("super_admin_set_role",{p_user_id:member.id,p_role:role}); setActionLoading(false);
    if(error){setMessage(error.message);return;} setMembers(x=>x.map(i=>i.id===member.id?{...i,role}:i)); if(selected?.id===member.id)setSelected({...selected,role}); setMessage(`${member.email} 권한을 ${roleLabel[role]}으로 변경했습니다.`);
  }
  async function assignWork(work:WorkOrder,staffId:string){ const supabase=getSupabaseBrowserClient();if(!supabase)return;
    const {error}=await supabase.rpc("admin_assign_work",{p_work_id:work.id,p_staff_id:staffId}); if(error){setMessage(error.message);return;}
    setWorks(x=>x.map(i=>i.id===work.id?{...i,assigned_staff_id:staffId,status:"assigned"}:i)); setMessage("직원 배정을 완료했습니다."); }
  async function reviewWork(work:WorkOrder,approve:boolean){ const supabase=getSupabaseBrowserClient();if(!supabase)return;
    const {error}=await supabase.rpc("admin_review_work",{p_work_id:work.id,p_approve:approve,p_note:approve?"":"결과를 보완해 주세요."}); if(error){setMessage(error.message);return;}
    setWorks(x=>x.map(i=>i.id===work.id?{...i,status:approve?"completed":"revision"}:i)); setMessage(approve?"검수 승인 및 고객 공개 완료":"직원에게 수정 요청했습니다."); }
  async function logout(){const s=getSupabaseBrowserClient();await s?.auth.signOut();router.replace("/");}

  if(loading)return <main className="loading-screen"><Loader2 className="spin" size={32}/><span>관리자 페이지를 불러오고 있습니다.</span></main>;
  if(!authorized)return <main className="admin-denied"><ShieldCheck size={46}/><h1>관리자 권한이 필요합니다.</h1><p>관리자 또는 최고관리자 계정만 접근할 수 있습니다.</p><button onClick={()=>router.replace("/dashboard")}>대시보드로 돌아가기</button></main>;

  return <main className="admin-page">
    <aside className="admin-sidebar"><div className="admin-brand"><span><Sparkles size={20}/></span><div><strong>모스트애드</strong><small>{roleLabel[currentRole]}</small></div></div>
      <nav>
        <button className="active"><LayoutDashboard size={18}/>관리자 홈</button>
        <button onClick={()=>setTab("members")} className={tab==="members"?"active":""}><Users size={18}/>회원 관리</button>
        <button onClick={()=>setTab("staff")} className={tab==="staff"?"active":""}><UserCog size={18}/>직원·권한 관리</button>
        <button onClick={()=>setTab("works")} className={tab==="works"?"active":""}><BriefcaseBusiness size={18}/>업무 배정·검수</button>
        <button onClick={()=>router.push("/admin/work-create")}><UserRoundCog size={18}/>새 업무 등록</button>
        <button onClick={()=>router.push("/admin/work-calendar")}><Sparkles size={18}/>작업 캘린더</button>
        <button onClick={()=>setTab("payments")} className={tab==="payments"?"active":""}><CreditCard size={18}/>PG 결제 관리</button>
      </nav><button className="admin-logout" onClick={logout}><LogOut size={17}/>로그아웃</button>
    </aside>
    <section className="admin-workspace">
      <header className="admin-header"><div><span>MOSTAD MANAGEMENT</span><h1>관리자 페이지</h1></div><button onClick={()=>router.push("/dashboard")}>사용자 화면 <ChevronRight size={17}/></button></header>
      {message&&<div className="admin-global-message"><AlertCircle size={17}/>{message}</div>}
      <section className="admin-stat-grid">
        <article><span className="admin-stat-icon purple"><Users size={20}/></span><div><small>전체 회원</small><strong>{members.length}<em>명</em></strong></div></article>
        <article><span className="admin-stat-icon blue"><BadgeCheck size={20}/></span><div><small>직원·관리자</small><strong>{members.filter(m=>m.role!=="user").length}<em>명</em></strong></div></article>
        <article><span className="admin-stat-icon green"><CircleDollarSign size={20}/></span><div><small>회원 보유 포인트</small><strong>{members.reduce((s,m)=>s+Number(m.point_balance||0),0).toLocaleString()}<em>P</em></strong></div></article>
        <article><span className="admin-stat-icon orange"><BriefcaseBusiness size={20}/></span><div><small>진행 업무</small><strong>{works.filter(w=>!["completed","canceled"].includes(w.status)).length}<em>건</em></strong></div></article>
      </section>

      {(tab==="members"||tab==="staff")&&<section className="admin-panel"><div className="admin-panel-heading"><div><h2>{tab==="members"?"회원 관리":"직원·권한 관리"}</h2><p>{tab==="staff"?"최고관리자가 가입 회원에게 직원·관리자 권한을 부여합니다.":"회원 정보와 포인트, 이용 상태를 관리합니다."}</p></div><label className="admin-search"><Search size={17}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="이메일·업체명·담당자 검색"/></label></div>
        {tab==="staff"&&currentRole!=="super_admin"&&<div className="admin-global-message"><AlertCircle size={17}/>권한 조회는 가능하지만 변경은 최고관리자만 할 수 있습니다.</div>}
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>회원</th><th>업체명</th><th>연락처</th><th>권한</th><th>포인트</th><th>상태</th><th/></tr></thead><tbody>
          {filtered.map(m=><tr key={m.id}><td><div className="member-cell"><span>{(m.manager_name||m.email||"M").slice(0,1)}</span><div><strong>{m.manager_name||"이름 미등록"}</strong><small>{m.email}</small></div></div></td><td>{m.company_name||"-"}</td><td>{m.phone||"-"}</td><td><span className={`role-badge ${m.role}`}>{roleLabel[m.role]}</span></td><td><b>{Number(m.point_balance).toLocaleString()}P</b></td><td><span className={`admin-status ${m.account_status}`}>{m.account_status==="active"?"정상":"정지"}</span></td><td><button className="admin-detail-button" onClick={()=>openMember(m)}>상세 관리</button></td></tr>)}
        </tbody></table></div></section>}

      {tab==="works"&&<section className="admin-panel"><div className="admin-panel-heading"><div><h2>업무 배정·검수</h2><p>수동형·혼합형 마케팅 업무를 직원에게 배정하고 결과를 검수합니다.</p></div></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>상품</th><th>신청 회원</th><th>유형</th><th>상태</th><th>담당 직원</th><th>결과</th><th>처리</th></tr></thead><tbody>
        {works.length?works.map(w=><tr key={w.id}><td><b>{w.product_name}</b><small className="table-subtext">{w.product_category}</small></td><td>{members.find(m=>m.id===w.customer_id)?.company_name||members.find(m=>m.id===w.customer_id)?.email||"-"}</td><td>{w.work_type}</td><td>{workStatusLabel[w.status]||w.status}</td><td><select value={w.assigned_staff_id||""} onChange={e=>e.target.value&&assignWork(w,e.target.value)}><option value="">직원 선택</option>{staffMembers.map(s=><option key={s.id} value={s.id}>{s.manager_name||s.email}</option>)}</select></td><td>{w.result_url?<a href={w.result_url} target="_blank" rel="noreferrer">결과 링크</a>:"-"}</td><td>{w.status==="review_requested"?<div className="table-action-group"><button onClick={()=>reviewWork(w,true)}>승인</button><button className="danger" onClick={()=>reviewWork(w,false)}>수정</button></div>:"-"}</td></tr>):<tr><td colSpan={7} className="admin-empty">아직 접수된 수동 업무가 없습니다.</td></tr>}
      </tbody></table></div></section>}

      {tab==="payments"&&<section className="admin-panel"><div className="admin-panel-heading"><div><h2>PG 결제 관리</h2><p>루시페이먼츠 승인·취소·환불 내역을 확인합니다.</p></div></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>주문번호</th><th>회원</th><th>결제금액</th><th>지급 포인트</th><th>결제수단</th><th>상태</th><th>요청일</th></tr></thead><tbody>
        {payments.length?payments.map(p=><tr key={p.id}><td><b>{p.order_no}</b></td><td>{members.find(m=>m.id===p.user_id)?.company_name||members.find(m=>m.id===p.user_id)?.email||"-"}</td><td>{Number(p.amount).toLocaleString()}원</td><td>{Number(p.point_amount).toLocaleString()}P</td><td>{p.payment_method||"-"}</td><td>{statusLabel[p.status]||p.status}</td><td>{new Date(p.created_at).toLocaleString("ko-KR")}</td></tr>):<tr><td colSpan={7} className="admin-empty">결제 내역이 없습니다.</td></tr>}
      </tbody></table></div></section>}
    </section>

    {selected&&<div className="admin-modal-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setSelected(null)}><section className="admin-member-modal"><button className="admin-modal-close" onClick={()=>setSelected(null)}><X size={20}/></button><div className="admin-modal-title"><span><UserRoundCog size={22}/></span><div><h2>회원 상세 관리</h2><p>{selected.email}</p></div></div>
      <div className="admin-member-summary"><div><small>담당자</small><strong>{selected.manager_name||"-"}</strong></div><div><small>업체명</small><strong>{selected.company_name||"-"}</strong></div><div><small>연락처</small><strong>{selected.phone||"-"}</strong></div><div><small>현재 포인트</small><strong>{Number(selected.point_balance).toLocaleString()}P</strong></div></div>
      {currentRole==="super_admin"&&selected.role!=="super_admin"&&<div className="admin-form-section"><h3>계정 권한</h3><select value={selected.role} onChange={e=>changeRole(selected,e.target.value as Role)} disabled={actionLoading}><option value="user">일반 회원</option><option value="staff">직원</option><option value="admin">관리자</option></select><p className="form-help">직원은 본인에게 배정된 업무만 확인하고 결과 링크를 등록할 수 있습니다.</p></div>}
      <div className="admin-form-section"><h3>포인트 지급·차감</h3><div className="admin-form-row"><input value={amount} onChange={e=>setAmount(e.target.value.replace(/[^0-9]/g,""))} placeholder="포인트 입력"/><input value={reason} onChange={e=>setReason(e.target.value)} placeholder="처리 사유 입력"/></div><div className="admin-point-actions"><button onClick={()=>adjustPoints("add")} disabled={actionLoading}><ArrowUpCircle size={17}/>포인트 지급</button><button className="subtract" onClick={()=>adjustPoints("subtract")} disabled={actionLoading}><ArrowDownCircle size={17}/>포인트 차감</button></div></div>
      <div className="admin-form-section"><h3>회원 상태 및 관리자 메모</h3><select value={selected.account_status} onChange={e=>setSelected({...selected,account_status:e.target.value as Member["account_status"]})}><option value="active">정상 이용</option><option value="suspended">이용 정지</option></select><textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="관리자만 확인할 수 있는 메모"/><button className="admin-save-button" onClick={saveMember} disabled={actionLoading}>변경사항 저장</button></div>
      {message&&<div className="admin-modal-message">{message}</div>}
    </section></div>}
  </main>;
}
