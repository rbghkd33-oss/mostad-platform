"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, Phone, UserRound } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export default function ProfileCompletePage() {
  const router = useRouter();
  const [managerName, setManagerName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState("");

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length < 4) return digits;
    if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  };

  useEffect(() => {
    async function loadProfile() {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) { setMessage("Supabase 연결 정보가 없습니다."); setChecking(false); return; }
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (!session) { router.replace("/"); return; }
      const { data: profile } = await supabase
        .from("profiles")
        .select("manager_name, company_name, phone")
        .eq("id", session.user.id)
        .maybeSingle();
      setManagerName(profile?.manager_name ?? "");
      setCompanyName(profile?.company_name ?? "");
      setPhone(profile?.phone ?? "");
      setChecking(false);
    }
    loadProfile();
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!managerName.trim() || !companyName.trim() || !phone.trim()) {
      setMessage("담당자명, 업체명, 연락처를 모두 입력해 주세요.");
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) { setMessage("Supabase 연결 정보가 없습니다."); return; }
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) { setMessage("로그인 정보가 만료되었습니다. 다시 로그인해 주세요."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/profile/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ managerName: managerName.trim(), companyName: companyName.trim(), phone: phone.trim() }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(result.error ?? "추가정보 저장에 실패했습니다."); return; }
      router.replace("/dashboard");
      router.refresh();
    } catch { setMessage("네트워크 오류가 발생했습니다."); }
    finally { setLoading(false); }
  }

  if (checking) return <main style={{minHeight:"100vh",display:"grid",placeItems:"center"}}><Loader2 className="spin" size={32}/></main>;

  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",background:"#f5f7fb",padding:24}}>
    <section style={{width:"min(520px, 100%)",background:"#fff",border:"1px solid #e5e7eb",borderRadius:20,padding:32,boxShadow:"0 18px 50px rgba(17,31,68,.08)"}}>
      <p style={{margin:"0 0 8px",color:"#6657ff",fontWeight:800}}>MOSTAD MEMBERSHIP</p>
      <h1 style={{margin:"0 0 10px",fontSize:28}}>추가정보 입력</h1>
      <p style={{margin:"0 0 26px",color:"#667085",lineHeight:1.6}}>카카오 회원가입을 완료하려면 서비스 이용에 필요한 정보를 입력해 주세요.</p>
      <form onSubmit={handleSubmit}>
        <label style={{display:"block",marginBottom:8,fontWeight:700}}>담당자명</label>
        <div style={fieldWrapStyle}><UserRound size={19}/><input value={managerName} onChange={e=>setManagerName(e.target.value)} placeholder="홍길동" style={inputStyle}/></div>
        <label style={{display:"block",margin:"18px 0 8px",fontWeight:700}}>업체명</label>
        <div style={fieldWrapStyle}><Building2 size={19}/><input value={companyName} onChange={e=>setCompanyName(e.target.value)} placeholder="업체명을 입력해 주세요" style={inputStyle}/></div>
        <label style={{display:"block",margin:"18px 0 8px",fontWeight:700}}>연락처</label>
        <div style={fieldWrapStyle}><Phone size={19}/><input value={phone} onChange={e=>setPhone(formatPhone(e.target.value))} placeholder="010-0000-0000" inputMode="numeric" style={inputStyle}/></div>
        {message && <div role="alert" style={{marginTop:18,padding:12,borderRadius:10,background:"#fff4f4",color:"#d92d20"}}>{message}</div>}
        <button type="submit" disabled={loading} style={{width:"100%",minHeight:52,marginTop:24,border:0,borderRadius:12,background:"#6657ff",color:"#fff",fontWeight:800,fontSize:16,cursor:loading?"default":"pointer",opacity:loading?.7:1}}>{loading?"저장 중...":"추가정보 저장하고 시작하기"}</button>
      </form>
    </section>
  </main>;
}
const fieldWrapStyle={minHeight:52,border:"1px solid #d9deea",borderRadius:12,display:"flex",alignItems:"center",gap:10,padding:"0 14px"} as const;
const inputStyle={width:"100%",border:0,outline:0,fontSize:15,background:"transparent"} as const;
