# v22 블로그 AI 글쓰기

- `/blog-ai` 원고 생성 화면
- 원고 생성 성공 후 1,000P 자동 차감
- 실패 및 타임아웃 시 포인트 미차감
- 최근 생성 원고 저장 및 다시 보기
- 긴 응답을 위해 SSE 스트리밍 적용

Supabase SQL Editor에서 `supabase/migrations/012_blog_ai_integration.sql`을 실행하세요.
Vercel 환경변수에 `BLOG_AI_API_KEY`를 등록하세요. 플레이스 분석과 동일한 키라면 기존 `PLACE_DIAG_API_KEY`를 자동으로 사용합니다.
