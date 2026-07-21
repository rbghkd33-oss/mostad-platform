"use client";

import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  ChevronRight,
  Instagram,
  Megaphone,
  SearchCheck,
  ShoppingBag,
  Sparkles,
  Store,
} from "lucide-react";

const services = [
  {
    category: "플레이스 마케팅",
    title: "플레이스 상위노출",
    description: "핵심 지역 키워드를 기준으로 네이버 플레이스 노출 순위를 집중 관리합니다.",
    icon: Store,
    tone: "purple",
    badge: "집중 노출",
  },
  {
    category: "플레이스 마케팅",
    title: "플레이스 최적화 관리형",
    description: "업체 정보, 키워드, 콘텐츠와 운영 상태를 지속적으로 점검하고 최적화합니다.",
    icon: SearchCheck,
    tone: "blue",
    badge: "월 관리",
  },
  {
    category: "N쇼핑 마케팅",
    title: "N쇼핑 상위노출",
    description: "상품 핵심 키워드를 기반으로 네이버 쇼핑 검색 노출을 강화합니다.",
    icon: ShoppingBag,
    tone: "green",
    badge: "검색 노출",
  },
  {
    category: "N쇼핑 마케팅",
    title: "N쇼핑 최적화 관리",
    description: "상품명, 카테고리, 속성, 키워드 등 쇼핑 노출 요소를 체계적으로 관리합니다.",
    icon: BarChart3,
    tone: "orange",
    badge: "최적화",
  },
  {
    category: "블로그 마케팅",
    title: "블로그 상위노출",
    description: "검색 의도에 맞춘 콘텐츠 제작으로 주요 키워드의 블로그 노출을 진행합니다.",
    icon: Megaphone,
    tone: "purple",
    badge: "키워드 노출",
  },
  {
    category: "블로그 마케팅",
    title: "브랜딩 블로그 최적화 관리",
    description: "브랜드 톤에 맞춘 콘텐츠를 꾸준히 축적하고 블로그 운영 상태를 관리합니다.",
    icon: Sparkles,
    tone: "blue",
    badge: "브랜딩",
  },
  {
    category: "인스타 마케팅",
    title: "인스타 계정 최적화",
    description: "프로필, 콘텐츠 방향, 해시태그와 업로드 구성을 점검해 계정을 최적화합니다.",
    icon: Instagram,
    tone: "pink",
    badge: "계정 관리",
  },
  {
    category: "인스타 마케팅",
    title: "인스타 릴스 조회수 부스팅",
    description: "릴스 콘텐츠의 초기 조회수와 도달 확산을 지원하는 부스팅 상품입니다.",
    icon: Instagram,
    tone: "pink",
    badge: "릴스 부스팅",
  },
];

const categories = ["전체", "플레이스", "N쇼핑", "블로그", "인스타"];

export default function MarketingPage() {
  const router = useRouter();

  return (
    <main className="marketing-page">
      <header className="marketing-topbar">
        <button onClick={() => router.push("/dashboard")}>
          <ArrowLeft size={18} /> 대시보드로 돌아가기
        </button>
        <div className="marketing-brand">
          <span><Sparkles size={18} /></span>
          <strong>모스트애드</strong>
        </div>
      </header>

      <section className="marketing-container">
        <div className="marketing-heading-row">
          <div className="marketing-heading">
            <span>MOSTAD MARKETING SERVICES</span>
            <h1>전체 마케팅 보기</h1>
            <p>업종과 목표에 맞는 마케팅 상품을 확인하고 필요한 서비스를 신청하세요.</p>
          </div>
          <div className="marketing-count-box">
            <strong>8</strong>
            <span>등록 상품</span>
          </div>
        </div>

        <div className="marketing-filter-bar">
          {categories.map((category, index) => (
            <button className={index === 0 ? "active" : ""} key={category}>{category}</button>
          ))}
        </div>

        <div className="marketing-service-grid marketing-product-grid">
          {services.map(({ category, title, description, icon: Icon, tone, badge }) => (
            <article className="marketing-service-card marketing-product-card" key={title}>
              <div className="marketing-product-card-top">
                <span className={`marketing-service-icon ${tone}`}><Icon size={25} /></span>
                <span className="marketing-product-badge">{badge}</span>
              </div>
              <div className="marketing-product-copy">
                <small>{category}</small>
                <strong>{title}</strong>
                <p>{description}</p>
              </div>
              <button className="marketing-apply-button">
                상품 자세히 보기 <ChevronRight size={17} />
              </button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
