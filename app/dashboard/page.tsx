"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Bell,
  Bot,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Coins,
  CreditCard,
  FileText,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  Loader2,
  LogOut,
  Menu,
  MessageSquareText,
  Megaphone,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingUp,
  UserRound,
  WalletCards,
  X,
  Zap,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";
import { getPointBalance } from "@/lib/points";

const navItems = [
  { label: "대시보드", icon: LayoutDashboard, active: true },
  { label: "플레이스분석", icon: Store },
  { label: "검색량 조회", icon: Search },
  { label: "인스타 마케팅", icon: Sparkles },
  { label: "블로그 AI 글쓰기", icon: Bot },
  { label: "전체 마케팅 보기", icon: Megaphone, href: "/marketing" },
  { label: "포인트 충전", icon: CreditCard, href: "/points" },
];



const quickActions = [
  { title: "플레이스분석", description: "플레이스 순위와 경쟁업체 현황을 확인하세요.", icon: Store, tone: "purple" },
  { title: "검색량 조회", description: "키워드의 월간 검색량을 빠르게 조회하세요.", icon: Search, tone: "blue" },
  { title: "인스타 마케팅", description: "릴스 부스팅과 인스타 상품을 확인하세요.", icon: Sparkles, tone: "pink" },
  { title: "블로그 AI 글쓰기", description: "키워드에 맞는 블로그 원고를 작성하세요.", icon: Bot, tone: "orange" },
  { title: "포인트 충전", description: "서비스 이용에 필요한 포인트를 충전하세요.", icon: CreditCard, tone: "green", href: "/points" },
];

const projects = [
  { name: "송파 공유오피스 플레이스 관리", category: "플레이스", status: "진행 중", progress: 72, date: "2026. 07. 29" },
  { name: "법률사무소 브랜딩 블로그", category: "블로그", status: "원고 제작", progress: 46, date: "2026. 08. 03" },
  { name: "인스타그램 릴스 부스팅", category: "SNS", status: "검수 중", progress: 88, date: "2026. 07. 24" },
];

const activities = [
  { title: "플레이스 분석 결과가 업데이트되었습니다.", time: "10분 전", icon: BarChart3 },
  { title: "브랜딩 블로그 원고 2건이 등록되었습니다.", time: "2시간 전", icon: FileText },
  { title: "릴스 부스팅 주문이 검수 단계로 변경되었습니다.", time: "어제", icon: ClipboardList },
];

