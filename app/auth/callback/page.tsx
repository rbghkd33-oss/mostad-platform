"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

function KakaoCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("카카오 로그인 정보를 확인하고 있습니다.");

  useEffect(() => {
    let cancelled = false;

    async function finishOAuth() {
      const supabase = getSupabaseBrowserClient();

      if (!supabase) {
        setMessage("Supabase 연결 정보가 없습니다.");
        return;
      }

      try {
        let session = null;

        for (let attempt = 0; attempt < 20; attempt += 1) {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;

          if (data.session) {
            session = data.session;
            break;
          }

          await new Promise((resolve) => setTimeout(resolve, 250));
        }

        if (!session) {
          throw new Error("카카오 로그인 세션을 확인하지 못했습니다.");
        }

        const { error: profileError } = await supabase.rpc("ensure_my_profile");
        if (profileError) {
          console.warn("ensure_my_profile 실패:", profileError.message);
        }

        sessionStorage.removeItem("mostad-kakao-signup");

        const next = searchParams.get("next");
        const safeNext = next && next.startsWith("/") ? next : "/dashboard";

        if (!cancelled) {
          router.replace(safeNext);
          router.refresh();
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setMessage("카카오 로그인 처리에 실패했습니다.");
          setTimeout(() => router.replace("/?error=kakao_login_failed"), 1800);
        }
      }
    }

    finishOAuth();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f5f7fb" }}>
      <section style={{ background: "#fff", borderRadius: 18, padding: 32, textAlign: "center" }}>
        <Loader2 size={34} className="spin" />
        <h1>카카오 계정 연결 중</h1>
        <p>{message}</p>
      </section>
    </main>
  );
}

function CallbackLoading() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "#f5f7fb",
      }}
    >
      <section
        style={{
          background: "#fff",
          borderRadius: 18,
          padding: 32,
          textAlign: "center",
        }}
      >
        <Loader2 size={34} className="spin" />
        <h1>카카오 계정 연결 중</h1>
        <p>로그인 정보를 확인하고 있습니다.</p>
      </section>
    </main>
  );
}

export default function KakaoCallbackPage() {
  return (
    <Suspense fallback={<CallbackLoading />}>
      <KakaoCallbackContent />
    </Suspense>
  );
}
