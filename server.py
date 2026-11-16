"""DPL302 local server. Run: python server.py"""
import argparse
import hashlib
import hmac
from http.cookies import CookieError, SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import re
import secrets
import threading
import time
from urllib.parse import parse_qs, urlsplit
from database import connection, DATABASE_ERRORS, INTEGRITY_ERRORS, DatabaseConfigurationError

ROOT = Path(__file__).resolve().parent
DB_PATH = Path(os.environ.get("DPL302_DB", ROOT / "data" / "study.sqlite3"))
DATABASE_URL = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")
_database_ready = False
_database_lock = threading.Lock()


def connect():
    return connection(DB_PATH, DATABASE_URL, cloud=os.environ.get('VERCEL') == '1')


def init_db():
    if not DATABASE_URL and os.environ.get('VERCEL') != '1':
        DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    with connect() as db:
        schema = """
            PRAGMA journal_mode = WAL;
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE COLLATE NOCASE,
                salt TEXT NOT NULL, password_hash TEXT NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS sessions (
                token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
                expires_at INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS attempts (
                id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id),
                event_id TEXT NOT NULL, mode TEXT NOT NULL CHECK(mode IN ('practice','test')),
                created_at INTEGER NOT NULL, total INTEGER NOT NULL, correct INTEGER NOT NULL,
                UNIQUE(user_id, event_id)
            );
            CREATE INDEX IF NOT EXISTS attempts_user ON attempts(user_id, id DESC);
            CREATE TABLE IF NOT EXISTS answers (
                id INTEGER PRIMARY KEY, attempt_id INTEGER NOT NULL REFERENCES attempts(id),
                position INTEGER NOT NULL, question_id INTEGER NOT NULL, section TEXT NOT NULL,
                question TEXT NOT NULL, options_json TEXT NOT NULL,
                selected_answer TEXT, correct_answer TEXT NOT NULL, is_correct INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS answers_attempt ON answers(attempt_id, position);
            CREATE INDEX IF NOT EXISTS answers_question ON answers(question_id, id DESC);
            CREATE TABLE IF NOT EXISTS known_questions (
                user_id INTEGER NOT NULL REFERENCES users(id), question_id INTEGER NOT NULL,
                PRIMARY KEY(user_id, question_id)
            );
        """
        if DATABASE_URL:
            # Serializes first-run initialization across concurrent function instances.
            db.execute('SELECT pg_advisory_xact_lock(3022601)')
            db.execute('CREATE SCHEMA IF NOT EXISTS dpl302')
            schema = schema.replace('PRAGMA journal_mode = WAL;', '')
            schema = schema.replace('INTEGER PRIMARY KEY', 'SERIAL PRIMARY KEY')
            schema = schema.replace('UNIQUE COLLATE NOCASE', '')
            schema += 'CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower ON users(lower(username));'
        db.executescript(schema)


def ensure_database():
    global _database_ready
    if not _database_ready:
        with _database_lock:
            if not _database_ready:
                init_db()
                _database_ready = True


def progress(db, user_id):
    counts = db.execute("SELECT COALESCE(SUM(total),0), COALESCE(SUM(correct),0) FROM attempts WHERE user_id=?", (user_id,)).fetchone()
    wrong = db.execute("""SELECT a.question_id FROM answers a JOIN attempts t ON t.id=a.attempt_id
        WHERE t.user_id=? AND a.id=(SELECT MAX(b.id) FROM answers b JOIN attempts u ON u.id=b.attempt_id
        WHERE u.user_id=? AND b.question_id=a.question_id) AND a.is_correct=0""", (user_id, user_id)).fetchall()
    return {"known": [r[0] for r in db.execute("SELECT question_id FROM known_questions WHERE user_id=?", (user_id,))],
            "attempts": counts[0], "correct": counts[1], "wrong": [r[0] for r in wrong]}


def validate_answers(body):
    if body.get("mode") not in ("practice", "test"):
        raise ValueError("Chế độ không hợp lệ.")
    if not isinstance(body.get("eventId"), str) or not re.fullmatch(r"[\w-]{16,100}", body["eventId"]):
        raise ValueError("Mã lượt làm bài không hợp lệ.")
    rows = body.get("answers")
    if not isinstance(rows, list) or not 1 <= len(rows) <= 1000 or (body["mode"] == "practice" and len(rows) != 1):
        raise ValueError("Danh sách đáp án không hợp lệ.")
    seen = set()
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("Đáp án không hợp lệ.")
        q = row.get("question")
        if not isinstance(q, dict) or type(q.get("id")) is not int or q["id"] in seen:
            raise ValueError("Câu hỏi không hợp lệ hoặc bị trùng.")
        seen.add(q["id"])
        for field in ("question", "section"):
            if not isinstance(q.get(field), str) or not 1 <= len(q[field]) <= 20000:
                raise ValueError("Nội dung câu hỏi không hợp lệ.")
        opts = q.get("options")
        if not isinstance(opts, dict) or set(opts) != set("ABCD") or any(not isinstance(v, str) or not 1 <= len(v) <= 20000 for v in opts.values()):
            raise ValueError("Cần đủ bốn lựa chọn A, B, C, D.")
        if q.get("answer") not in opts or row.get("selected") not in [None, *opts]:
            raise ValueError("Lựa chọn không hợp lệ.")
    return rows


