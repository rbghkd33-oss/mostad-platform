# v21 플레이스 분석 API 연동

## 환경변수
Vercel Environment Variables에 아래 값을 추가합니다.

- Key: `PLACE_DIAG_API_KEY`
- Value: 플레이스 진단 API에서 발급받은 X-API-Key
- Environments: Production and Preview
- Sensitive: ON

## Supabase
SQL Editor에서 아래 파일을 실행합니다.

`supabase/migrations/011_place_analysis_integration.sql`

## 화면
- 고객 메뉴: `/place-analysis`
- 서버 프록시: `/api/place-analysis`

API 키는 클라이언트에 노출하지 않고 Next.js 서버에서만 외부 API로 전달됩니다.
