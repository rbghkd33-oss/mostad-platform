"use client";

import Image from "next/image";
import { FormEvent, useState } from "react";

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
      if (!response.ok) throw new Error(data.message || "신청 접수 중 오류가 발생했습니다.");

      setSuccess(true);
      setNotice("무료 강의 신청이 접수되었습니다. 담당자가 확인 후 연락드리겠습니다.");
      setForm({ name: "", company: "", phone: "", interest: "", privacyAgreed: false });
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "신청 접수 중 오류가 발생했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#07080c] text-white">
      <section className="mx-auto grid w-full max-w-7xl gap-8 px-5 py-8 lg:grid-cols-[1.12fr_0.88fr] lg:px-8 lg:py-14">
        <div>
          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[#10121a] shadow-2xl">
            <Image
              src="/free-marketing-class-hero.png"
              alt="마케팅 실전 오프라인 무료 특강"
              width={2048}
              height={1152}
              priority
              className="h-auto w-full"
            />
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {[
              ["강의 일시", "2026년 9월 3일 오후 2시"],
              ["진행 장소", "마곡나루역 인근"],
              ["참가 비용", "선착순 무료"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-2xl border border-white/10 bg-white/[0.045] p-5">
                <p className="text-sm text-white/50">{label}</p>
                <p className="mt-2 font-bold">{value}</p>
              </div>
            ))}
          </div>

          <div className="mt-6 rounded-[24px] border border-yellow-400/20 bg-yellow-400/[0.06] p-6">
            <p className="text-sm font-bold text-yellow-300">좌석 마감 임박 · 선착순 접수</p>
            <h2 className="mt-2 text-2xl font-black">실제 고객을 만드는 마케팅 실전 강의</h2>
            <p className="mt-3 leading-7 text-white/70">
              네이버 플레이스, 블로그, 인스타그램 등 온라인 채널을 활용해
              고객 유입과 문의 전환을 만드는 실무 중심 강의입니다.
            </p>
          </div>
        </div>

        <div className="lg:sticky lg:top-6 lg:self-start">
          <form onSubmit={submit} className="rounded-[30px] border border-white/10 bg-white p-6 text-[#11131a] shadow-2xl sm:p-8">
            <p className="text-sm font-bold text-[#ec1739]">0원 무료 신청</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight">무료 마케팅 강의 신청</h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              신청 내용을 확인한 뒤 담당자가 입력하신 연락처로 안내드립니다.
            </p>

            <div className="mt-7 space-y-5">
              <Field label="이름 *">
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="이름을 입력해 주세요"
                  className="h-13 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-[#5547ff]"
                />
              </Field>

              <Field label="업체명">
                <input
                  value={form.company}
                  onChange={(e) => setForm({ ...form, company: e.target.value })}
                  placeholder="업체명 또는 상호명"
                  className="h-13 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-[#5547ff]"
                />
              </Field>

              <Field label="전화번호 *">
                <input
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value.replace(/[^0-9-]/g, "") })}
                  inputMode="tel"
                  placeholder="010-0000-0000"
                  className="h-13 w-full rounded-xl border border-slate-200 px-4 outline-none focus:border-[#5547ff]"
                />
              </Field>

              <Field label="관심 마케팅 분야 *">
                <select
                  value={form.interest}
                  onChange={(e) => setForm({ ...form, interest: e.target.value })}
                  className="h-13 w-full rounded-xl border border-slate-200 bg-white px-4 outline-none focus:border-[#5547ff]"
                >
                  <option value="">관심 분야를 선택해 주세요</option>
                  {interests.map((item) => <option key={item}>{item}</option>)}
                </select>
              </Field>

              <div className="rounded-2xl bg-slate-50 p-4">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={form.privacyAgreed}
                    onChange={(e) => setForm({ ...form, privacyAgreed: e.target.checked })}
                    className="mt-1 h-4 w-4 accent-[#5547ff]"
                  />
                  <span className="text-sm font-bold">개인정보 수집 및 이용 동의 (필수)</span>
                </label>
                <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-xs leading-5 text-slate-500">
                  수집 항목: 이름, 업체명, 전화번호, 관심 마케팅 분야<br />
                  수집 목적: 무료 마케팅 강의 신청 접수 및 안내<br />
                  보유 기간: 강의 종료 후 3개월 또는 동의 철회 시까지
                </div>
              </div>
            </div>

            {notice && (
              <div className={`mt-5 rounded-xl px-4 py-3 text-sm font-semibold ${
                success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
              }`}>
                {notice}
              </div>
            )}

            <button
              disabled={submitting}
              className="mt-6 h-14 w-full rounded-xl bg-gradient-to-r from-[#f20c2f] to-[#ff4c16] font-black text-white disabled:opacity-60"
            >
              {submitting ? "신청 접수 중..." : "무료 강의 신청하기"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-bold">{label}</span>
      {children}
    </label>
  );
}
