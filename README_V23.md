# v23 이미지 분석 블로그 글쓰기

- 기존 `/blog-ai` 유지
- 새 메뉴 `/blog-ai-images`
- 이미지 최대 12장, 브라우저 자동 압축
- 이미지 분석 API `/api/generate-body-with-images` 프록시 연동
- 성공 시에만 1,000P 차감
- 원고 내 이미지 배치 마커를 실제 이미지 미리보기와 함께 표시
- 최근 이미지 원고 8개 저장

## 적용
1. 패치의 app, supabase 폴더를 기존 프로젝트에 덮어쓰기
2. `supabase/migrations/013_blog_ai_image_integration.sql` 실행
3. 기존 BLOG_AI_API_KEY 또는 PLACE_DIAG_API_KEY 사용
4. git add/commit/push
