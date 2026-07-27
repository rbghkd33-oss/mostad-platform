import datetime
# 🌟 [오타 완벽 수정] create_all 제거하고 깔끔하게 create_engine부터 임포트되도록 교정했습니다!
from sqlalchemy import create_engine, Column, Integer, String, Boolean, DateTime, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship

# 1. SQLite 로컬 데이터베이스 파일 연결 경로 설정
DATABASE_URL = "sqlite:///./api_scheduler.db"

engine = create_engine(
    DATABASE_URL, 
    connect_args={"check_same_thread": False} # 다중 스레드(FastAPI 독립 스레드) 간섭 방지 필수 옵션
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# ==================== [ 1. 마스터 프록시 풀 테이블 ] ====================
class ProxyPool(Base):
    __tablename__ = "proxy_pool"

    id = Column(Integer, primary_key=True, index=True)
    ip_port = Column(String, unique=True, nullable=False, index=True) # 예: 123.45.67.89:8080
    proxy_user = Column(String, nullable=True) # 프록시 인증 아이디 (없으면 Null)
    proxy_pass = Column(String, nullable=True) # 프록시 인증 패스워드 (없으면 Null)
    memo = Column(String, nullable=True)       # 프록시 대여 업체나 번호 식별 메모
    is_working = Column(Boolean, default=True) # 장비 고장 여부 체킹
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # 1:1 관계 - 프록시 하나는 인스타 계정 하나에만 독점 할당
    assigned_account = relationship("UserAccount", back_populates="proxy", uselist=False)


# ==================== [ 2. 인스타그램 계정 테이블 ] ====================
class UserAccount(Base):
    __tablename__ = "user_accounts"

    id = Column(Integer, primary_key=True, index=True)
    insta_id = Column(String, unique=True, nullable=False, index=True)
    insta_pw = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    subscription_expiry = Column(DateTime, nullable=True) # SaaS 결제 구독 만료일
    status = Column(String, default="active")            # active, expired, banned 등
    
    # 실시간 프론트엔드 연동용 상태값들
    is_active = Column(Boolean, default=False)           # 현재 매크로 가동 여부 스위치
    status_msg = Column(String, default="정지됨")          # 대시보드에 표시할 실시간 한글 상태문구
    needs_2fa = Column(Boolean, default=False)           # 2단계 인증 활성화 브레이크 팝업 신호
    security_code = Column(String, nullable=True)        # 사용자가 대시보드에 입력할 6자리 번호 보관소

    # 외래키 - 프록시 풀 장비와 다이렉트 연결 연동
    proxy_id = Column(Integer, ForeignKey("proxy_pool.id", ondelete="SET NULL"), nullable=True)

    proxy = relationship("ProxyPool", back_populates="assigned_account")
    settings = relationship("AccountSetting", back_populates="account", uselist=False, cascade="all, delete-orphan")
    logs = relationship("TaskLog", back_populates="account", cascade="all, delete-orphan")


# ==================== [ 3. 타겟 소통 한도 설정 테이블 ] ====================
class AccountSetting(Base):
    __tablename__ = "account_settings"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("user_accounts.id", ondelete="CASCADE"))

    # [👤 선팔로우 파트]
    follow_enabled = Column(Boolean, default=False)
    follow_keywords = Column(String, default="소통,맞팔,일상")
    feed_follow_limit = Column(Integer, default=10)
    search_follow_limit = Column(Integer, default=10)

    # [❤️ 좋아요 파트]
    like_enabled = Column(Boolean, default=False)
    like_keywords = Column(String, default="소통,맞팔,일상")
    feed_like_limit = Column(Integer, default=25)
    search_like_limit = Column(Integer, default=25)

    # [👁️ 스토리 자동 시청 파트]
    story_enabled = Column(Boolean, default=False)
    story_daily_limit = Column(Integer, default=30)

    # [💬 소통 댓글 파트]
    comment_enabled = Column(Boolean, default=False)
    comment_daily_limit = Column(Integer, default=5) # 🌟 컬럼 추가 완료
    comment_templates = Column(Text, default="좋은 하루 보내세요! 😊\n소통하고 지내요!")

    account = relationship("UserAccount", back_populates="settings")


# ==================== [ 4. 대시보드 출력용 마케팅 로그 테이블 ] ====================
class TaskLog(Base):
    __tablename__ = "task_logs"

    id = Column(Integer, primary_key=True, index=True)
    account_id = Column(Integer, ForeignKey("user_accounts.id", ondelete="CASCADE"))
    task_type = Column(String, nullable=False) # feed_like, search_follow, comment 등
    target_id = Column(String, nullable=True)   # 소통을 걸어둔 상대방 인스타 ID
    status = Column(String, default="success") # success, failed
    message = Column(Text, nullable=False)     # 로깅 메시지 본문
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    account = relationship("UserAccount", back_populates="logs")


# ==================== [ DB 빌드 컴파일 실행부 ] ====================
if __name__ == "__main__":
    print("⏳ 새로 개편된 테이블 컬럼 정보를 기반으로 데이터베이스 엔진을 초기화하는 중...")
    Base.metadata.create_all(bind=engine)
    print("✅ [설계 완료] 인스타 자동화 구조의 데이터베이스 설계 및 comment_daily_limit 컬럼 생성이 완벽히 성공했습니다!")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()