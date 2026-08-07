"use client";

import Image from "next/image";
import { FormEvent, ReactNode, useState } from "react";

const interests = [
  "네이버 플레이스",
  "네이버 블로그",
  "인스타그램",
  "유튜브",
  "구글 광고",
  "브랜딩",
  "온라인 창업",
  "기타",
];

const lectureItems = [
  {
    number: "01",
    kicker: "NAVER PLACE",
    title: "네이버 플레이스",
    description: "검색 노출 구조부터 플레이스 관리와 고객 문의 전환까지 핵심만 알려드립니다.",
  },
  {
    number: "02",
    kicker: "BLOG CONTENT",
    title: "블로그 마케팅",
    description: "검색되는 콘텐츠와 단순히 글만 발행하는 콘텐츠의 차이를 실제 사례로 설명합니다.",
  },
  {
    number: "03",
    kicker: "SNS MARKETING",
    title: "인스타그램 마케팅",
    description: "팔로워 숫자보다 중요한 도달·콘텐츠·전환 구조를 이해하기 쉽게 알려드립니다.",
  },
  {
    number: "04",
    kicker: "MARKETING STRATEGY",
    title: "실전 마케팅 전략",
    description: "우리 업종에 어떤 마케팅부터 시작해야 하는지 광고비 우선순위를 잡아드립니다.",
  },
];

const recommendItems = [
  "광고를 하고 있지만 효과를 체감하지 못하는 분",
  "네이버 플레이스 노출과 방문 전환을 높이고 싶은 분",
  "블로그·인스타그램을 어떻게 운영해야 할지 막막한 분",
  "우리 업체에 맞는 마케팅 방향을 제대로 정하고 싶은 분",
];

