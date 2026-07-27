import time
import datetime
import random
import os
import subprocess
import tempfile
from sqlalchemy.orm import Session
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from database import SessionLocal, UserAccount, AccountSetting, TaskLog, ProxyPool

VISITED_POSTS = set()

def create_secured_driver(proxy_info=None, insta_id="default"):
    chrome_path = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
    if not os.path.exists(chrome_path):
        chrome_path = r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
    
    safe_id_dir = "".join(c for c in insta_id if c.isalnum() or c in ('_', '-'))
    user_data_dir = os.path.join(tempfile.gettempdir(), f"insta_chrome_profile_{safe_id_dir}")
    
    port_offset = abs(hash(insta_id)) % 100
    debug_port = 9555 + port_offset
    
    MOBILE_AGENT = "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1"
    
    cmd = f'"{chrome_path}" --remote-debugging-port={debug_port} --user-data-dir="{user_data_dir}" "https://www.instagram.com/accounts/login/" --window-size=440,950 --user-agent="{MOBILE_AGENT}" --lang=ko_KR --disable-crash-reporter --log-level=3'
    if proxy_info and getattr(proxy_info, 'ip_port', None):
        cmd += f' --proxy-server="http://{proxy_info.ip_port}"'
        
    subprocess.Popen(cmd, shell=True)
    time.sleep(4.0)

    chrome_options = Options()
    chrome_options.add_experimental_option("debuggerAddress", f"127.0.0.1:{debug_port}")
    
    for env_key in ["webdriver.chrome.driver", "PATH"]:
        if env_key in os.environ and env_key != "PATH": 
            del os.environ[env_key]

    driver = webdriver.Chrome(options=chrome_options)
    return driver

def human_scroll_simulation(driver, duration=3):
    start_time = time.time()
    while time.time() - start_time < duration:
        try:
            driver.execute_script(f"window.scrollBy(0, {random.randint(100, 220)});")
            time.sleep(random.uniform(1.5, 3.0))
        except Exception: 
            break

def update_schedule_log(db, account_id, max_likes, max_follows, max_comments, done_likes, done_follows, done_comments):
    existing_sched = db.query(TaskLog).filter(
        TaskLog.account_id == account_id, 
        TaskLog.task_type.in_(["📊 SCHEDULE", "SCHEDULE", "schedule"])
    ).first()
    
    msg = f"좋아요: {done_likes}/{max_likes}개 | 선팔로우: {done_follows}/{max_follows}개 | 댓글마케팅: {done_comments}/{max_comments}개"
    
    if existing_sched:
        existing_sched.task_type = "📊 SCHEDULE"
        existing_sched.message = msg
        existing_sched.created_at = datetime.datetime.utcnow()
    else:
        new_log = TaskLog(
            account_id=account_id,
            task_type="📊 SCHEDULE",
            message=msg
        )
        db.add(new_log)
    db.commit()

