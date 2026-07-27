import datetime
import hmac
import os
import threading
from fastapi import FastAPI, Depends, Header, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import func, text
from sqlalchemy.orm import Session
from dotenv import load_dotenv

load_dotenv()

from database import SessionLocal, UserAccount, AccountSetting, TaskLog, ProxyPool, get_db
from tasks import run_instagram_automation

app = FastAPI(title="Instagram Automation API", version="1.0.0")

# CORS 설정
ALLOWED_ORIGINS = os.getenv("ALLOWED_ORIGINS", "https://mplatform.kr,https://www.mplatform.kr,http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in ALLOWED_ORIGINS if o.strip()],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

API_KEY = os.getenv("INSTAGRAM_AUTOMATION_API_KEY", "").strip()

# 전역 스레드 관리 딕셔너리
ACTIVE_THREADS: dict[str, threading.Thread] = {}

# API Key 인증 함수
def verify_api_key(x_api_key: str | None = Header(None, alias="X-API-Key")):
    if not API_KEY or not x_api_key or not hmac.compare_digest(x_api_key, API_KEY):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid API key"
        )

# 계정 아이디 정규화 함수
def normalize_insta_id(insta_id: str) -> str:
    return (insta_id or "").strip().lstrip("@").lower()

def normalized_insta_column():
    return func.lower(
        func.replace(
            func.trim(UserAccount.insta_id),
            "@",
            ""
        )
    )

def get_account_by_clean_id(db: Session, insta_id: str):
    clean_id = normalize_insta_id(insta_id)
    return db.query(UserAccount).filter(normalized_insta_column() == clean_id).first()

# 상태 코드 판정 로직
def determine_status_code(account: UserAccount) -> str:
    if account.needs_2fa:
        return "TWO_FACTOR_REQUIRED"
    
    if account.status and account.status.lower() == "banned":
        return "ERROR"
    
    if account.subscription_expiry:
        try:
            if isinstance(account.subscription_expiry, str):
                exp_dt = datetime.datetime.fromisoformat(account.subscription_expiry)
            else:
                exp_dt = account.subscription_expiry
            if exp_dt < datetime.datetime.utcnow():
                return "COMPLETED"
        except Exception:
            pass

    if account.status and account.status.lower() == "expired":
        return "COMPLETED"

    msg = (account.status_msg or "").lower()
    if "로그인" in msg or "login" in msg:
        return "LOGIN_REQUIRED"
    if "오류" in msg or "실패" in msg or "error" in msg or "fail" in msg:
        return "ERROR"
    if "완료" in msg or "완수" in msg:
        return "WAITING"

    if account.is_active:
        return "RUNNING"
    
    return "PAUSED"

# --- [헬스체크] ---

@app.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        return {
            "status": "ok",
            "service": "instagram-automation",
            "version": "1.0.0",
            "database_ready": True
        }
    except Exception:
        return JSONResponse(
            status_code=503,
            content={
                "status": "degraded",
                "service": "instagram-automation",
                "version": "1.0.0",
                "database_ready": False
            }
        )

# --- [외부 연동 API (인증 필수)] ---