export default function FreeMarketingClassPage() {
  const [form, setForm] = useState({
    name: "",
    company: "",
    phone: "",
    interest: "",
    privacyAgreed: false,
  });

  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState("");
  const [success, setSuccess] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNotice("");
    setSuccess(false);

    if (!form.name.trim()) return setNotice("이름을 입력해 주세요.");
    if (!/^01[016789]-?\d{3,4}-?\d{4}$/.test(form.phone.trim())) {
      return setNotice("휴대전화 번호를 정확히 입력해 주세요.");
    }
    if (!form.interest) return setNotice("관심 마케팅 분야를 선택해 주세요.");
    if (!form.privacyAgreed) return setNotice("개인정보 수집 및 이용에 동의해 주세요.");

    setSubmitting(true);

    try {
      const response = await fetch("/api/free-marketing-class/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = (await response.json().catch(() => ({}))) as { message?: string };

      if (!response.ok) {
        throw new Error(data.message || "신청 접수 중 오류가 발생했습니다.");
      }

      setSuccess(true);
      setNotice("무료 강의 신청이 접수되었습니다. 담당자가 확인 후 연락드리겠습니다.");
      setForm({
        name: "",
        company: "",
        phone: "",
        interest: "",
        privacyAgreed: false,
      });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "신청 접수 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  function scrollToForm() {
    document.getElementById("apply-form")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-[#07101f] text-white">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -left-40 top-20 h-[420px] w-[420px] rounded-full bg-[#4f46e5]/20 blur-[120px]" />
        <div className="absolute -right-32 top-[420px] h-[460px] w-[460px] rounded-full bg-[#0ea5e9]/15 blur-[120px]" />
      </div>

      <header className="relative z-20 border-b border-white/10 bg-[#07101f]/80 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-4 lg:px-8">
          <div className="flex items-center gap-3">
            <Image
              src="/mostad-logo.png"
              alt="모스트애드"
              width={120}
              height={38}
              className="h-8 w-auto object-contain"
              priority
            />
          </div>
          <button
            type="button"
            onClick={scrollToForm}
            className="rounded-full border border-white/15 bg-white/10 px-5 py-2.5 text-sm font-extrabold transition hover:bg-white/15"
          >
            무료 신청하기
          </button>
        </div>
      </header>

      <section className="relative z-10">
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 pb-14 pt-10 lg:grid-cols-[1.06fr_0.94fr] lg:px-8 lg:pb-20 lg:pt-16">
          <div className="flex flex-col justify-center">
            <div className="mb-5 flex flex-wrap gap-2">
              <span className="rounded-full border border-[#5eead4]/25 bg-[#5eead4]/10 px-4 py-2 text-xs font-black tracking-[0.18em] text-[#99f6e4]">
                MOSTAD FREE MARKETING CLASS
              </span>
              <span className="rounded-full border border-[#fbbf24]/25 bg-[#fbbf24]/10 px-4 py-2 text-xs font-black text-[#fde68a]">
                선착순 무료
              </span>
            </div>

            <p className="text-sm font-bold tracking-[0.22em] text-white/45">2026 OFFLINE SPECIAL CLASS</p>

            <h1 className="mt-4 text-[42px] font-black leading-[1.13] tracking-[-0.04em] sm:text-[54px] lg:text-[66px]">
              광고비를 쓰기 전에
              <br />
              꼭 알아야 할
              <br />
              <span className="bg-gradient-to-r from-[#60a5fa] via-[#818cf8] to-[#c084fc] bg-clip-text text-transparent">
                실전 마케팅
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-8 text-white/65 sm:text-lg">
              네이버 플레이스, 블로그, 인스타그램 등 온라인 채널을 활용해
              <br className="hidden sm:block" />
              실제 고객 유입과 문의 전환을 만드는 방법을 사례 중심으로 알려드립니다.
            </p>

            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <InfoCard label="강의 일시" value="9월 3일 · 14:00~17:00" />
              <InfoCard label="진행 장소" value="마곡나루역 인근" />
              <InfoCard label="참가 비용" value="0원 · 무료" accent />
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                onClick={scrollToForm}
                className="h-14 rounded-2xl bg-gradient-to-r from-[#4f46e5] to-[#7c3aed] px-7 text-base font-black shadow-[0_18px_40px_rgba(79,70,229,0.35)] transition hover:-translate-y-0.5"
              >
                지금 무료로 신청하기 →
              </button>
              <div className="flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] px-6 text-sm font-bold text-white/60">
                신청 후 담당자가 안내드립니다.
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-[36px] bg-gradient-to-br from-[#4f46e5]/20 to-[#06b6d4]/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-white/[0.045] p-2 shadow-2xl">
              <Image
                src="/free-marketing-class-hero.png"
                alt="마케팅 실전 오프라인 무료 특강"
                width={2048}
                height={1152}
                priority
                className="h-auto w-full rounded-[26px]"
              />
            </div>

            <div className="relative mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur">
                <p className="text-xs font-bold text-white/40">CLASS POINT</p>
                <strong className="mt-2 block text-xl font-black">실무 중심</strong>
                <span className="mt-1 block text-sm text-white/55">바로 적용 가능한 내용</span>
              </div>
              <div className="rounded-2xl border border-[#fbbf24]/20 bg-[#fbbf24]/[0.08] p-5 backdrop-blur">
                <p className="text-xs font-bold text-[#fde68a]/70">LIMITED SEATS</p>
                <strong className="mt-2 block text-xl font-black text-[#fde68a]">선착순 접수</strong>
                <span className="mt-1 block text-sm text-white/55">좌석 마감 시 종료</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 border-y border-white/10 bg-white/[0.025]">
        <div className="mx-auto w-full max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <SectionTitle
            eyebrow="WHO IS THIS FOR?"
            title="이런 분께 추천합니다"
            description="마케팅을 하고 있지만 방향이 막막했다면, 이번 강의에서 기준부터 잡아보세요."
          />

          <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {recommendItems.map((item, index) => (
              <article
                key={item}
                className="rounded-[24px] border border-white/10 bg-white/[0.045] p-6 transition hover:-translate-y-1 hover:bg-white/[0.065]"
              >
                <span className="text-sm font-black text-[#818cf8]">0{index + 1}</span>
                <p className="mt-5 text-base font-extrabold leading-7 text-white/90">{item}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10">
        <div className="mx-auto w-full max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
          <SectionTitle
            eyebrow="WHAT YOU WILL LEARN"
            title="3시간 동안 이것만큼은 확실히"
            description="복잡한 이론보다 실제 사업자에게 필요한 핵심 내용을 중심으로 구성했습니다."
          />

          <div className="mt-10 grid gap-5 md:grid-cols-2">
            {lectureItems.map((item) => (
              <article
                key={item.number}
                className="group rounded-[28px] border border-white/10 bg-gradient-to-br from-white/[0.065] to-white/[0.025] p-7 transition hover:border-[#818cf8]/40"
              >
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <p className="text-xs font-black tracking-[0.18em] text-[#818cf8]">{item.kicker}</p>
                    <h3 className="mt-3 text-2xl font-black">{item.title}</h3>
                  </div>
                  <span className="text-4xl font-black text-white/[0.08] transition group-hover:text-[#818cf8]/20">
                    {item.number}
                  </span>
                </div>
                <p className="mt-6 max-w-xl text-sm leading-7 text-white/58">{item.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="relative z-10 border-y border-white/10 bg-[#0b1324]">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-16 lg:grid-cols-[0.92fr_1.08fr] lg:px-8 lg:py-24">
          <div className="lg:sticky lg:top-28 lg:self-start">
            <p className="text-sm font-black tracking-[0.2em] text-[#818cf8]">FREE APPLICATION</p>
            <h2 className="mt-4 text-4xl font-black leading-tight tracking-[-0.03em] sm:text-5xl">
              마케팅,
              <br />
              무작정 시작하지 마세요.
            </h2>
            <p className="mt-5 max-w-lg text-base leading-8 text-white/60">
              우리 업체에 필요한 마케팅부터 알고 시작하면 같은 광고비로도 결과는 달라질 수 있습니다.
            </p>

            <div className="mt-8 space-y-3">
              {[
                "2026년 9월 3일 목요일",
                "오후 2시 ~ 오후 5시",
                "마곡나루역 인근",
                "참가비 무료",
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-sm font-bold text-white/75"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#4f46e5]/20 text-[#a5b4fc]">✓</span>
                  {item}
                </div>
              ))}
            </div>
          </div>

          <form
            id="apply-form"
            onSubmit={submit}
            className="scroll-mt-28 rounded-[32px] border border-white/10 bg-white p-6 text-[#111827] shadow-[0_28px_70px_rgba(0,0,0,0.28)] sm:p-8 lg:p-10"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-black text-[#ef4444]">0원 무료 신청</p>
                <h2 className="mt-2 text-3xl font-black tracking-[-0.03em]">무료 마케팅 강의 신청</h2>
              </div>
              <span className="rounded-full bg-[#eef2ff] px-4 py-2 text-xs font-black text-[#4f46e5]">
                선착순 접수
              </span>
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-500">
              아래 정보를 남겨주시면 신청 내용을 확인한 뒤 담당자가 입력하신 연락처로 안내드립니다.
            </p>

            <div className="mt-8 grid gap-5 sm:grid-cols-2">
              <Field label="이름" required>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="이름을 입력해 주세요"
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] outline-none transition placeholder:text-slate-400 focus:border-[#6366f1] focus:ring-4 focus:ring-[#6366f1]/10"
                />
              </Field>

              <Field label="업체명">
                <input
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="업체명 또는 상호명"
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] outline-none transition placeholder:text-slate-400 focus:border-[#6366f1] focus:ring-4 focus:ring-[#6366f1]/10"
                />
              </Field>

              <Field label="전화번호" required>
                <input
                  value={form.phone}
                  onChange={(e) =>
                    setForm({ ...form, phone: e.target.value.replace(/[^0-9-]/g, "") })
                  }
                  inputMode="tel"
                  placeholder="010-0000-0000"
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] outline-none transition placeholder:text-slate-400 focus:border-[#6366f1] focus:ring-4 focus:ring-[#6366f1]/10"
                />
              </Field>

              <Field label="관심 마케팅 분야" required>
                <select
                  value={form.interest}
                  onChange={(e) => setForm({ ...form, interest: e.target.value })}
                  className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-[15px] outline-none transition focus:border-[#6366f1] focus:ring-4 focus:ring-[#6366f1]/10"
                >
                  <option value="">관심 분야를 선택해 주세요</option>
                  {interests.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </Field>
            </div>

            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={form.privacyAgreed}
                  onChange={(e) => setForm({ ...form, privacyAgreed: e.target.checked })}
                  className="mt-1 h-4 w-4 accent-[#4f46e5]"
                />
                <span className="text-sm font-extrabold">
                  <b className="text-[#4f46e5]">[필수]</b> 개인정보 수집 및 이용 동의
                </span>
              </label>

              <div className="mt-4 rounded-xl bg-white p-4 text-xs leading-6 text-slate-500">
                수집 항목: 이름, 업체명, 전화번호, 관심 마케팅 분야
                <br />
                수집 목적: 무료 마케팅 강의 신청 접수 및 안내
                <br />
                보유 기간: 강의 종료 후 3개월 또는 동의 철회 시까지
              </div>
            </div>

            {notice && (
              <div
                className={`mt-5 rounded-2xl px-4 py-3.5 text-sm font-bold ${
                  success
                    ? "border border-emerald-100 bg-emerald-50 text-emerald-700"
                    : "border border-red-100 bg-red-50 text-red-600"
                }`}
              >
                {notice}
              </div>
            )}

            <button
              disabled={submitting}
              className="mt-6 h-16 w-full rounded-2xl bg-gradient-to-r from-[#4f46e5] via-[#6366f1] to-[#7c3aed] text-base font-black text-white shadow-[0_16px_35px_rgba(79,70,229,0.3)] transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? "신청 접수 중..." : "무료 강의 신청하기 →"}
            </button>

            <p className="mt-4 text-center text-xs text-slate-400">
              신청 완료 후 담당자가 순차적으로 연락드립니다.
            </p>
          </form>
        </div>
      </section>

      <section className="relative z-10">
        <div className="mx-auto w-full max-w-7xl px-5 py-16 lg:px-8 lg:py-20">
          <div className="overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-r from-[#312e81] via-[#4338ca] to-[#6d28d9] p-8 text-center shadow-2xl sm:p-12">
            <p className="text-sm font-black tracking-[0.18em] text-white/65">MOSTAD FREE CLASS</p>
            <h2 className="mt-4 text-3xl font-black tracking-[-0.03em] sm:text-4xl">
              지금 필요한 마케팅부터 제대로 시작하세요.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-white/70 sm:text-base">
              9월 3일, 마곡나루에서 실제 고객을 만드는 마케팅의 기준을 알려드립니다.
            </p>
            <button
              type="button"
              onClick={scrollToForm}
              className="mt-7 h-14 rounded-2xl bg-white px-8 text-base font-black text-[#3730a3] transition hover:-translate-y-0.5"
            >
              무료로 자리 신청하기
            </button>
          </div>
        </div>
      </section>

      <footer className="relative z-10 border-t border-white/10">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 px-5 py-8 text-center text-xs text-white/35 sm:flex-row sm:items-center sm:justify-between sm:text-left lg:px-8">
          <span>MOSTAD · Marketing Platform</span>
          <span>무료 마케팅 실전 강의 · 2026.09.03</span>
        </div>
      </footer>

      <button
        type="button"
        onClick={scrollToForm}
        className="fixed bottom-4 left-4 right-4 z-50 h-14 rounded-2xl bg-gradient-to-r from-[#4f46e5] to-[#7c3aed] text-sm font-black text-white shadow-2xl lg:hidden"
      >
        무료 강의 신청하기
      </button>
    </main>
  );
}

function Field({
  label,
  required = false,
  children,
}: {
  label: string;
  required?: boolean;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-extrabold text-slate-700">
        {label}
        {required && <b className="ml-1 text-[#ef4444]">*</b>}
      </span>
      {children}
    </label>
  );
}

function InfoCard({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        accent
          ? "border-[#fbbf24]/20 bg-[#fbbf24]/[0.08]"
          : "border-white/10 bg-white/[0.05]"
      }`}
    >
      <p className={`text-xs font-bold ${accent ? "text-[#fde68a]/70" : "text-white/40"}`}>
        {label}
      </p>
      <p className={`mt-2 text-sm font-black ${accent ? "text-[#fde68a]" : "text-white/90"}`}>
        {value}
      </p>
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <p className="text-xs font-black tracking-[0.2em] text-[#818cf8]">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-black tracking-[-0.03em] sm:text-4xl">{title}</h2>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-white/55 sm:text-base">{description}</p>
    </div>
  );
}