def run_instagram_automation(insta_id: str):
    db = SessionLocal()
    account = None
    driver = None
    try:
        account = db.query(UserAccount).filter(UserAccount.insta_id == insta_id).first()
        if not account or not account.is_active: 
            return
            
        proxy_info = account.proxy
        proxy_log_prefix = f"[{proxy_info.ip_port}] " if proxy_info and getattr(proxy_info, 'ip_port', None) else "[로컬IP] "
        
        account.status_msg = "🌐 안전 모바일 브라우저 가동 중..."
        db.commit()
        
        driver = create_secured_driver(proxy_info, insta_id=insta_id)
        
        account.status_msg = "🔒 로그인 세션 확인 중..."
        db.commit()
        
        if "instagram.com" not in driver.current_url:
            driver.execute_script("window.location.href = 'https://www.instagram.com/accounts/login/';")
        
        try:
            id_input = WebDriverWait(driver, 6).until(EC.visibility_of_element_located((By.NAME, "username")))
            pw_input = driver.find_element(By.NAME, "password")
            id_input.click()
            time.sleep(0.8)
            for char in insta_id:
                id_input.send_keys(char)
                time.sleep(0.04)
            time.sleep(0.5)
            for char in account.insta_pw:
                pw_input.send_keys(char)
                time.sleep(0.04)
            pw_input.send_keys(Keys.ENTER)
        except Exception: 
            pass
        
        account.status_msg = "🏠 메인 피드 진입 완료"
        db.commit()
        time.sleep(5.0)

        last_reset_date = datetime.date.today()
        keyword_index = 0

        while True:
            db.refresh(account)
            if not account or not account.is_active: 
                break
                
            settings = account.settings
            if not settings:
                time.sleep(5)
                continue
            
            if datetime.date.today() != last_reset_date:
                VISITED_POSTS.clear()
                last_reset_date = datetime.date.today()
            
            today_start = datetime.datetime.combine(datetime.date.today(), datetime.time.min)
            
            done_likes = db.query(TaskLog).filter(
                TaskLog.account_id == account.id, 
                TaskLog.task_type.in_(["FEED_LIKE", "SEARCH_LIKE"]), 
                TaskLog.created_at >= today_start
            ).count()
            
            done_follows = db.query(TaskLog).filter(
                TaskLog.account_id == account.id, 
                TaskLog.task_type.in_(["SEARCH_FOLLOW", "FEED_FOLLOW"]), 
                TaskLog.created_at >= today_start
            ).count()
            
            done_comments = db.query(TaskLog).filter(
                TaskLog.account_id == account.id, 
                TaskLog.task_type.in_(["COMMENT"]), 
                TaskLog.created_at >= today_start
            ).count()

            max_likes = settings.feed_like_limit + settings.search_like_limit
            max_follows = settings.feed_follow_limit + settings.search_follow_limit
            max_comments = settings.comment_daily_limit

            update_schedule_log(db, account.id, max_likes, max_follows, max_comments, done_likes, done_follows, done_comments)

            possible = []
            if settings.like_enabled and done_likes < max_likes: 
                possible.append("like")
            if settings.follow_enabled and done_follows < max_follows: 
                possible.append("follow")
            if settings.comment_enabled and done_comments < max_comments: 
                possible.append("comment")
            
            if not possible:
                account.status_msg = "🎉 일일 설정 수량 완수, 대기 중"
                db.commit()
                time.sleep(60)
                continue
            
            action = random.choice(possible)
            
            if action == "like" and random.random() < 0.25:
                account.status_msg = "🏠 홈 피드 소통 중..."
                db.commit()
                driver.get("https://www.instagram.com/")
                time.sleep(4)
                human_scroll_simulation(driver, 5)
                hearts = driver.find_elements(By.XPATH, "//*[local-name()='svg' and (@aria-label='좋아요' or @aria-label='Like')]")
                if hearts:
                    try:
                        driver.execute_script("arguments[0].dispatchEvent(new MouseEvent('click', {bubbles: true}));", hearts[0])
                        db.add(TaskLog(account_id=account.id, task_type="FEED_LIKE", message=f"{proxy_log_prefix}홈 피드 좋아요 소통"))
                        db.commit()
                    except Exception: 
                        pass
            else:
                kw_list = [k.strip() for k in settings.like_keywords.split(",") if k.strip()]
                if not kw_list:
                    time.sleep(5)
                    continue
                
                if keyword_index >= len(kw_list): 
                    keyword_index = 0
                kw = kw_list[keyword_index]
                keyword_index = (keyword_index + 1) % len(kw_list)
                
                db.add(TaskLog(
                    account_id=account.id,
                    task_type="SEARCH_TAG",
                    message=f"{proxy_log_prefix}#{kw} 태그 검색 탐색"
                ))
                db.commit()

                account.status_msg = f"🔍 #{kw} 탐색 및 소통 중..."
                db.commit()
                driver.get(f"https://www.instagram.com/explore/tags/{kw}/")
                time.sleep(4)
                
                action_performed = False
                attempt_count = 0
                
                while not action_performed and attempt_count < 4:
                    attempt_count += 1
                    human_scroll_simulation(driver, duration=2)
                    posts = driver.find_elements(By.XPATH, "//a[contains(@href, '/p/') or contains(@href, '/reel/')]")
                    
                    target_post = None
                    for p in posts:
                        try:
                            url = p.get_attribute("href")
                            if url and url not in VISITED_POSTS:
                                target_post = p
                                VISITED_POSTS.add(url)
                                break
                        except Exception:
                            continue
                    
                    if not target_post:
                        driver.execute_script("window.scrollBy(0, 500);")
                        time.sleep(2)
                        continue
                    
                    try:
                        driver.execute_script("arguments[0].click();", target_post)
                        time.sleep(3.0)
                        human_scroll_simulation(driver, 2)
                        
                        if action == "like":
                            try:
                                heart_svg = driver.find_element(By.XPATH, "//*[local-name()='svg' and (@aria-label='좋아요' or @aria-label='Like')]")
                                fill_color = heart_svg.get_attribute("fill")
                                is_already_liked = False
                                if fill_color and fill_color.lower() not in ["#262626", "rgb(38, 38, 38)", "none"]:
                                    is_already_liked = True

                                if is_already_liked:
                                    driver.execute_script("window.history.back();")
                                    time.sleep(1.5)
                                    continue
                                    
                                driver.execute_script("arguments[0].dispatchEvent(new MouseEvent('click', {bubbles: true}));", heart_svg)
                                db.add(TaskLog(account_id=account.id, task_type="SEARCH_LIKE", message=f"{proxy_log_prefix}#{kw} 게시물 좋아요 성공"))
                                db.commit()
                                action_performed = True
                            except Exception: 
                                pass
                                
                        elif action == "follow":
                            try:
                                f = driver.find_element(By.XPATH, "//button[contains(., '팔로우') or contains(., 'Follow')]")
                                btn_text = f.text.strip()
                                if "팔로잉" in btn_text or "Following" in btn_text or "Requested" in btn_text or "요청됨" in btn_text:
                                    driver.execute_script("window.history.back();")
                                    time.sleep(1.5)
                                    continue
                                    
                                driver.execute_script("arguments[0].click();", f)
                                db.add(TaskLog(account_id=account.id, task_type="SEARCH_FOLLOW", message=f"{proxy_log_prefix}#{kw} 계정 선팔로우 성공"))
                                db.commit()
                                action_performed = True
                            except Exception: 
                                pass
                                
                        elif action == "comment":
                            try:
                                c = None
                                comment_selectors = [
                                    "//textarea[contains(@placeholder, '댓글') or @aria-label='댓글 달기...']",
                                    "//div[@contenteditable='true' and (contains(@aria-label, '댓글') or contains(@placeholder, '댓글'))]",
                                    "//textarea"
                                ]
                                for sel in comment_selectors:
                                    try:
                                        c = WebDriverWait(driver, 3).until(EC.presence_of_element_located((By.XPATH, sel)))
                                        if c: break
                                    except:
                                        continue
                                
                                if c:
                                    driver.execute_script("arguments[0].scrollIntoView(true);", c)
                                    time.sleep(0.8)
                                    
                                    templates = [t.strip() for t in settings.comment_templates.split("\n") if t.strip()]
                                    if not templates:
                                        templates = ["좋아요 누르고 갑니다! 소통해요 😊"]
                                    chosen_comment = random.choice(templates)
                                    
                                    c.click()
                                    time.sleep(0.8)
                                    c.send_keys(chosen_comment)
                                    time.sleep(1.0)
                                    
                                    posted = False
                                    try:
                                        submit_btn = WebDriverWait(driver, 3).until(
                                            EC.element_to_be_clickable((By.XPATH, "//button[contains(., '게시') or contains(., 'Post')]"))
                                        )
                                        driver.execute_script("arguments[0].click();", submit_btn)
                                        posted = True
                                    except Exception:
                                        c.send_keys(Keys.ENTER)
                                        posted = True
                                        
                                    if posted:
                                        time.sleep(3.0)
                                        db.add(TaskLog(account_id=account.id, task_type="COMMENT", message=f"{proxy_log_prefix}#{kw} 댓글 마케팅 성공: {chosen_comment[:15]}..."))
                                        db.commit()
                                        action_performed = True
                            except Exception as ex:
                                print(f"댓글 작성 중 예외: {ex}")
                                pass
                                
                        try: 
                            driver.execute_script("window.history.back();")
                        except: 
                            pass
                        time.sleep(1.5)
                    except Exception:
                        try: 
                            driver.execute_script("window.history.back();")
                        except: 
                            pass
                
            wait = random.randint(35, 85)
            
            account.status_msg = f"💤 안전 페이스 휴식 중... ({wait}초)"
            db.commit()
            
            rest_elapsed = 0
            while rest_elapsed < wait:
                db.refresh(account)
                if not account or not account.is_active: 
                    break
                
                chunk = min(15, wait - rest_elapsed)
                time.sleep(chunk)
                rest_elapsed += chunk
                
                remaining_time = wait - rest_elapsed
                if remaining_time > 0:
                    account.status_msg = f"💤 안전 페이스 휴식 중... ({remaining_time}초)"
                    db.commit()
                
                try:
                    if driver:
                        driver.execute_script(f"window.scrollBy(0, {random.randint(-30, 50)});")
                except Exception:
                    break
                    
    except Exception as e:
        print(f"❌ 엔진 종료: {str(e)}")
        if account:
            account.status_msg = f"❌ 오류 발생: {str(e)[:20]}"
            db.commit()
    finally:
        if driver:
            try:
                driver.quit()
            except Exception:
                pass
        if account:
            account.is_active = False
            account.status_msg = "🛑 중지됨 (대기 중)"
            db.commit()
        db.close()