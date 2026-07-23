"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Layers3,
  Loader2,
  LockKeyhole,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setChecking(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/dashboard");
      else setChecking(false);
    });
  }, [router]);

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!email.trim() || !password) {
      setMessage("이메일과 비밀번호를 모두 입력해 주세요.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Supabase 연결 정보가 아직 등록되지 않았습니다. .env.local 파일을 설정해 주세요.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setLoading(false);

    if (error) {
      setMessage("이메일 또는 비밀번호를 확인해 주세요.");
      return;
    }

    if (!remember) {
      sessionStorage.setItem("mostad-session-only", "true");
    }

    router.replace("/dashboard");
    router.refresh();
  }

  if (checking) {
    return (
      <main className="loading-screen">
        <Loader2 className="spin" size={32} />
        <span>로그인 상태를 확인하고 있습니다.</span>
      </main>
    );
  }

  return (
    <main className="login-page">
      <section className="brand-panel">
        <div className="brand-glow brand-glow-one" />
        <div className="brand-glow brand-glow-two" />

        <div className="brand-content">
          <div className="brand-logo" aria-label="모스트애드">
            <img className="login-brand-image" src="/mostad-logo.png" alt="모스트애드 로고" />
            <span>모스트애드</span>
          </div>

          <div className="brand-copy">
            <span className="eyebrow"><Sparkles size={15} /> MOSTAD MARKETING PLATFORM</span>
            <h1>마케팅의 모든 과정을<br />하나의 플랫폼에서</h1>
            <p>분석부터 콘텐츠 제작, 주문 진행과 결과 관리까지<br className="desktop-break" /> 모스트애드에서 더 빠르고 편리하게 관리하세요.</p>
          </div>

          <div className="feature-grid">
            <div className="feature-card">
              <BarChart3 size={21} />
              <strong>데이터 분석</strong>
              <span>플레이스와 키워드를 한눈에</span>
            </div>
            <div className="feature-card">
              <Sparkles size={21} />
              <strong>AI 콘텐츠</strong>
              <span>업종에 맞는 콘텐츠를 빠르게</span>
            </div>
            <div className="feature-card">
              <ShieldCheck size={21} />
              <strong>안전한 관리</strong>
              <span>회원별 정보와 결과를 안전하게</span>
            </div>
          </div>

          <div className="brand-bottom">
            <span><Check size={15} /> 분석</span>
            <span><Check size={15} /> 콘텐츠</span>
            <span><Check size={15} /> 주문</span>
            <span><Check size={15} /> 성과 관리</span>
          </div>
        </div>
      </section>

      <section className="login-panel">
        <div className="mobile-logo">
          <img className="mobile-brand-image" src="/mostad-logo.png" alt="모스트애드 로고" />
          <span>모스트애드</span>
        </div>

        <div className="login-card">
          <div className="login-heading">
            <span className="login-icon"><KeyRound size={21} /></span>
            <h2>로그인</h2>
            <p>모스트애드 플랫폼을 이용하려면 로그인해 주세요.</p>
          </div>

          <form onSubmit={handleLogin} noValidate>
            <label className="field-label" htmlFor="email">이메일</label>
            <div className="input-wrap">
              <Mail size={19} />
              <input
                id="email"
                type="email"
                placeholder="name@company.com"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>

            <label className="field-label" htmlFor="password">비밀번호</label>
            <div className="input-wrap">
              <LockKeyhole size={19} />
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="비밀번호를 입력해 주세요"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
              <button
                type="button"
                className="password-toggle"
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? "비밀번호 숨기기" : "비밀번호 표시"}
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>

            <div className="login-options">
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(event) => setRemember(event.target.checked)}
                />
                <span className="custom-check"><Check size={13} /></span>
                로그인 상태 유지
              </label>
              <button type="button" className="text-button" onClick={() => setMessage("비밀번호 찾기 기능은 다음 단계에서 연결합니다.")}>비밀번호 찾기</button>
            </div>

            {message && <div className="form-message" role="alert">{message}</div>}

            <button className="login-button" type="submit" disabled={loading}>
              {loading ? <><Loader2 size={19} className="spin" /> 로그인 중</> : <>로그인하기 <ArrowRight size={19} /></>}
            </button>
          </form>

          <div className="divider"><span>또는</span></div>

          <button type="button" className="signup-button" onClick={() => router.push("/signup")}>모스트애드 회원가입</button>

          <p className="support-text">로그인에 문제가 있나요? <button type="button" onClick={() => setMessage("고객센터 연결 기능은 추후 추가됩니다.")}>고객센터 문의</button></p>
        </div>

        <footer>© 2026 MOSTAD. All rights reserved.</footer>
      </section>
    </main>
  );
}
