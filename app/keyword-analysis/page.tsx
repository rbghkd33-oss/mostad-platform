"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Gift, Loader2, Search, Sparkles } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase";

type Stat = {
  keyword: string;
  volume_pc: number;
  volume_mobile: number;
  volume_total: number;
  doc_count: number | null;
  ratio: number | null;
  score: number | null;
  grade: string | null;
  competition: string;
};

type Result = {
  seed: string;
  seed_found: boolean;
  seed_stats: Stat | null;
  recommendations: Stat[];
  related_count: number;
  candidate_count: number;
  analyzed_count: number;
  hint: string | null;
};

export default function KeywordAnalysisPage() {
  const router = useRouter();
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    void (async () => {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) return;
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.replace("/");
        return;
      }
      setLoading(false);
    })();
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!keyword.trim() || running) return;

    setRunning(true);
    setResult(null);
    setIsError(false);
    setMessage("무료 분석 요청을 준비하고 있습니다.");

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setMessage("로그인 연결 정보를 불러오지 못했습니다.");
      setIsError(true);
      setRunning(false);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      setMessage("로그인이 필요합니다.");
      setIsError(true);
      setRunning(false);
      return;
    }

    try {
      const response = await fetch("/api/keyword-analysis/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          seedKeyword: keyword.trim(),
          requestId: crypto.randomUUID(),
        }),
      });
      if (!response.body) throw new Error("분석 응답을 받지 못했습니다.");

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          let eventName = "";
          let data = "";
          for (const line of part.split("\n")) {
            if (line.startsWith("event: ")) eventName = line.slice(7);
            if (line.startsWith("data: ")) data += line.slice(6);
          }
          if (!data) continue;

          const payload = JSON.parse(data);
          if (eventName === "status") {
            setMessage(
              `${payload.message}${
                payload.elapsed ? ` (${Math.round(payload.elapsed)}초 경과)` : ""
              }`,
            );
          }
          if (eventName === "complete") {
            setResult(payload.result);
            setMessage("무료 키워드 분석이 완료되었습니다.");
          }
          if (eventName === "error") {
            setMessage(payload.message);
            setIsError(true);
          }
        }
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "분석 중 오류가 발생했습니다.",
      );
      setIsError(true);
    } finally {
      setRunning(false);
    }
  }

  const seed = result?.seed_stats;
  const number = (value: number | null | undefined) =>
    value == null ? "-" : value.toLocaleString();

  return (
    <main className="keyword-page">
      <div className="keyword-shell">
        <div className="keyword-topbar">
          <button onClick={() => router.push("/dashboard")}>
            <ArrowLeft size={16} /> 대시보드
          </button>
        </div>

        <section className="keyword-hero">
          <div>
            <span>
              <Sparkles size={14} /> MOSTAD KEYWORD LAB
            </span>
            <h1>검색량·경쟁률 분석</h1>
            <p>
              키워드 검색량과 문서 수를 비교하고 진입하기 좋은 연관
              키워드를 찾아보세요.
            </p>
          </div>
          <div className="keyword-credit">
            <span>이용 요금</span>
            <strong>무료</strong>
            <small>
              <Gift size={13} /> 포인트 차감 없이 이용 가능
            </small>
          </div>
        </section>

        <form className="keyword-form" onSubmit={submit}>
          <input
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            placeholder="분석할 키워드를 입력하세요. 예: 대전두피문신"
            maxLength={100}
          />
          <button disabled={loading || running}>
            {running ? (
              <>
                <Loader2 className="spin" size={17} /> 분석 중
              </>
            ) : (
              <>
                <Search size={17} /> 무료 키워드 분석
              </>
            )}
          </button>
        </form>

        {message && (
          <div className={`keyword-message ${isError ? "error" : ""}`}>
            {message}
          </div>
        )}

        {seed && (
          <>
            <section className="keyword-summary">
              <article className="keyword-card">
                <span>월간 검색량</span>
                <strong>{number(seed.volume_total)}</strong>
                <small>
                  PC {number(seed.volume_pc)} · 모바일 {number(seed.volume_mobile)}
                </small>
              </article>
              <article className="keyword-card">
                <span>블로그 문서 수</span>
                <strong>{number(seed.doc_count)}</strong>
                <small>네이버 검색 문서 기준</small>
              </article>
              <article className="keyword-card">
                <span>경쟁률</span>
                <strong>
                  {seed.ratio == null ? "-" : seed.ratio.toFixed(3)}
                </strong>
                <small>문서 수 ÷ 검색량</small>
              </article>
              <article className="keyword-card">
                <span>등급</span>
                <strong>{seed.grade || "-"}</strong>
                <small>경쟁강도 {seed.competition || "-"}</small>
              </article>
              <article className="keyword-card">
                <span>종합 점수</span>
                <strong>
                  {seed.score == null ? "-" : seed.score.toFixed(1)}
                </strong>
                <small>높을수록 진입 유리</small>
              </article>
            </section>

            <section className="keyword-result-panel">
              <h2>추천 연관 키워드</h2>
              {result?.recommendations?.length ? (
                <table className="keyword-table">
                  <thead>
                    <tr>
                      <th>키워드</th>
                      <th>검색량</th>
                      <th>문서 수</th>
                      <th>경쟁률</th>
                      <th>등급</th>
                      <th>점수</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {result.recommendations.map((item) => (
                      <tr key={item.keyword}>
                        <td>
                          <b>{item.keyword}</b>
                        </td>
                        <td>{number(item.volume_total)}</td>
                        <td>{number(item.doc_count)}</td>
                        <td>
                          {item.ratio == null ? "-" : item.ratio.toFixed(3)}
                        </td>
                        <td>
                          <span className="keyword-grade">
                            {item.grade || "-"}
                          </span>
                        </td>
                        <td>
                          {item.score == null ? "-" : item.score.toFixed(1)}
                        </td>
                        <td>
                          <button
                            className="keyword-write"
                            onClick={() =>
                              router.push(
                                `/blog-ai?main_keyword=${encodeURIComponent(
                                  item.keyword,
                                )}`,
                              )
                            }
                          >
                            이 키워드로 글쓰기
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p>{result?.hint || "추천 키워드가 없습니다."}</p>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
