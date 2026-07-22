"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  Eye,
  EyeOff,
  Layers3,
  Loader2,
  LockKeyhole,
  Mail,
  Phone,
  UserRound,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length < 4) return digits;
    if (digits.length < 8) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  };

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    if (!name.trim() || !company.trim() || !phone.trim() || !email.trim() || !password || !passwordConfirm) {
      setMessage("필수 정보를 모두 입력해 주세요.");
      return;
    }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) {
      setMessage("올바른 이메일 주소를 입력해 주세요.");
      return;
    }
    if (password.length < 8) {
      setMessage("비밀번호는 8자 이상으로 입력해 주세요.");
      return;
    }
    if (password !== passwordConfirm) {
      setMessage("비밀번호가 서로 일치하지 않습니다.");
      return;
    }
    if (!agreeTerms || !agreePrivacy) {
      setMessage("필수 약관에 모두 동의해 주세요.");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("Supabase 연결 정보가 아직 등록되지 않았습니다. .env.local 파일을 설정해 주세요.");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          manager_name: name.trim(),
          company_name: company.trim(),
          phone: phone.trim(),
        },
      },
    });
    setLoading(false);

    if (error) {
      if (error.message.toLowerCase().includes("already registered")) {
        setMessage("이미 가입된 이메일입니다.");
      } else {
        setMessage("회원가입 중 오류가 발생했습니다. 입력 내용을 다시 확인해 주세요.");
      }
      return;
    }

    if (data.session) {
      router.replace("/dashboard");
      router.refresh();
      return;
    }

    setSuccess(true);
  }

  if (success) {
    return (
      <main className="signup-page signup-success-page">
        <section className="signup-success-card">
          <span className="success-icon"><Check size={30} /></span>
          <p className="signup-kicker">MOSTAD MARKETING PLATFORM</p>
          <h1>회원가입 신청이 완료되었습니다</h1>
          <p>입력한 이메일로 인증 메일을 보냈습니다.<br />이메일 인증을 완료한 뒤 로그인해 주세요.</p>
          <button type="button" className="signup-primary-button" onClick={() => router.replace("/")}>로그인 화면으로 이동 <ArrowRight size={19} /></button>
        </section>
      </main>
    );
  }

  return (
    <main className="signup-page">
      <section className="signup-shell">
        <header className="signup-header">
          <button type="button" className="signup-back" onClick={() => router.push("/")}>
            <ArrowLeft size={19} /> 로그인으로 돌아가기
          </button>
          <div className="signup-logo">
            <span className="brand-symbol"><Layers3 size={22} /></span>
            <span>모스트애드</span>
          </div>
        </header>

        <div className="signup-card">
          <div className="signup-heading">
            <p className="signup-kicker">MOSTAD MEMBERSHIP</p>
            <h1>회원가입</h1>
            <p>모스트애드 마케팅 플랫폼 이용을 위한 정보를 입력해 주세요.</p>
          </div>

          <form onSubmit={handleSignup} noValidate>
            <div className="signup-grid">
              <div className="signup-field">
                <label htmlFor="name">담당자명 <em>필수</em></label>
                <div className="input-wrap"><UserRound size={19} /><input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="홍길동" autoComplete="name" /></div>
              </div>

              <div className="signup-field">
                <label htmlFor="company">업체명 <em>필수</em></label>
                <div className="input-wrap"><Building2 size={19} /><input id="company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="업체명을 입력해 주세요" autoComplete="organization" /></div>
              </div>

              <div className="signup-field">
                <label htmlFor="phone">연락처 <em>필수</em></label>
                <div className="input-wrap"><Phone size={19} /><input id="phone" value={phone} onChange={(e) => setPhone(formatPhone(e.target.value))} placeholder="010-0000-0000" inputMode="numeric" autoComplete="tel" /></div>
              </div>

              <div className="signup-field">
                <label htmlFor="signup-email">이메일 <em>필수</em></label>
                <div className="input-wrap"><Mail size={19} /><input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" autoComplete="email" /></div>
              </div>

              <div className="signup-field">
                <label htmlFor="signup-password">비밀번호 <em>필수</em></label>
                <div className="input-wrap"><LockKeyhole size={19} /><input id="signup-password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="8자 이상 입력해 주세요" autoComplete="new-password" /><button type="button" className="password-toggle" onClick={() => setShowPassword(v => !v)} aria-label="비밀번호 표시 전환">{showPassword ? <EyeOff size={19} /> : <Eye size={19} />}</button></div>
              </div>

              <div className="signup-field">
                <label htmlFor="password-confirm">비밀번호 확인 <em>필수</em></label>
                <div className="input-wrap"><LockKeyhole size={19} /><input id="password-confirm" type={showPassword ? "text" : "password"} value={passwordConfirm} onChange={(e) => setPasswordConfirm(e.target.value)} placeholder="비밀번호를 한 번 더 입력해 주세요" autoComplete="new-password" /></div>
              </div>
            </div>

            <div className="terms-box">
              <div className="terms-row">
                <input
                  id="agree-terms"
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                />
                <label className="terms-label" htmlFor="agree-terms">
                  <span className="custom-check"><Check size={13} /></span>
                  <span><b>[필수]</b> 모스트애드 서비스 이용약관에 동의합니다.</span>
                </label>
                <button type="button" className="terms-view-button">보기</button>
              </div>

              <div className="terms-row">
                <input
                  id="agree-privacy"
                  type="checkbox"
                  checked={agreePrivacy}
                  onChange={(e) => setAgreePrivacy(e.target.checked)}
                />
                <label className="terms-label" htmlFor="agree-privacy">
                  <span className="custom-check"><Check size={13} /></span>
                  <span><b>[필수]</b> 개인정보 수집 및 이용에 동의합니다.</span>
                </label>
                <button type="button" className="terms-view-button">보기</button>
              </div>
            </div>

            {message && <div className="form-message signup-message" role="alert">{message}</div>}

            <button className="signup-primary-button" type="submit" disabled={loading}>
              {loading ? <><Loader2 className="spin" size={19} /> 가입 처리 중</> : <>회원가입 완료 <ArrowRight size={19} /></>}
            </button>
          </form>

          <p className="signup-login-link">이미 계정이 있으신가요? <button type="button" onClick={() => router.push("/")}>로그인하기</button></p>
        </div>
      </section>
    </main>
  );
}
