"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight, ExternalLink, Filter, Loader2, X } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type Entry = {
  id: number;
  work_order_id: number;
  entry_date: string;
  entry_type: string;
  company_name: string | null;
  title: string | null;
  result_url: string | null;
  rank_value: number | null;
  note: string | null;
  registered_by: string;
  created_at: string;
};
type Work = { id: number; product_name: string; product_code: string | null; customer_id: string; customer_request: Record<string, unknown> | null };
type Profile = { id: string; email: string; manager_name: string | null; company_name: string | null; role: string };

type CalendarEntry = Entry & { work?: Work; staff?: Profile; customer?: Profile; displayCompany: string };

const weekdays = ["일", "월", "화", "수", "목", "금", "토"];

function monthLabel(value: string) {
  const [year, month] = value.split("-");
  return `${year}년 ${Number(month)}월`;
}

function moveMonth(value: string, amount: number) {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(year, month - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function buildCalendarDays(monthValue: string) {
  const [year, month] = monthValue.split("-").map(Number);
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const start = new Date(year, month - 1, 1 - first.getDay());
  const end = new Date(year, month - 1, last.getDate() + (6 - last.getDay()));
  const days: { date: string; day: number; currentMonth: boolean }[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const date = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
    days.push({ date, day: cursor.getDate(), currentMonth: cursor.getMonth() === month - 1 });
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export default function WorkCalendar() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [staffFilter, setStaffFilter] = useState("all");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [works, setWorks] = useState<Work[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    (async () => {
      const [{ data: entryData }, { data: workData }, { data: profileData }] = await Promise.all([
        supabase.from("marketing_work_entries").select("id,work_order_id,entry_date,entry_type,company_name,title,result_url,rank_value,note,registered_by,created_at").order("entry_date", { ascending: false }).limit(3000),
        supabase.from("marketing_work_orders").select("id,product_name,product_code,customer_id,customer_request"),
        supabase.from("profiles").select("id,email,manager_name,company_name,role"),
      ]);
      setEntries((entryData ?? []) as Entry[]);
      setWorks((workData ?? []) as Work[]);
      setProfiles((profileData ?? []) as Profile[]);
      setLoading(false);
    })();
  }, []);

  const staffMembers = useMemo(
    () => profiles.filter((profile) => ["staff", "admin", "super_admin"].includes(profile.role)).sort((a, b) => (a.manager_name || a.email).localeCompare(b.manager_name || b.email, "ko")),
    [profiles],
  );

  const enriched = useMemo<CalendarEntry[]>(() => entries.map((entry) => {
    const work = works.find((item) => item.id === entry.work_order_id);
    const staff = profiles.find((item) => item.id === entry.registered_by);
    const customer = profiles.find((item) => item.id === work?.customer_id);
    const requestCompany = typeof work?.customer_request?.company_name === "string" ? work.customer_request.company_name : "";
    return {
      ...entry,
      work,
      staff,
      customer,
      displayCompany: entry.company_name || requestCompany || customer?.company_name || customer?.manager_name || customer?.email || "업체명 미등록",
    };
  }), [entries, works, profiles]);

  const filtered = useMemo(
    () => enriched.filter((entry) => entry.entry_date.startsWith(month) && (staffFilter === "all" || entry.registered_by === staffFilter)),
    [enriched, month, staffFilter],
  );

  const grouped = useMemo(() => filtered.reduce((acc, entry) => {
    (acc[entry.entry_date] ??= []).push(entry);
    return acc;
  }, {} as Record<string, CalendarEntry[]>), [filtered]);

  const days = useMemo(() => buildCalendarDays(month), [month]);
  const selectedEntries = selectedDate ? (grouped[selectedDate] ?? []) : [];
  const monthlyCount = filtered.length;
  const activeStaffCount = new Set(filtered.map((entry) => entry.registered_by)).size;

  if (loading) return <main className="loading-screen"><Loader2 className="spin" /></main>;

  return <main className="admin-subpage calendar-page calendar-v20">
    <header className="calendar-main-header">
      <button onClick={() => router.push("/admin")}><ArrowLeft />관리자</button>
      <div><small>WORK HISTORY</small><h1>작업 캘린더</h1></div>
      <div className="calendar-head-actions">
        <label><Filter size={16}/><select value={staffFilter} onChange={(event) => setStaffFilter(event.target.value)}><option value="all">전체 직원</option>{staffMembers.map((staff) => <option value={staff.id} key={staff.id}>{staff.manager_name || staff.email}</option>)}</select></label>
      </div>
    </header>

    <section className="calendar-summary-bar">
      <div><span>선택 월 작업</span><strong>{monthlyCount}건</strong></div>
      <div><span>작업 등록 직원</span><strong>{activeStaffCount}명</strong></div>
      <p>날짜를 누르면 해당 일자의 전체 작업과 링크를 확인할 수 있습니다.</p>
    </section>

    <section className="real-calendar-card">
      <div className="real-calendar-toolbar">
        <button onClick={() => setMonth(moveMonth(month, -1))}><ChevronLeft /></button>
        <h2>{monthLabel(month)}</h2>
        <button onClick={() => setMonth(moveMonth(month, 1))}><ChevronRight /></button>
        <input type="month" value={month} onChange={(event) => setMonth(event.target.value)} />
      </div>
      <div className="calendar-weekdays">{weekdays.map((day) => <b key={day}>{day}</b>)}</div>
      <div className="calendar-month-grid">
        {days.map((day) => {
          const dayEntries = grouped[day.date] ?? [];
          const preview = dayEntries.slice(0, 3);
          return <button type="button" key={day.date} className={`calendar-day-cell ${day.currentMonth ? "" : "muted"} ${dayEntries.length ? "has-work" : ""}`} onClick={() => dayEntries.length && setSelectedDate(day.date)}>
            <span className="calendar-day-number">{day.day}</span>
            <div className="calendar-day-items">
              {preview.map((entry) => <span key={entry.id} title={`${entry.displayCompany} · ${entry.work?.product_name || "작업"}`}><i>{entry.staff?.manager_name?.slice(0, 2) || "직원"}</i><em>{entry.displayCompany}</em></span>)}
              {dayEntries.length > 3 && <strong>+{dayEntries.length - 3}건 더보기</strong>}
            </div>
            {dayEntries.length > 0 && <small>{dayEntries.length}건</small>}
          </button>;
        })}
      </div>
    </section>

    {selectedDate && <div className="admin-modal-backdrop calendar-day-modal-backdrop" onMouseDown={() => setSelectedDate(null)}>
      <section className="calendar-day-modal" onMouseDown={(event) => event.stopPropagation()}>
        <header><div><small>DAILY WORK</small><h2><CalendarDays />{selectedDate} 작업 내역</h2><p>총 {selectedEntries.length}건</p></div><button onClick={() => setSelectedDate(null)}><X /></button></header>
        <div className="calendar-day-detail-list">
          {selectedEntries.map((entry) => <article key={entry.id}>
            <div className="calendar-detail-top"><span>{entry.work?.product_name || "마케팅 작업"}</span><b>{entry.staff?.manager_name || entry.staff?.email || "직원"}</b></div>
            <h3>{entry.displayCompany}</h3>
            <div className="calendar-detail-meta"><span>{entry.entry_type === "post" ? (entry.title || "포스팅 등록") : `${entry.rank_value ?? "-"}위`}</span><time>{new Date(entry.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</time></div>
            {entry.note && <p>{entry.note}</p>}
            {entry.result_url && <a href={entry.result_url} target="_blank" rel="noreferrer"><ExternalLink size={15}/>등록 링크 열기</a>}
          </article>)}
        </div>
      </section>
    </div>}
  </main>;
}
