# 모스트애드 마케팅 플랫폼

첫 화면이 로그인 페이지로 열리는 Next.js + Supabase 프로젝트입니다.

## 실행 방법

1. Node.js 20.9 이상을 설치합니다.
2. 이 폴더에서 터미널을 엽니다.
3. 아래 명령을 순서대로 실행합니다.

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Windows에서는 `.env.local.example` 파일을 복사한 뒤 이름을 `.env.local`로 변경해도 됩니다.

브라우저에서 `http://localhost:3000`을 엽니다.

## Supabase 연결

`.env.local` 파일에 Supabase 프로젝트 정보를 입력합니다.

```env
NEXT_PUBLIC_SUPABASE_URL=https://프로젝트주소.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=anon-key
```

Supabase의 Authentication > Providers에서 Email 로그인을 활성화합니다.
테스트 회원은 Authentication > Users에서 생성할 수 있습니다.

## v4 로그인 후 대시보드

- 좌측 고정 메뉴
- 로그인 회원명 및 이메일 표시
- 진행 현황 요약 카드
- 빠른 실행 메뉴
- 진행 중인 마케팅 목록
- 최근 활동
- 모바일 사이드 메뉴

## v10 회원별 포인트 시스템 설정

1. Supabase 프로젝트에서 **SQL Editor**를 엽니다.
2. 프로젝트의 `supabase/migrations/001_points_system.sql` 파일 내용을 전부 복사합니다.
3. SQL Editor에 붙여넣고 **Run**을 누릅니다.
4. 개발 서버를 다시 시작합니다.

이 SQL은 다음 항목을 생성합니다.

- 회원 프로필 및 실제 포인트 잔액
- 포인트 충전·사용·환불·관리자 조정 내역
- 신규 회원 0P 자동 생성
- 기존 가입 회원 0P 일괄 생성
- 회원이 자기 포인트와 자기 내역만 조회하도록 RLS 적용

PG 결제는 아직 연결하지 않았기 때문에 결제 버튼은 안내만 표시합니다. 다음 PG 연동 단계에서 결제 승인 후 포인트와 거래 내역을 서버에서 동시에 반영해야 합니다.