@app.get("/api/external/accounts/{insta_id}/schedule", dependencies=[Depends(verify_api_key)])
def external_get_account_schedule(insta_id: str, db: Session = Depends(get_db)):
    account = get_account_by_clean_id(db, insta_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    setting = db.query(AccountSetting).filter(AccountSetting.account_id == account.id).first()
    
    UTC = datetime.timezone.utc
    KST = datetime.timezone(datetime.timedelta(hours=9))
    now_kst = datetime.datetime.now(KST)
    today_kst = datetime.datetime(now_kst.year, now_kst.month, now_kst.day, tzinfo=KST)
    tomorrow_kst = today_kst + datetime.timedelta(days=1)
    utc_start = today_kst.astimezone(UTC).replace(tzinfo=None)
    utc_end = tomorrow_kst.astimezone(UTC).replace(tzinfo=None)

    logs = db.query(TaskLog).filter(
        TaskLog.account_id == account.id,
        TaskLog.created_at >= utc_start,
        TaskLog.created_at < utc_end,
        func.lower(TaskLog.status) == "success"
    ).all()

    likes_done = 0
    follows_done = 0
    comments_done = 0
    stories_done = 0

    for l in logs:
        t_type = (l.task_type or "").lower()
        if t_type in ["feed_like", "search_like", "❤️ 피드 좋아요"]:
            likes_done += 1
        elif t_type in ["feed_follow", "search_follow", "➕ 피드 팔로우"]:
            follows_done += 1
        elif t_type in ["comment", "💬 댓글 작성"]:
            comments_done += 1
        elif t_type in ["story_view", "👀 스토리 조회"]:
            stories_done += 1

    likes_limit = 50
    follows_limit = 20
    comments_limit = 5
    stories_limit = 30

    if setting:
        likes_limit = (setting.feed_like_limit or 0) + (setting.search_like_limit or 0) or 50
        follows_limit = (setting.feed_follow_limit or 0) + (setting.search_follow_limit or 0) or 20
        comments_limit = setting.comment_daily_limit or 5
        stories_limit = setting.story_daily_limit or 30

    status_code = determine_status_code(account)
    updated_at_iso = datetime.datetime.now(KST).isoformat()

    return {
        "insta_id": account.insta_id,
        "is_active": bool(account.is_active),
        "status_code": status_code,
        "status_msg": account.status_msg or "",
        "updated_at": updated_at_iso,
        "progress": {
            "likes": {"done": likes_done, "limit": likes_limit},
            "follows": {"done": follows_done, "limit": follows_limit},
            "comments": {"done": comments_done, "limit": comments_limit},
            "stories": {"done": stories_done, "limit": stories_limit}
        }
    }

@app.get("/api/external/accounts/{insta_id}/logs", dependencies=[Depends(verify_api_key)])
def external_get_account_logs(insta_id: str, db: Session = Depends(get_db)):
    account = get_account_by_clean_id(db, insta_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    raw_logs = db.query(TaskLog).filter(
        TaskLog.account_id == account.id,
        TaskLog.task_type.notin_(["📊 SCHEDULE", "SCHEDULE", "schedule"])
    ).order_by(TaskLog.id.desc()).limit(30).all()

    UTC = datetime.timezone.utc
    KST = datetime.timezone(datetime.timedelta(hours=9))
    
    result = []
    for log in raw_logs:
        dt_kst = datetime.datetime.now(KST)
        if log.created_at:
            if log.created_at.tzinfo is None:
                dt_utc = log.created_at.replace(tzinfo=UTC)
            else:
                dt_utc = log.created_at.astimezone(UTC)
            dt_kst = dt_utc.astimezone(KST)

        is_success = (log.status or "").lower() == "success"
        result.append({
            "id": log.id,
            "task_type": log.task_type,
            "message": log.message or "",
            "success": is_success,
            "created_at": dt_kst.isoformat(),
            "time": dt_kst.strftime("%p %I:%M:%S")
        })

    return result


# --- [기존 관리 및 내부 API] ---

@app.get("/api/accounts/list")
def list_accounts(db: Session = Depends(get_db)):
    accounts = db.query(UserAccount).all()
    res = []
    for acc in accounts:
        proxy_val = acc.proxy.ip_port if getattr(acc, "proxy", None) else "프록시 없음"
        res.append({
            "id": acc.id,
            "insta_id": acc.insta_id,
            "is_active": acc.is_active,
            "status": acc.status,
            "status_msg": acc.status_msg,
            "needs_2fa": acc.needs_2fa,
            "proxy": proxy_val
        })
    return res

class ProxyCreate(BaseModel):
    ip_port: str

@app.post("/api/proxy/add")
def add_proxy(data: ProxyCreate, db: Session = Depends(get_db)):
    existing = db.query(ProxyPool).filter(ProxyPool.ip_port == data.ip_port).first()
    if existing:
        return {"status": "success", "id": existing.id, "message": "Proxy already exists"}
    new_proxy = ProxyPool(ip_port=data.ip_port)
    db.add(new_proxy)
    db.commit()
    db.refresh(new_proxy)
    return {"status": "success", "id": new_proxy.id}

class AccountCreate(BaseModel):
    insta_id: str
    insta_pw: str
    proxy_ip_port: str | None = None

@app.post("/api/accounts/add")
def add_account(data: AccountCreate, db: Session = Depends(get_db)):
    clean_id = normalize_insta_id(data.insta_id)
    if not clean_id:
        raise HTTPException(status_code=400, detail="Invalid insta_id")
    
    existing = get_account_by_clean_id(db, clean_id)
    if existing:
        raise HTTPException(status_code=400, detail="Account already exists")

    proxy_id = None
    if data.proxy_ip_port:
        p_obj = db.query(ProxyPool).filter(ProxyPool.ip_port == data.proxy_ip_port).first()
        if not p_obj:
            p_obj = ProxyPool(ip_port=data.proxy_ip_port)
            db.add(p_obj)
            db.commit()
            db.refresh(p_obj)
        proxy_id = p_obj.id

    new_acc = UserAccount(
        insta_id=clean_id,
        insta_pw=data.insta_pw,
        proxy_id=proxy_id,
        is_active=False,
        status="PENDING",
        status_msg="대기 중"
    )
    db.add(new_acc)
    db.commit()
    db.refresh(new_acc)

    default_setting = AccountSetting(account_id=new_acc.id)
    db.add(default_setting)
    db.commit()

    return {"status": "success", "id": new_acc.id}

@app.delete("/api/accounts/{insta_id}/delete")
def delete_account(insta_id: str, db: Session = Depends(get_db)):
    account = get_account_by_clean_id(db, insta_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    
    clean_id = account.insta_id
    
    # 1. 활성화 상태 해제 및 스레드 제거
    account.is_active = False
    account.status_msg = "삭제됨"
    db.commit()

    if clean_id in ACTIVE_THREADS:
        del ACTIVE_THREADS[clean_id]

    # 2. 관련 설정 및 로그 삭제 후 계정 삭제
    db.query(AccountSetting).filter(AccountSetting.account_id == account.id).delete()
    db.query(TaskLog).filter(TaskLog.account_id == account.id).delete()
    db.delete(account)
    db.commit()

    return {"status": "success"}

@app.get("/api/accounts/{insta_id}/settings")
def get_account_settings(insta_id: str, db: Session = Depends(get_db)):
    account = get_account_by_clean_id(db, insta_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    setting = db.query(AccountSetting).filter(AccountSetting.account_id == account.id).first()
    if not setting:
        setting = AccountSetting(account_id=account.id)
        db.add(setting)
        db.commit()
        db.refresh(setting)
    
    return {
        "follow_enabled": getattr(setting, "follow_enabled", False),
        "follow_keywords": getattr(setting, "follow_keywords", ""),
        "feed_follow_limit": getattr(setting, "feed_follow_limit", 10),
        "search_follow_limit": getattr(setting, "search_follow_limit", 10),
        "like_enabled": getattr(setting, "like_enabled", True),
        "like_keywords": getattr(setting, "like_keywords", ""),
        "feed_like_limit": getattr(setting, "feed_like_limit", 25),
        "search_like_limit": getattr(setting, "search_like_limit", 25),
        "story_enabled": getattr(setting, "story_enabled", True),
        "story_daily_limit": getattr(setting, "story_daily_limit", 30),
        "comment_enabled": getattr(setting, "comment_enabled", False),
        "comment_daily_limit": getattr(setting, "comment_daily_limit", 5),
        "comment_templates": getattr(setting, "comment_templates", ""),
    }

@app.post("/api/accounts/{insta_id}/settings/update")
def update_account_settings(insta_id: str, data: dict, db: Session = Depends(get_db)):
    account = get_account_by_clean_id(db, insta_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")
    setting = db.query(AccountSetting).filter(AccountSetting.account_id == account.id).first()
    if not setting:
        setting = AccountSetting(account_id=account.id)
        db.add(setting)
    
    for key, value in data.items():
        if hasattr(setting, key):
            setattr(setting, key, value)
    db.commit()
    return {"status": "success"}

def worker_wrapper(insta_id: str):
    try:
        run_instagram_automation(insta_id)
    except Exception as e:
        print(f"Worker error for {insta_id}: {e}")
    finally:
        if insta_id in ACTIVE_THREADS:
            del ACTIVE_THREADS[insta_id]

@app.post("/api/scheduler/start")
def start_scheduler(insta_id: str = Query(...), db: Session = Depends(get_db)):
    account = get_account_by_clean_id(db, insta_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    clean_id = account.insta_id
    if clean_id in ACTIVE_THREADS and ACTIVE_THREADS[clean_id].is_alive():
        return {"status": "already running"}

    account.is_active = True
    account.status_msg = "가동 준비 중"
    db.commit()

    t = threading.Thread(
        target=worker_wrapper,
        args=(clean_id,),
        daemon=True
    )
    ACTIVE_THREADS[clean_id] = t
    t.start()
    return {"status": "scheduler started", "insta_id": clean_id}

@app.post("/api/scheduler/stop")
def stop_scheduler(insta_id: str = Query(...), db: Session = Depends(get_db)):
    account = get_account_by_clean_id(db, insta_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    clean_id = account.insta_id
    account.is_active = False
    account.status_msg = "중지됨"
    db.commit()

    if clean_id in ACTIVE_THREADS:
        del ACTIVE_THREADS[clean_id]

    return {"status": "scheduler stopped", "insta_id": clean_id}

@app.get("/api/accounts/{insta_id}/logs")
def internal_get_account_logs(insta_id: str, db: Session = Depends(get_db)):
    account = get_account_by_clean_id(db, insta_id)
    if not account:
        raise HTTPException(status_code=404, detail="Account not found")

    raw_logs = db.query(TaskLog).filter(
        TaskLog.account_id == account.id
    ).order_by(TaskLog.id.desc()).limit(30).all()

    UTC = datetime.timezone.utc
    KST = datetime.timezone(datetime.timedelta(hours=9))
    
    result = []
    for log in raw_logs:
        dt_kst = datetime.datetime.now(KST)
        if log.created_at:
            if log.created_at.tzinfo is None:
                dt_utc = log.created_at.replace(tzinfo=UTC)
            else:
                dt_utc = log.created_at.astimezone(UTC)
            dt_kst = dt_utc.astimezone(KST)

        result.append({
            "task_type": log.task_type or "작업",
            "message": log.message or "",
            "time": dt_kst.strftime("%p %I:%M:%S")
        })

    return result

# --- [홈페이지 서버 전용 관리 API: X-API-Key 필수] ---
# 기존 로컬 관리 API는 그대로 유지하고, 공개 터널을 통한 홈페이지 연동은 아래 경로만 사용합니다.

@app.post("/api/external/admin/accounts/add", dependencies=[Depends(verify_api_key)])
def external_admin_add_account(data: AccountCreate, db: Session = Depends(get_db)):
    return add_account(data, db)

@app.post("/api/external/admin/accounts/{insta_id}/settings", dependencies=[Depends(verify_api_key)])
def external_admin_update_settings(insta_id: str, data: dict, db: Session = Depends(get_db)):
    return update_account_settings(insta_id, data, db)

@app.post("/api/external/admin/accounts/{insta_id}/start", dependencies=[Depends(verify_api_key)])
def external_admin_start(insta_id: str, db: Session = Depends(get_db)):
    return start_scheduler(insta_id, db)

@app.post("/api/external/admin/accounts/{insta_id}/stop", dependencies=[Depends(verify_api_key)])
def external_admin_stop(insta_id: str, db: Session = Depends(get_db)):
    return stop_scheduler(insta_id, db)

@app.delete("/api/external/admin/accounts/{insta_id}", dependencies=[Depends(verify_api_key)])
def external_admin_delete(insta_id: str, db: Session = Depends(get_db)):
    return delete_account(insta_id, db)

