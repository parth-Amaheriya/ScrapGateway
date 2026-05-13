import math
import importlib
import os
import secrets
import json
import sys
import base64
import hashlib
import hmac
from datetime import datetime, timezone
from http.cookies import SimpleCookie
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse
import redis
from dotenv import load_dotenv
load_dotenv()


if "REDIS_URL" not in os.environ and "REDIS_HOST" not in os.environ and "REDIS_PORT" not in os.environ:
    print("*"*60)
    print("Warning: No Redis configuration found in environment variables. Defaulting to localhost:6379 with no password.")
    print("*"*60)

if "ADMIN_USERNAME" not in os.environ or "ADMIN_PASSWORD" not in os.environ:
    print("*"*60)
    print("Warning: No admin credentials found in environment variables. Defaulting to username 'admin' and password 'admin'.")
    print("*"*60)

REDIS_PASSWORD=os.getenv("REDIS_PASSWORD", "")
REDIS_PORT=os.getenv("REDIS_PORT", "6379")
REDIS_HOST=os.getenv("REDIS_HOST", "127.0.0.1")

# print(REDIS_PASSWORD,REDIS_PORT,REDIS_HOST  )
print(f"Connecting to Redis at {REDIS_HOST}:{REDIS_PORT} with password: {'***' if REDIS_PASSWORD else '(none)'}")

r = redis.Redis(host=REDIS_HOST, port=int(REDIS_PORT), decode_responses=True, password=REDIS_PASSWORD)

AUTH_COOKIE_NAME = "qk_admin_token"
JWT_SECRET = os.getenv("ADMIN_JWT_SECRET", "quota-key-dashboard-admin-secret")
ADMIN_USERNAME = os.getenv("ADMIN_USERNAME", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin")
AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7

_mongo_client = None
_issue_collection = None

def _get_issue_collection():
    global _mongo_client, _issue_collection

    if _issue_collection is not None:
        return _issue_collection

    mongo_module = importlib.import_module("pymongo")
    mongo_client_cls = getattr(mongo_module, "MongoClient")

    mongo_uri = os.getenv("MONGODB_URI", "mongodb://127.0.0.1:27017")
    mongo_db = os.getenv("MONGODB_DB", "quota_key")
    _mongo_client = mongo_client_cls(mongo_uri)
    _issue_collection = _mongo_client[mongo_db]["issues"]
    _issue_collection.create_index("issue_id", unique=True)
    _issue_collection.create_index("created_at")
    return _issue_collection


def _issue_public(issue):
    if not issue:
        return None

    return {
        "issue_id": issue.get("issue_id", ""),
        "domain": issue.get("domain", ""),
        "api_key": issue.get("api_key", ""),
        "email": issue.get("email", ""),
        "description": issue.get("description", ""),
        "images": issue.get("images", []),
        "status": issue.get("status", "open"),
        "source": issue.get("source", "docs"),
        "created_at": issue.get("created_at", ""),
        "updated_at": issue.get("updated_at", ""),
    }


def _issue_summary(issue):
    images = issue.get("images", []) or []
    description = issue.get("description", "")
    return {
        "issue_id": issue.get("issue_id", ""),
        "domain": issue.get("domain", ""),
        "api_key": issue.get("api_key", ""),
        "email": issue.get("email", ""),
        "description_preview": description[:180],
        "image_count": len(images),
        "status": issue.get("status", "open"),
        "source": issue.get("source", "docs"),
        "created_at": issue.get("created_at", ""),
        "updated_at": issue.get("updated_at", ""),
    }


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(data: str) -> bytes:
    padding = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)


