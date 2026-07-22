"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowDownCircle,
  ArrowUpCircle,
  BadgeCheck,
  ChevronRight,
  CircleDollarSign,
  CreditCard,
  History,
  LayoutDashboard,
  Loader2,
  LogOut,
  Search,
  ShieldCheck,
  Sparkles,
  UserRoundCog,
  Users,
  X,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type Member = {
  id: string;
  email: string | null;
  manager_name: string | null;
  company_name: string | null;
  phone: string | null;
  point_balance: number;
  role: "user" | "admin";
  account_status: "active" | "suspended";
  admin_note: string | null;
  created_at: string;
};

type Payment = {
  id: number;
  order_no: string;
  amount: number;
  point_amount: number;
  status: string;
  payment_method: string | null;
  pg_provider: string;
  created_at: string;
  user_id: string;
};

const statusLabel: Record<string, string> = {
  pending: "결제 대기",
  approved: "결제 승인",
  point_granted: "포인트 지급 완료",
  failed: "결제 실패",
  canceled: "결제 취소",
  partial_canceled: "부분 취소",
  refunded: "전액 환불",
};

export default function AdminPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"members" | "payments">("members");
  const [selected, setSelected] = useState<Member | null>(null);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function loadData() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    const [{ data: memberData, error: memberError }, { data: paymentData }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,email,manager_name,company_name,phone,point_balance,role,account_status,admin_note,created_at")
        .order("created_at", { ascending: false }),
      supabase
        .from("payment_orders")
        .select("id,order_no,user_id,amount,point_amount,status,payment_method,pg_provider,created_at")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    if (memberError) throw memberError;
    setMembers((memberData ?? []) as Member[]);
    setPayments((paymentData ?? []) as unknown as Payment[]);
  }

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    (async () => {
      const { data: authData } = await supabase.auth.getUser();
      if (!authData.user) {
        router.replace("/");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role,account_status")
        .eq("id", authData.user.id)
        .single();

      if (profile?.role !== "admin" || profile?.account_status !== "active") {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      setAuthorized(true);
      try {
        await loadData();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "관리자 데이터를 불러오지 못했습니다.");
      }
      setLoading(false);
    })();
  }, [router]);

  const filteredMembers = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    if (!keyword) return members;
    return members.filter((member) =>
      [member.email, member.manager_name, member.company_name, member.phone]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(keyword)),
    );
  }, [members, query]);

  const totalPoints = members.reduce((sum, member) => sum + Number(member.point_balance || 0), 0);
  const approvedAmount = payments
    .filter((payment) => ["approved", "point_granted"].includes(payment.status))
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);

  function openMember(member: Member) {
    setSelected(member);
    setNote(member.admin_note ?? "");
    setAmount("");
    setReason("");
    setMessage("");
  }

  async function adjustPoints(direction: "add" | "subtract") {
    const numericAmount = Number(amount.replace(/,/g, ""));
    if (!selected || !Number.isInteger(numericAmount) || numericAmount <= 0 || !reason.trim()) {
      setMessage("포인트와 처리 사유를 정확히 입력해 주세요.");
      return;
    }
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;

    setActionLoading(true);
    setMessage("");
    const { data, error } = await supabase.rpc("admin_adjust_points", {
      p_user_id: selected.id,
      p_amount: numericAmount,
      p_direction: direction,
      p_reason: reason.trim(),
    });
    setActionLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    const nextBalance = Number(data);
    setSelected({ ...selected, point_balance: nextBalance });
    setMembers((list) => list.map((item) => item.id === selected.id ? { ...item, point_balance: nextBalance } : item));
    setAmount("");
    setReason("");
    setMessage(direction === "add" ? "포인트를 지급했습니다." : "포인트를 차감했습니다.");
  }

  async function saveMember() {
    if (!selected) return;
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setActionLoading(true);
    setMessage("");

    const { error } = await supabase.rpc("admin_update_member", {
      p_user_id: selected.id,
      p_status: selected.account_status,
      p_note: note,
    });
    setActionLoading(false);

    if (error) {
      setMessage(error.message);
      return;
    }
    const updated = { ...selected, admin_note: note };
    setSelected(updated);
    setMembers((list) => list.map((item) => item.id === selected.id ? updated : item));
    setMessage("회원 정보를 저장했습니다.");
  }

  async function logout() {
    const supabase = getSupabaseBrowserClient();
    await supabase?.auth.signOut();
    router.replace("/");
  }

  if (loading) {
    return <main className="loading-screen"><Loader2 className="spin" size={32} /><span>관리자 페이지를 불러오고 있습니다.</span></main>;
  }

  if (!authorized) {
    return (
      <main className="admin-denied">
        <ShieldCheck size={46} />
        <h1>관리자 권한이 필요합니다.</h1>
        <p>현재 계정은 관리자 페이지에 접근할 수 없습니다.</p>
        <button onClick={() => router.replace("/dashboard")}>대시보드로 돌아가기</button>
      </main>
    );
  }

  return (
    <main className="admin-page">
      <aside className="admin-sidebar">
        <div className="admin-brand"><span><Sparkles size={20} /></span><div><strong>모스트애드</strong><small>ADMIN CONSOLE</small></div></div>
        <nav>
          <button className="active"><LayoutDashboard size={18} />관리자 홈</button>
          <button onClick={() => setTab("members")} className={tab === "members" ? "active" : ""}><Users size={18} />회원 관리</button>
          <button onClick={() => setTab("payments")} className={tab === "payments" ? "active" : ""}><CreditCard size={18} />PG 결제 관리</button>
          <button disabled><History size={18} />관리자 로그</button>
        </nav>
        <button className="admin-logout" onClick={logout}><LogOut size={17} />로그아웃</button>
      </aside>

      <section className="admin-workspace">
        <header className="admin-header">
          <div><span>MOSTAD MANAGEMENT</span><h1>관리자 페이지</h1></div>
          <button onClick={() => router.push("/dashboard")}>사용자 화면 <ChevronRight size={17} /></button>
        </header>

        {message && !selected && <div className="admin-global-message"><AlertCircle size={17} />{message}</div>}

        <section className="admin-stat-grid">
          <article><span className="admin-stat-icon purple"><Users size={20} /></span><div><small>전체 회원</small><strong>{members.length}<em>명</em></strong></div></article>
          <article><span className="admin-stat-icon blue"><BadgeCheck size={20} /></span><div><small>활성 회원</small><strong>{members.filter((m) => m.account_status === "active").length}<em>명</em></strong></div></article>
          <article><span className="admin-stat-icon green"><CircleDollarSign size={20} /></span><div><small>회원 보유 포인트</small><strong>{totalPoints.toLocaleString()}<em>P</em></strong></div></article>
          <article><span className="admin-stat-icon orange"><CreditCard size={20} /></span><div><small>승인 결제금액</small><strong>{approvedAmount.toLocaleString()}<em>원</em></strong></div></article>
        </section>

        {tab === "members" ? (
          <section className="admin-panel">
            <div className="admin-panel-heading">
              <div><h2>회원 관리</h2><p>회원 정보와 포인트, 이용 상태를 관리합니다.</p></div>
              <label className="admin-search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="이메일·업체명·담당자 검색" /></label>
            </div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>회원</th><th>업체명</th><th>연락처</th><th>보유 포인트</th><th>상태</th><th>가입일</th><th /></tr></thead>
                <tbody>
                  {filteredMembers.map((member) => (
                    <tr key={member.id}>
                      <td><div className="member-cell"><span>{(member.manager_name || member.email || "M").slice(0,1)}</span><div><strong>{member.manager_name || "이름 미등록"}</strong><small>{member.email}</small></div></div></td>
                      <td>{member.company_name || "-"}</td>
                      <td>{member.phone || "-"}</td>
                      <td><b>{Number(member.point_balance).toLocaleString()}P</b></td>
                      <td><span className={`admin-status ${member.account_status}`}>{member.account_status === "active" ? "정상" : "이용 정지"}</span></td>
                      <td>{new Date(member.created_at).toLocaleDateString("ko-KR")}</td>
                      <td><button className="admin-detail-button" onClick={() => openMember(member)}>상세 관리</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : (
          <section className="admin-panel">
            <div className="admin-panel-heading"><div><h2>PG 결제 관리</h2><p>루시페이먼츠 연동 후 승인·취소·환불 결과가 자동으로 기록됩니다.</p></div></div>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>주문번호</th><th>회원</th><th>결제금액</th><th>지급 포인트</th><th>결제수단</th><th>상태</th><th>요청일</th></tr></thead>
                <tbody>
                  {payments.length ? payments.map((payment) => (
                    <tr key={payment.id}>
                      <td><b>{payment.order_no}</b></td>
                      <td>{members.find((member) => member.id === payment.user_id)?.company_name || members.find((member) => member.id === payment.user_id)?.email || "-"}</td>
                      <td>{Number(payment.amount).toLocaleString()}원</td>
                      <td>{Number(payment.point_amount).toLocaleString()}P</td>
                      <td>{payment.payment_method || "-"}</td>
                      <td><span className={`payment-status ${payment.status}`}>{statusLabel[payment.status] || payment.status}</span></td>
                      <td>{new Date(payment.created_at).toLocaleString("ko-KR")}</td>
                    </tr>
                  )) : <tr><td colSpan={7} className="admin-empty">아직 등록된 결제 내역이 없습니다. PG 연동 후 자동으로 표시됩니다.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </section>

      {selected && (
        <div className="admin-modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setSelected(null)}>
          <section className="admin-member-modal">
            <button className="admin-modal-close" onClick={() => setSelected(null)}><X size={20} /></button>
            <div className="admin-modal-title"><span><UserRoundCog size={22} /></span><div><h2>회원 상세 관리</h2><p>{selected.email}</p></div></div>

            <div className="admin-member-summary">
              <div><small>담당자</small><strong>{selected.manager_name || "-"}</strong></div>
              <div><small>업체명</small><strong>{selected.company_name || "-"}</strong></div>
              <div><small>연락처</small><strong>{selected.phone || "-"}</strong></div>
              <div><small>현재 포인트</small><strong>{Number(selected.point_balance).toLocaleString()}P</strong></div>
            </div>

            <div className="admin-form-section">
              <h3>포인트 지급·차감</h3>
              <div className="admin-form-row"><input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9]/g, ""))} placeholder="포인트 입력" /><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="처리 사유 입력" /></div>
              <div className="admin-point-actions">
                <button onClick={() => adjustPoints("add")} disabled={actionLoading}><ArrowUpCircle size={17} />포인트 지급</button>
                <button className="subtract" onClick={() => adjustPoints("subtract")} disabled={actionLoading}><ArrowDownCircle size={17} />포인트 차감</button>
              </div>
            </div>

            <div className="admin-form-section">
              <h3>회원 상태 및 관리자 메모</h3>
              <select value={selected.account_status} onChange={(e) => setSelected({ ...selected, account_status: e.target.value as Member["account_status"] })}>
                <option value="active">정상 이용</option><option value="suspended">이용 정지</option>
              </select>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="관리자만 확인할 수 있는 메모를 입력하세요." />
              <button className="admin-save-button" onClick={saveMember} disabled={actionLoading}>{actionLoading ? <Loader2 className="spin" size={17} /> : null}변경사항 저장</button>
            </div>
            {message && <div className="admin-modal-message">{message}</div>}
          </section>
        </div>
      )}
    </main>
  );
}
