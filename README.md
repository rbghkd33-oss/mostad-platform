# 무료 마케팅 강의 신청 랜딩페이지

주소: `/free-marketing-class`

메뉴 항목 예시:

```ts
{
  label: "무료마케팅강의 신청",
  href: "/free-marketing-class",
}
```

설치 순서:
1. 압축을 프로젝트 루트에 덮어쓰기
2. Supabase SQL Editor에서 `supabase/free_marketing_class.sql` 실행
3. GitHub 반영 후 Vercel 배포

기존 환경변수 필요:
- NEXT_PUBLIC_SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
