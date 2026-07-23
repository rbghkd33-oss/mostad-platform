MOSTAD v26 - 검색량 조회 무료 서비스 전환

1. app, supabase 폴더를 기존 프로젝트에 덮어씁니다.
2. Supabase SQL Editor에서 supabase/migrations/015_keyword_analysis_free.sql 실행
3. pnpm dev로 확인 후 git push

변경 내용
- 검색량 분석 포인트 잔액 확인 제거
- 분석 성공 후 250P 차감 제거
- 화면의 보유 포인트/차감 안내를 무료 서비스로 변경
- 분석 기록은 point_cost=0으로 계속 저장