class Handler(BaseHTTPRequestHandler):
    def reply(self, status, payload, cookie=None):
        data = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        if cookie:
            self.send_header("Set-Cookie", cookie)
        self.end_headers()
        self.wfile.write(data)

    def body(self):
        size = int(self.headers.get("Content-Length", "0"))
        if not 0 < size <= 8_000_000:
            raise ValueError("Dữ liệu gửi lên quá lớn hoặc trống.")
        body = json.loads(self.rfile.read(size))
        if not isinstance(body, dict):
            raise ValueError("Dữ liệu phải là JSON object.")
        return body

    def session(self, db):
        cookie = SimpleCookie()
        try:
            cookie.load(self.headers.get("Cookie", ""))
            token = cookie["session"].value
        except (KeyError, ValueError, CookieError):
            return None
        return db.execute("""SELECT u.id,u.username FROM sessions s JOIN users u ON u.id=s.user_id
            WHERE s.token_hash=? AND s.expires_at>?""", (hashlib.sha256(token.encode()).hexdigest(), int(time.time()))).fetchone()

    def cookie(self, token, age):
        secure = "; Secure" if os.environ.get("DPL302_SECURE_COOKIE") == "1" or os.environ.get('VERCEL') == '1' else ""
        return f"session={token}; Path=/; HttpOnly; SameSite=Strict; Max-Age={age}{secure}"

    def do_GET(self):
        self.dispatch("GET")

    def do_POST(self):
        self.dispatch("POST")

    def do_PUT(self):
        self.dispatch("PUT")

    def dispatch(self, method):
        url = urlsplit(self.path)
        if not url.path.startswith("/api/"):
            if method != "GET":
                return self.reply(405, {"error": "Phương thức không được hỗ trợ."})
            # Explicit public files only: never expose database, source or backups.
            name = {"/": "index.html", "/index.html": "index.html", "/account.js": "account.js",
                    "/questions.json": "questions.json", "/questions.csv": "questions.csv"}.get(url.path)
            if not name:
                return self.reply(404, {"error": "Không tìm thấy."})
            data = (ROOT / name).read_bytes()
            self.send_response(200)
            self.send_header("Content-Type", {".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json", ".csv": "text/csv; charset=utf-8"}[Path(name).suffix])
            self.send_header("Content-Length", str(len(data)))
            self.send_header("Cache-Control", "no-cache")
            self.send_header("X-Content-Type-Options", "nosniff")
            self.end_headers()
            self.wfile.write(data)
            return
        try:
            ensure_database()
            if method != "GET":
                # JSON-only writes and same-origin checks prevent cross-site submissions.
                origin = self.headers.get("Origin")
                if origin and (urlsplit(origin).netloc != self.headers.get("Host") or urlsplit(origin).scheme not in ("http", "https")):
                    return self.reply(403, {"error": "Nguồn yêu cầu không hợp lệ."})
                if self.headers.get("Content-Type", "").split(";")[0] != "application/json":
                    return self.reply(415, {"error": "Cần gửi application/json."})
            with connect() as db:
                user = self.session(db)
                if method == "POST" and url.path in ("/api/register", "/api/login"):
                    body = self.body()
                    username, password = body.get("username", ""), body.get("password", "")
                    if not isinstance(username, str) or not isinstance(password, str):
                        raise ValueError("Tài khoản hoặc mật khẩu không hợp lệ.")
                    username = username.strip()
                    if not re.fullmatch(r"[A-Za-z0-9_.-]{3,40}", username) or not 8 <= len(password) <= 128:
                        raise ValueError("Tên tài khoản: 3–40 ký tự A-Z, số, _, . hoặc -. Mật khẩu: 8–128 ký tự.")
                    if url.path == "/api/register":
                        salt = secrets.token_hex(16)
                        hashed = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
                        try:
                            cursor = db.execute("INSERT INTO users(username,salt,password_hash,created_at) VALUES(?,?,?,?)", (username, salt, hashed, int(time.time())))
                        except INTEGRITY_ERRORS:
                            db.rollback()
                            return self.reply(409, {"error": "Tên tài khoản đã tồn tại."})
                        user = {"id": cursor.lastrowid, "username": username}
                    else:
                        record = db.execute("SELECT * FROM users WHERE lower(username)=lower(?)", (username,)).fetchone()
                        salt = record["salt"] if record else "00" * 16
                        hashed = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()
                        if not record or not hmac.compare_digest(hashed, record["password_hash"]):
                            return self.reply(401, {"error": "Tài khoản hoặc mật khẩu không đúng."})
                        user = record
                    token = secrets.token_urlsafe(32)
                    db.execute("DELETE FROM sessions WHERE expires_at<=?", (int(time.time()),))
                    db.execute("INSERT INTO sessions VALUES(?,?,?)", (hashlib.sha256(token.encode()).hexdigest(), user["id"], int(time.time()) + 604800))
                    db.commit()
                    return self.reply(200, {"user": {"id": user["id"], "username": user["username"]}, "progress": progress(db, user["id"])}, self.cookie(token, 604800))
                if method == "GET" and url.path == "/api/me":
                    return self.reply(200, {"user": dict(user) if user else None, "progress": progress(db, user["id"]) if user else None})
                if not user:
                    return self.reply(401, {"error": "Vui lòng đăng nhập để lưu và xem lịch sử."})
                expected_user = self.headers.get("X-Account-ID")
                if expected_user and expected_user != str(user["id"]):
                    return self.reply(409, {"error": "Tài khoản đã thay đổi ở tab khác. Tải lại trang để tiếp tục."})
                uid = user["id"]
                if method == "POST" and url.path == "/api/logout":
                    cookie = SimpleCookie(self.headers.get("Cookie", ""))
                    db.execute("DELETE FROM sessions WHERE token_hash=?", (hashlib.sha256(cookie["session"].value.encode()).hexdigest(),))
                    db.commit()
                    return self.reply(200, {"ok": True}, self.cookie("", 0))
                if method == "PUT" and url.path == "/api/known":
                    known = self.body().get("known")
                    if not isinstance(known, list) or len(known) > 10000 or any(type(i) is not int for i in known):
                        raise ValueError("Danh sách câu đã thuộc không hợp lệ.")
                    db.execute("DELETE FROM known_questions WHERE user_id=?", (uid,))
                    db.executemany("INSERT INTO known_questions VALUES(?,?)", [(uid, i) for i in set(known)])
                    db.commit()
                    return self.reply(200, {"progress": progress(db, uid)})
                if method == "POST" and url.path == "/api/attempts":
                    body = self.body()
                    rows = validate_answers(body)
                    correct = sum(row.get("selected") == row["question"]["answer"] for row in rows)
                    cursor = db.execute("INSERT OR IGNORE INTO attempts(user_id,event_id,mode,created_at,total,correct) VALUES(?,?,?,?,?,?)", (uid, body["eventId"], body["mode"], int(time.time()), len(rows), correct))
                    if cursor.rowcount:
                        for pos, row in enumerate(rows):
                            q = row["question"]
                            db.execute("INSERT INTO answers(attempt_id,position,question_id,section,question,options_json,selected_answer,correct_answer,is_correct) VALUES(?,?,?,?,?,?,?,?,?)", (cursor.lastrowid, pos, q["id"], q["section"], q["question"], json.dumps(q["options"], ensure_ascii=False), row.get("selected"), q["answer"], int(row.get("selected") == q["answer"])))
                    db.commit()
                    saved = db.execute("SELECT id FROM attempts WHERE user_id=? AND event_id=?", (uid, body["eventId"])).fetchone()
                    selections = {str(r[0]): r[1] for r in db.execute("SELECT question_id,selected_answer FROM answers WHERE attempt_id=?", (saved["id"],))}
                    return self.reply(200, {"progress": progress(db, uid), "answers": selections})
                if method == "GET" and url.path == "/api/history":
                    page = max(1, int(parse_qs(url.query).get("page", ["1"])[0]))
                    rows = db.execute("SELECT id,mode,created_at,total,correct FROM attempts WHERE user_id=? ORDER BY id DESC LIMIT 20 OFFSET ?", (uid, (page-1)*20)).fetchall()
                    total = db.execute("SELECT COUNT(*) FROM attempts WHERE user_id=?", (uid,)).fetchone()[0]
                    return self.reply(200, {"items": [dict(r) for r in rows], "total": total, "page": page})
                match = re.fullmatch(r"/api/history/(\d+)", url.path)
                if method == "GET" and match:
                    attempt = db.execute("SELECT id,mode,created_at,total,correct FROM attempts WHERE id=? AND user_id=?", (int(match[1]), uid)).fetchone()
                    if not attempt:
                        return self.reply(404, {"error": "Không tìm thấy lượt làm bài."})
                    answers = []
                    for row in db.execute("SELECT question_id,section,question,options_json,selected_answer,correct_answer,is_correct FROM answers WHERE attempt_id=? ORDER BY position", (attempt["id"],)):
                        item = dict(row)
                        item["options"] = json.loads(item.pop("options_json"))
                        answers.append(item)
                    return self.reply(200, {"attempt": dict(attempt), "answers": answers})
                return self.reply(404, {"error": "Không tìm thấy API."})
        except (ValueError, TypeError, KeyError):
            self.reply(400, {"error": "Dữ liệu không hợp lệ. Kiểm tra tài khoản, mật khẩu hoặc đáp án."})
        except DatabaseConfigurationError as error:
            self.reply(503, {"error": str(error), "code": "DATABASE_NOT_CONFIGURED"})
        except DATABASE_ERRORS as error:
            print(f'Database request failed: {type(error).__name__}', flush=True)
            self.reply(503, {"error": "Chưa thể lưu database. Vui lòng thử lại."})


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    args = parser.parse_args()
    init_db()
    print(f"DPL302: http://{args.host}:{args.port} (database: {DB_PATH})", flush=True)
    ThreadingHTTPServer((args.host, args.port), Handler).serve_forever()