def _create_jwt(payload: dict) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    header_segment = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    payload_segment = _b64url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{header_segment}.{payload_segment}".encode("ascii")
    signature = hmac.new(JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
    return f"{header_segment}.{payload_segment}.{_b64url_encode(signature)}"


def _verify_jwt(token: str) -> dict | None:
    try:
        header_segment, payload_segment, signature_segment = token.split(".")
        signing_input = f"{header_segment}.{payload_segment}".encode("ascii")
        expected_signature = hmac.new(JWT_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
        provided_signature = _b64url_decode(signature_segment)
        if not hmac.compare_digest(expected_signature, provided_signature):
            return None

        payload = json.loads(_b64url_decode(payload_segment).decode("utf-8"))
        expires_at = int(payload.get("exp", 0))
        if expires_at and expires_at < int(datetime.now(timezone.utc).timestamp()):
            return None
        if payload.get("role") != "admin":
            return None
        return payload
    except Exception:
        return None

class BuildConfig:
    def __init__(self, pool_size, cost_per_req, recovery_per_sec, penalty_inc, total_quota, avg_latency, safety_margin, failure_rate, project_id, allowed_domains):
        self.N = pool_size
        self.C = cost_per_req
        self.R = recovery_per_sec
        self.penalty_inc = penalty_inc
        self.total_quota = total_quota
        self.avg_latency = avg_latency
        self.safety_margin = safety_margin
        self.failure_rate = failure_rate
        self.project_id = project_id
        self.allowed_domains = allowed_domains

    def get_plan_config(self):
        # 1. Blended Cost calculation
        blended_cost = ((1 - self.failure_rate) * self.C) + (self.failure_rate * 100)
        
        # 2. Penalty Drag calculation
        penalty_drag = (1 - self.failure_rate) + (self.failure_rate / (1 + self.penalty_inc))
        total_recovery = self.N * self.R * penalty_drag
        
        # 3. Solve for Concurrency and RPS
        optimal_s = (total_recovery * self.avg_latency * self.safety_margin) / blended_cost
        optimal_rps = optimal_s / self.avg_latency

        # Theoretical time in minutes: Total Quota / (RPS * 60)
        etc_minutes = (self.total_quota / optimal_rps) / 60 if optimal_rps > 0 else 0
        
        # Theoretical hits per IP
        reqs_per_proxy = self.total_quota / self.N

        return {
            "project_id": self.project_id,
            "pool_size": self.N,
            "cost_per_request": self.C,
            "recovery_per_second": self.R,
            "penalty_increase": self.penalty_inc,
            "total_quota": self.total_quota,
            "average_latency": self.avg_latency,
            "failure_rate": self.failure_rate,
            "safety_margin": self.safety_margin,
            "allowed_domains": self.allowed_domains,
            "total_quota": self.total_quota,
            "max_concurrency": math.floor(optimal_s),
            "max_rps": round(optimal_rps, 2),
            "safety_level": self.safety_margin,
            "expected_latency": self.avg_latency,
            "predicted_metrics": {
                "etc_minutes": round(etc_minutes, 2),
                "hits_per_proxy": round(reqs_per_proxy, 2),
                "failure_rate_assumption": self.failure_rate
            }
        }


class KeyProvisioner:
    @staticmethod
    def create_key_package(plan_config):
        api_key = f"sk_{secrets.token_hex(16)}"
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
        return {
            "project_id": plan_config["project_id"],
            "pool_size": plan_config["pool_size"],
            "cost_per_request": plan_config["cost_per_request"],
            "recovery_per_second": plan_config["recovery_per_second"],
            "penalty_increase": plan_config["penalty_increase"],
            "total_quota": plan_config["total_quota"],
            "average_latency": plan_config["average_latency"],
            "failure_rate": plan_config["failure_rate"],
            "safety_margin": plan_config["safety_margin"],
            "allowed_domains": plan_config["allowed_domains"],
            "api_key": api_key,
            "status": "active",
            "created_at": timestamp,
            "last_edit_at": timestamp,
            "quota_limit": plan_config["total_quota"],
            "expected_latency": plan_config["expected_latency"],
            "max_concurrency": plan_config["max_concurrency"],
            "max_rps": plan_config["max_rps"],
            "failure_rate_assumption": plan_config["predicted_metrics"]["failure_rate_assumption"],
            "safety_level": plan_config["safety_level"],
            "hits_per_proxy": plan_config["predicted_metrics"]["hits_per_proxy"],
            "etc_minutes": plan_config["predicted_metrics"]["etc_minutes"],
        }


class RedisManager:
    @staticmethod
    def save_package(package):
        project_id = package["project_id"]
        api_key = package["api_key"]

        # Use a Pipeline for Atomic Operations
        pipe = r.pipeline()

        try:
            # 1. Check for Project ID Uniqueness
            # SADD returns 1 if element is new, 0 if it already exists
            if not r.sadd("unique_projects", project_id):
                raise Exception(f"Conflict: Project ID {project_id} already exists.")

            # 2. Check for API Key Uniqueness
            # SETNX returns 1 if key doesn't exist, 0 if it does
            if not r.setnx(f"auth_key:{api_key}", project_id):
                # Clean up the project ID we just added if key fails
                r.srem("unique_projects", project_id) 
                raise Exception(f"Conflict: API Key already exists in database.")

            # 3. Store the Main Package
            # We store it as a Hash for easy field-level updates later
            pipe.hset(f"project_meta:{project_id}", mapping={
                k: (json.dumps(v) if isinstance(v, list) else v) 
                for k, v in package.items()
            })

            # 4. Initialize Live Counters
            pipe.set(f"quota:{project_id}", package["quota_limit"])
            pipe.set(f"active_conn:{project_id}", 0)

            pipe.execute()
            print(f"Successfully provisioned Project: {project_id}")
            return True

        except Exception as e:
            print(f"Provisioning Failed: {e}")
            return False
        
    @staticmethod
    def get_project_id(api_key):
        """Helper to find the Project ID from an API Key."""
        return r.get(f"auth_key:{api_key}")

    @classmethod
    def check_balance(cls, api_key):
        """Read current live status (Quota left and active connections)."""
        pid = cls.get_project_id(api_key)
        if not pid: return "Key not found."
        
        # Get quota and live connections
        quota = r.get(f"quota:{pid}")
        active = r.get(f"active_conn:{pid}")
        
        return {
            "project_id": pid,
            "remaining_quota": int(quota) if quota else 0,
            "live_concurrency": int(active) if active else 0
        }

    @classmethod
    def get_limits(cls, api_key):
        """Read the allotted contract limits from project_meta."""
        pid = cls.get_project_id(api_key)
        if not pid: return "Key not found."
        
        # HGETALL is like 'SELECT *' for a Redis Hash
        meta = r.hgetall(f"project_meta:{pid}")
        # Convert JSON strings (like allowed_domain) back to Python lists
        if "allowed_domains" in meta:
            meta["allowed_domains"] = json.loads(meta["allowed_domains"])
            
        return meta

    @classmethod
    def update_limits(cls, api_key, new_concurrency=None, new_quota=None, new_allowed_domains=None):
        """Update existing limits or top up quota."""
        pid = cls.get_project_id(api_key)
        if not pid: return False
        
        pipe = r.pipeline()
        
        # Update Metadata Hash (Contract)
        if new_concurrency is not None:
            pipe.hset(f"project_meta:{pid}", "max_concurrency", new_concurrency)
            
        # Update Live Quota Counter
        if new_quota is not None:
            pipe.hset(f"project_meta:{pid}", "quota_limit", new_quota)
            pipe.set(f"quota:{pid}", new_quota) # Reset the live 'gas tank'

        if new_allowed_domains is not None:
            pipe.hset(f"project_meta:{pid}", "allowed_domains", json.dumps(new_allowed_domains))
            
        pipe.execute()
        return True
    
    @classmethod
    def delete_project(cls, api_key):
        """Remove project entirely (The 'Cleanup' script)."""
        pid = cls.get_project_id(api_key)
        if not pid: return False
        
        pipe = r.pipeline()
        pipe.delete(f"auth_key:{api_key}")
        pipe.delete(f"project_meta:{pid}")
        pipe.delete(f"quota:{pid}")
        pipe.delete(f"active_conn:{pid}")
        pipe.srem("unique_projects", pid)
        pipe.execute()
        return True


class ApiHandler(BaseHTTPRequestHandler):
    def _cors_origin(self):
        origin = self.headers.get("Origin")
        return origin or os.getenv("FRONTEND_ORIGIN", "http://172.27.131.136:8000")

    def _set_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", self._cors_origin())
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS")

    def _send_json(self, status_code, payload, headers=None):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status_code)
        self._set_cors_headers()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        if headers:
            for key, value in headers.items():
                self.send_header(key, value)
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self):
        content_length = int(self.headers.get("Content-Length", 0))
        if content_length <= 0:
            return {}
        raw = self.rfile.read(content_length).decode("utf-8")
        return json.loads(raw or "{}")

    def _project_record(self, project_id):
        meta = r.hgetall(f"project_meta:{project_id}")
        if not meta:
            return None

        if "allowed_domains" in meta:
            meta["allowed_domains"] = json.loads(meta["allowed_domains"])

        meta["id"] = project_id
        return meta

    def _get_cookie_value(self, name):
        raw_cookie = self.headers.get("Cookie")
        if not raw_cookie:
            return None
        cookie = SimpleCookie()
        cookie.load(raw_cookie)
        morsel = cookie.get(name)
        return morsel.value if morsel else None

    def _current_admin(self):
        token = self._get_cookie_value(AUTH_COOKIE_NAME)
        if not token:
            return None
        payload = _verify_jwt(token)
        if not payload:
            return None
        return {
            "username": payload.get("sub", ADMIN_USERNAME),
            "role": payload.get("role", "admin"),
        }

    def _require_admin(self):
        admin = self._current_admin()
        if not admin:
            self._send_json(401, {"error": "Unauthorized"})
            return None
        return admin

    def _auth_cookie(self, token, max_age=AUTH_COOKIE_MAX_AGE):
        cookie = (
            f"{AUTH_COOKIE_NAME}={token}; "
            f"HttpOnly; Path=/; SameSite=Lax; Max-Age={max_age}"
        )

        if self.headers.get("X-Forwarded-Proto", "http") == "https":
            cookie += "; Secure"

        return cookie

    def _clear_auth_cookie(self):
        cookie = (
            f"{AUTH_COOKIE_NAME}=; "
            f"HttpOnly; Path=/; SameSite=Lax; Max-Age=0"
        )

        if self.headers.get("X-Forwarded-Proto", "http") == "https":
            cookie += "; Secure"

        return cookie

    def do_OPTIONS(self):
        self.send_response(204)
        self._set_cors_headers()
        self.end_headers()

    def do_GET(self):
        path = urlparse(self.path).path

        if path == "/api/auth/me":
            admin = self._current_admin()
            if not admin:
                return self._send_json(401, {"error": "Unauthorized"})
            return self._send_json(200, {"authenticated": True, "user": admin})

        if path in {"/api", "/api/"}:
            return self._send_json(200, {"status": "ok"})

        if path == "/api/issues":
            if not self._require_admin():
                return
            try:
                collection = _get_issue_collection()
                issues = [
                    _issue_summary(issue)
                    for issue in collection.find({}, {"_id": 0}).sort("created_at", -1)
                ]
                return self._send_json(200, issues)
            except Exception as exc:
                return self._send_json(503, {"error": str(exc)})

        if path.startswith("/api/issues/"):
            # if not self._require_admin():
            #     return
            issue_id = path.split("/api/issues/", 1)[1].strip("/")
            try:
                collection = _get_issue_collection()
                issue = collection.find_one({"issue_id": issue_id}, {"_id": 0})
                if issue is None:
                    return self._send_json(404, {"error": "Issue not found"})
                return self._send_json(200, _issue_public(issue))
            except Exception as exc:
                return self._send_json(503, {"error": str(exc)})

        if path == "/api/projects":
            if not self._require_admin():
                return
            project_ids = sorted(r.smembers("unique_projects"))
            projects = []
            for project_id in project_ids:
                project = self._project_record(project_id)
                if project is not None:
                    projects.append(project)
            return self._send_json(200, projects)

        if path.startswith("/api/projects/"):
            if not self._require_admin():
                return
            project_id = path.split("/api/projects/", 1)[1].strip("/")
            project = self._project_record(project_id)
            if project is None:
                return self._send_json(404, {"error": "Project not found"})
            return self._send_json(200, project)

        return self._send_json(404, {"error": "Not found"})

    def do_POST(self):
        path = urlparse(self.path).path

        if path == "/api/auth/login":
            try:
                payload = self._read_json()
            except json.JSONDecodeError:
                return self._send_json(400, {"error": "Invalid JSON body"})

            username = str(payload.get("username", "")).strip()
            password = str(payload.get("password", ""))
            if username != ADMIN_USERNAME or password != ADMIN_PASSWORD:
                return self._send_json(401, {"error": "Invalid admin credentials"})

            now = int(datetime.now(timezone.utc).timestamp())
            token = _create_jwt({
                "sub": username,
                "role": "admin",
                "iat": now,
                "exp": now + AUTH_COOKIE_MAX_AGE,
            })
            return self._send_json(
                200,
                {"authenticated": True, "user": {"username": username, "role": "admin"}},
                {"Set-Cookie": self._auth_cookie(token)},
            )

        if path == "/api/auth/logout":
            return self._send_json(200, {"authenticated": False}, {"Set-Cookie": self._clear_auth_cookie()})

        if path == "/api/issues":
            try:
                payload = self._read_json()
                required = ["domain", "api_key", "email", "description"]
                missing = [field for field in required if field not in payload or not str(payload[field]).strip()]
                if missing:
                    return self._send_json(400, {"error": f"Missing fields: {', '.join(missing)}"})

                collection = _get_issue_collection()
                issue = {
                    "issue_id": f"iss_{secrets.token_hex(8)}",
                    "domain": str(payload["domain"]).strip(),
                    "api_key": str(payload["api_key"]).strip(),
                    "email": str(payload["email"]).strip(),
                    "description": str(payload["description"]).strip(),
                    "images": payload.get("images", []),
                    "status": "open",
                    "source": str(payload.get("source", "docs")).strip() or "docs",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                }
                collection.insert_one(issue)
                return self._send_json(201, _issue_public(issue))
            except json.JSONDecodeError:
                return self._send_json(400, {"error": "Invalid JSON body"})
            except Exception as exc:
                return self._send_json(503, {"error": str(exc)})

        if path != "/api/projects":
            return self._send_json(404, {"error": "Not found"})

        if not self._require_admin():
            return

        try:
            payload = self._read_json()
            required = [
                "project_id",
                "pool_size",
                "cost_per_request",
                "recovery_per_second",
                "penalty_increase",
                "total_quota",
                "average_latency",
                "failure_rate",
                "safety_margin",
                "allowed_domains",
            ]
            missing = [field for field in required if field not in payload]
            if missing:
                return self._send_json(400, {"error": f"Missing fields: {', '.join(missing)}"})

            config = BuildConfig(
                pool_size=payload["pool_size"],
                cost_per_req=payload["cost_per_request"],
                recovery_per_sec=payload["recovery_per_second"],
                penalty_inc=payload["penalty_increase"],
                total_quota=payload["total_quota"],
                avg_latency=payload["average_latency"],
                safety_margin=payload["safety_margin"],
                failure_rate=payload["failure_rate"],
                project_id=payload["project_id"],
                allowed_domains=payload["allowed_domains"],
            )

            config_data = config.get_plan_config()
            package = KeyProvisioner.create_key_package(config_data)
            if not RedisManager.save_package(package):
                return self._send_json(400, {"error": "Provisioning failed"})

            project = self._project_record(payload["project_id"])
            if project is None:
                return self._send_json(500, {"error": "Provisioned project not found"})
            return self._send_json(201, project)
        except json.JSONDecodeError:
            return self._send_json(400, {"error": "Invalid JSON body"})
        except Exception as exc:
            return self._send_json(500, {"error": str(exc)})

    def do_PATCH(self):
        path = urlparse(self.path).path

        if path.startswith("/api/issues/"):
            if not self._require_admin():
                return
            issue_id = path.split("/api/issues/", 1)[1].strip("/")
            try:
                payload = self._read_json()
                allowed_status = {"open", "closed"}
                status = str(payload.get("status", "")).strip().lower()
                if status not in allowed_status:
                    return self._send_json(400, {"error": "Invalid status"})

                collection = _get_issue_collection()
                result = collection.update_one(
                    {"issue_id": issue_id},
                    {
                        "$set": {
                            "status": status,
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                        }
                    },
                )

                if result.matched_count == 0:
                    return self._send_json(404, {"error": "Issue not found"})

                updated = collection.find_one({"issue_id": issue_id}, {"_id": 0})
                return self._send_json(200, _issue_public(updated))
            except json.JSONDecodeError:
                return self._send_json(400, {"error": "Invalid JSON body"})
            except Exception as exc:
                return self._send_json(503, {"error": str(exc)})

        if not path.startswith("/api/projects/"):
            return self._send_json(404, {"error": "Not found"})

        if not self._require_admin():
            return

        project_id = path.split("/api/projects/", 1)[1].strip("/")
        project = self._project_record(project_id)
        if project is None:
            return self._send_json(404, {"error": "Project not found"})

        try:
            patch = self._read_json()
            edit_timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M")
            raw_keys = (
                "pool_size",
                "cost_per_request",
                "recovery_per_second",
                "penalty_increase",
                "total_quota",
                "average_latency",
                "failure_rate",
                "safety_margin",
                "allowed_domains",
            )

            if "quota_limit" in patch and "total_quota" not in patch:
                patch["total_quota"] = patch["quota_limit"]

            if any(key in patch for key in raw_keys):
                merged = {**project, **patch}

                config = BuildConfig(
                    pool_size=int(merged.get("pool_size", 0)),
                    cost_per_req=float(merged.get("cost_per_request", 0)),
                    recovery_per_sec=float(merged.get("recovery_per_second", 0)),
                    penalty_inc=float(merged.get("penalty_increase", 0)),
                    total_quota=int(merged.get("total_quota", 0)),
                    avg_latency=float(merged.get("average_latency", 0)),
                    safety_margin=float(merged.get("safety_margin", 0)),
                    failure_rate=float(merged.get("failure_rate", 0)),
                    project_id=project_id,
                    allowed_domains=merged.get("allowed_domains", []),
                )

                config_data = config.get_plan_config()
                updated_package = {
                    "project_id": project_id,
                    "pool_size": config_data["pool_size"],
                    "cost_per_request": config_data["cost_per_request"],
                    "recovery_per_second": config_data["recovery_per_second"],
                    "penalty_increase": config_data["penalty_increase"],
                    "total_quota": config_data["total_quota"],
                    "average_latency": config_data["average_latency"],
                    "failure_rate": config_data["failure_rate"],
                    "safety_margin": config_data["safety_margin"],
                    "allowed_domains": config_data["allowed_domains"],
                    "api_key": project["api_key"],
                    "status": project.get("status", "active"),
                    "created_at": project.get("created_at", edit_timestamp),
                    "last_edit_at": edit_timestamp,
                    "quota_limit": config_data["total_quota"],
                    "expected_latency": config_data["expected_latency"],
                    "max_concurrency": config_data["max_concurrency"],
                    "max_rps": config_data["max_rps"],
                    "failure_rate_assumption": config_data["predicted_metrics"]["failure_rate_assumption"],
                    "safety_level": config_data["safety_level"],
                    "hits_per_proxy": config_data["predicted_metrics"]["hits_per_proxy"],
                    "etc_minutes": config_data["predicted_metrics"]["etc_minutes"],
                }

                pipe = r.pipeline()
                pipe.hset(
                    f"project_meta:{project_id}",
                    mapping={
                        k: (json.dumps(v) if isinstance(v, list) else v)
                        for k, v in updated_package.items()
                    },
                )
                pipe.set(f"quota:{project_id}", updated_package["quota_limit"])
                pipe.execute()

            if "max_concurrency" in patch and not any(key in patch for key in raw_keys):
                r.hset(
                    f"project_meta:{project_id}",
                    mapping={
                        "max_concurrency": patch["max_concurrency"],
                        "last_edit_at": edit_timestamp,
                    },
                )

            updated = self._project_record(project_id)
            if updated is None:
                return self._send_json(500, {"error": "Project update failed"})
            return self._send_json(200, updated)
        except json.JSONDecodeError:
            return self._send_json(400, {"error": "Invalid JSON body"})
        except Exception as exc:
            return self._send_json(500, {"error": str(exc)})

    def do_DELETE(self):
        path = urlparse(self.path).path
        if not path.startswith("/api/projects/"):
            return self._send_json(404, {"error": "Not found"})

        if not self._require_admin():
            return

        project_id = path.split("/api/projects/", 1)[1].strip("/")
        project = self._project_record(project_id)
        if project is None:
            return self._send_json(404, {"error": "Project not found"})

        if not RedisManager.delete_project(project["api_key"]):
            return self._send_json(400, {"error": "Delete failed"})

        return self._send_json(200, {"ok": True})

