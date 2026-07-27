# 인스타 로그인 정보 보안 저장 v32

- 고객이 아이디와 비밀번호 입력
- AES-256-GCM 암호화 후 Supabase 저장
- 관리자/최고관리자만 비밀번호 보기 및 복사
- 60초 후 관리자 화면에서 자동 숨김
- 열람 이력 저장
- 신청 시 150,000P 차감, 승인 후 30일 가동

필수 Vercel 환경변수:
INSTAGRAM_CREDENTIAL_ENCRYPTION_KEY=32자 이상의 임의 문자열

Supabase SQL:
supabase/migrations/017_instagram_credentials_secure.sql