export default function DashboardPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("모스트애드 회원");
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pointBalance, setPointBalance] = useState(0);
  const [pointError, setPointError] = useState("");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.replace("/");
        return;
      }

      const metadata = data.user.user_metadata ?? {};
      setEmail(data.user.email ?? "");
      setDisplayName(metadata.manager_name || metadata.company_name || "모스트애드 회원");

      try {
        const balance = await getPointBalance(supabase, data.user.id);
        setPointBalance(balance);
      } catch {
        setPointError("포인트 DB 설정이 필요합니다.");
      }

      setLoading(false);
    });
  }, [router]);

  const initials = useMemo(() => displayName.trim().slice(0, 1) || "M", [displayName]);


  const stats = [
    { label: "진행 중인 마케팅", value: "3", unit: "건", icon: Gauge, tone: "purple", change: "이번 달 +1건" },
    { label: "완료된 작업", value: "12", unit: "건", icon: FolderKanban, tone: "blue", change: "최근 30일" },
    { label: "보유 포인트", value: pointBalance.toLocaleString(), unit: "P", icon: WalletCards, tone: "green", change: pointError || "충전·사용 내역 자동 반영" },
    { label: "평균 성과 상승", value: "28", unit: "%", icon: TrendingUp, tone: "orange", change: "지난달 대비 +6%" },
  ];

  async function logout() {
    const supabase = getSupabaseBrowserClient();
    await supabase?.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="loading-screen">
        <Loader2 className="spin" size={32} />
        <span>대시보드를 불러오고 있습니다.</span>
      </main>
    );
  }

  return (
    <main className="app-dashboard">
      {mobileOpen && <button className="dashboard-overlay" aria-label="메뉴 닫기" onClick={() => setMobileOpen(false)} />}

      <aside className={`dashboard-sidebar ${mobileOpen ? "is-open" : ""}`}>
        <div className="sidebar-brand">
          <span className="brand-symbol"><Sparkles size={21} /></span>
          <div>
            <strong>모스트애드</strong>
            <span>MARKETING PLATFORM</span>
          </div>
          <button className="sidebar-close" onClick={() => setMobileOpen(false)} aria-label="메뉴 닫기"><X size={20} /></button>
        </div>

        <nav className="sidebar-nav">
          <p>WORKSPACE</p>
          {navItems.map(({ label, icon: Icon, active, href }) => (
            <button key={label} className={active ? "active" : ""} onClick={() => href && router.push(href)}>
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <nav className="sidebar-nav sidebar-nav-bottom">
          <p>ACCOUNT</p>
          <button><MessageSquareText size={19} /><span>고객센터</span></button>
          <button><Settings size={19} /><span>환경 설정</span></button>
          <button onClick={() => router.push("/admin")}><ShieldCheck size={19} /><span>관리자 페이지</span></button>
        </nav>

        <div className="sidebar-support">
          <CircleHelp size={21} />
          <div>
            <strong>도움이 필요하신가요?</strong>
            <span>모스트애드 담당자에게 문의하세요.</span>
          </div>
          <ChevronRight size={17} />
        </div>

        <div className="sidebar-profile">
          <span className="profile-avatar">{initials}</span>
          <div>
            <strong>{displayName}</strong>
            <span>{email || "demo@mostad.co.kr"}</span>
          </div>
          <button onClick={logout} aria-label="로그아웃"><LogOut size={18} /></button>
        </div>
      </aside>

      <section className="dashboard-workspace">
        <header className="dashboard-header">
          <div className="header-left">
            <button className="mobile-menu-button" onClick={() => setMobileOpen(true)} aria-label="메뉴 열기"><Menu size={22} /></button>
            <div>
              <span>2026년 7월 21일 화요일</span>
              <h1>안녕하세요, {displayName}님 👋</h1>
            </div>
          </div>
          <div className="header-actions">
            <button className="header-search"><Search size={18} /><span>메뉴 또는 서비스를 검색하세요</span><kbd>⌘ K</kbd></button>
            <button className="icon-button notification-button" aria-label="알림"><Bell size={20} /><i /></button>
            <button className="profile-button"><span>{initials}</span><UserRound size={17} /></button>
          </div>
        </header>

        <div className="dashboard-content">
          <section className="welcome-banner">
            <div>
              <span className="banner-label"><Sparkles size={14} /> MOSTAD SMART WORKSPACE</span>
              <h2>오늘도 마케팅 성과를<br />한 단계 더 높여보세요.</h2>
              <p>플레이스 분석부터 검색량 조회, 인스타 마케팅과 AI 글쓰기까지<br />모스트애드에서 빠르고 편리하게 관리할 수 있습니다.</p>
              <button>새 마케팅 시작하기 <ChevronRight size={17} /></button>
            </div>
            <div className="banner-visual" aria-hidden="true">
              <div className="visual-card visual-card-a"><BarChart3 size={22} /><span>성과 분석</span><strong>+28%</strong></div>
              <div className="visual-card visual-card-b"><Bot size={22} /><span>AI 콘텐츠</span><strong>24개</strong></div>
              <div className="visual-ring ring-one" />
              <div className="visual-ring ring-two" />
              <Sparkles className="visual-spark spark-one" size={24} />
              <Sparkles className="visual-spark spark-two" size={17} />
            </div>
          </section>

          <section className="dashboard-stat-grid">
            {stats.map(({ label, value, unit, icon: Icon, tone, change }) => (
              <article className="dashboard-stat-card" key={label}>
                <div className={`stat-icon ${tone}`}><Icon size={21} /></div>
                <div className="stat-card-copy">
                  <span>{label}</span>
                  <strong>{value}<em>{unit}</em></strong>
                  <small>{change}</small>
                </div>
              </article>
            ))}
          </section>

          <section className="dashboard-section">
            <div className="section-heading">
              <div><span>QUICK START</span><h2>빠른 실행</h2></div>
              <button onClick={() => router.push("/marketing")}>전체 서비스 보기 <ChevronRight size={16} /></button>
            </div>
            <div className="quick-action-grid">
              {quickActions.map(({ title, description, icon: Icon, tone, href }) => (
                <button className="quick-action-card" key={title} onClick={() => href && router.push(href)}>
                  <span className={`quick-icon ${tone}`}><Icon size={22} /></span>
                  <div><strong>{title}</strong><span>{description}</span></div>
                  <ChevronRight size={18} />
                </button>
              ))}
            </div>
          </section>

          <div className="dashboard-bottom-grid">
            <section className="dashboard-section project-section">
              <div className="section-heading">
                <div><span>PROJECT STATUS</span><h2>진행 중인 마케팅</h2></div>
                <button>전체 보기 <ChevronRight size={16} /></button>
              </div>
              <div className="project-list">
                {projects.map((project) => (
                  <article className="project-row" key={project.name}>
                    <div className="project-main">
                      <span className="project-category">{project.category}</span>
                      <div><strong>{project.name}</strong><small>완료 예정 {project.date}</small></div>
                    </div>
                    <div className="project-status-block">
                      <div><span>{project.status}</span><strong>{project.progress}%</strong></div>
                      <div className="progress-track"><i style={{ width: `${project.progress}%` }} /></div>
                    </div>
                    <button aria-label={`${project.name} 상세 보기`}><ChevronRight size={18} /></button>
                  </article>
                ))}
              </div>
            </section>

            <section className="dashboard-section activity-section">
              <div className="section-heading">
                <div><span>RECENT ACTIVITY</span><h2>최근 활동</h2></div>
              </div>
              <div className="activity-list">
                {activities.map(({ title, time, icon: Icon }) => (
                  <article key={title}>
                    <span><Icon size={17} /></span>
                    <div><strong>{title}</strong><small>{time}</small></div>
                  </article>
                ))}
              </div>
              <button className="activity-more">모든 알림 확인하기 <ChevronRight size={16} /></button>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