def run_http_server(host="0.0.0.0", port=8000):
    server = ThreadingHTTPServer((host, port), ApiHandler)
    print(f"HTTP backend listening on http://{host}:{port}/api")
    server.serve_forever()


if __name__ == "__main__":
    if "--serve" in sys.argv:
        if 'HOST' in os.environ and 'PORT' in os.environ:
            run_http_server(host=os.environ['HOST'], port=int(os.environ['PORT']))
            raise SystemExit(0)
        else:
            run_http_server()
            raise SystemExit(0)

    variables = {
        "pool_size": 1000,
        "cost_per_req": 25,
        "recovery_per_sec": 1,
        "penalty_inc": 2.0,
        "total_quota": 50000,
        "avg_latency": 4.0,
        "failure_rate": 0.10,
        "safety_margin": 0.8,
        "project_id": "2ABCXYZ",
        "allowed_domains": ["booktoscrape.com"]
    }

    # Settings for your 1000 proxy pool
    opt = BuildConfig(
        pool_size=variables["pool_size"], 
        cost_per_req=variables["cost_per_req"], 
        recovery_per_sec=variables["recovery_per_sec"], 
        penalty_inc=variables["penalty_inc"],
        total_quota=variables["total_quota"],
        avg_latency=variables["avg_latency"],
        safety_margin=variables["safety_margin"],
        failure_rate=variables["failure_rate"],
        project_id=variables["project_id"],
        allowed_domains=variables["allowed_domains"],
    )
    
    # Calculate config including the target quota
    config = opt.get_plan_config()
    
    # Generate final package
    package = KeyProvisioner.create_key_package(config)
    
    print(RedisManager.save_package(package))
    
