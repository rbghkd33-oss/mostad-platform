import { SolapiMessageService } from "solapi";

function env(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} 환경변수가 없습니다.`);
  return value;
}

function phone(value: string) {
  return value.replace(/\D/g, "");
}

function service() {
  return new SolapiMessageService(env("SOLAPI_API_KEY"), env("SOLAPI_API_SECRET"));
}

const from = () => phone(env("SOLAPI_FROM_NUMBER"));
const pfId = () => env("SOLAPI_KAKAO_PF_ID");

export async function sendCustomerPointUseAlimtalk(input: {
  to: string;
  customerName: string;
  productName: string;
  usedPoints: number;
  remainingPoints: number;
  processedAt: string;
}) {
  return service().send({
    to: phone(input.to),
    from: from(),
    kakaoOptions: {
      pfId: pfId(),
      templateId: env("SOLAPI_CUSTOMER_TEMPLATE_ID"),
      disableSms: true,
      variables: {
        "#{고객명}": input.customerName,
        "#{상품명}": input.productName,
        "#{사용포인트}": input.usedPoints.toLocaleString("ko-KR"),
        "#{잔여포인트}": input.remainingPoints.toLocaleString("ko-KR"),
        "#{처리일시}": input.processedAt,
      },
    },
  });
}

export async function sendAdminOrderAlimtalk(input: {
  customerName: string;
  companyName: string;
  productName: string;
  usedPoints: number;
  requestedAt: string;
}) {
  const targets = (process.env.ADMIN_PHONE_NUMBERS ?? "")
    .split(",")
    .map(phone)
    .filter(Boolean);

  if (!targets.length) throw new Error("ADMIN_PHONE_NUMBERS 환경변수가 없습니다.");

  return Promise.allSettled(
    targets.map((to) =>
      service().send({
        to,
        from: from(),
        kakaoOptions: {
          pfId: pfId(),
          templateId: env("SOLAPI_ADMIN_TEMPLATE_ID"),
          disableSms: true,
          variables: {
            "#{고객명}": input.customerName,
            "#{업체명}": input.companyName,
            "#{상품명}": input.productName,
            "#{사용포인트}": input.usedPoints.toLocaleString("ko-KR"),
            "#{신청일시}": input.requestedAt,
          },
        },
      }),
    ),
  );
}

export async function sendInstagramApprovedAlimtalk(input: {
  to: string;
  customerName: string;
  instagramUsername: string;
  startDate: string;
  endDate: string;
}) {
  const toPhone = phone(input.to);

  if (!toPhone) {
    throw new Error("고객 연락처가 없습니다.");
  }

  return service().send({
    to: toPhone,
    from: from(),
    kakaoOptions: {
      pfId: pfId(),
      templateId: env("SOLAPI_INSTAGRAM_APPROVED_TEMPLATE_ID"),
      disableSms: true,
      variables: {
        "#{고객명}": input.customerName,
        "#{인스타계정}": input.instagramUsername,
        "#{시작일}": input.startDate,
        "#{종료일}": input.endDate,
      },
    },
  });
}
