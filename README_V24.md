# MOSTAD v24 - 블로그 AI 비동기 폴링 전환

변경 사항
- 일반 원고: POST /api/generate-body-async
- 이미지 원고: POST /api/generate-body-with-images-async
- 4초 간격으로 GET /api/job/{job_id} 폴링
- status=done 확인 후에만 1,000P 차감 및 저장
- failed/timeout/조회 오류 시 포인트 미차감

SQL 추가 실행은 없습니다.
기존 v23에 app/api/blog-ai 폴더만 덮어쓰면 됩니다.
