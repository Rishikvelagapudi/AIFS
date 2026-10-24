import json
import os
from pathlib import Path

BASE = Path(__file__).parent
DATA_DIR = Path(os.getenv("DATA_DIR", BASE / "data"))
UPLOAD_DIR = DATA_DIR / "uploads"
EVIDENCE_DIR = DATA_DIR / "evidence"
for _p in (UPLOAD_DIR, EVIDENCE_DIR):
    _p.mkdir(parents=True, exist_ok=True)

SEGMENT_SEC = float(os.getenv("SEGMENT_SEC", "2"))          # video seconds per analysis segment
SAMPLE_FPS = float(os.getenv("SAMPLE_FPS", "5"))            # frames analysed per video second
ANALYSIS_SPEED = float(os.getenv("ANALYSIS_SPEED", "2"))    # 1 = real time, 2 = twice real time
EVENT_COOLDOWN_SEC = float(os.getenv("EVENT_COOLDOWN_SEC", "10"))
MAX_CAMERAS = int(os.getenv("MAX_CAMERAS", "12"))
YOLO_MODEL = os.getenv("YOLO_MODEL", "yolov8n.pt")
YOLO_CONF = float(os.getenv("YOLO_CONF", "0.35"))
MONGO_URL = os.getenv("MONGO_URL", "")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5-5")
STATIC_EMERGENCY_EMAIL = os.getenv("STATIC_EMERGENCY_EMAIL", "rishikvelagapudi@gmail.com")
STATIC_EMERGENCY_PHONE = os.getenv("STATIC_EMERGENCY_PHONE", "+91 9347137844")
SMTP_HOST = os.getenv("SMTP_HOST", "")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", "alerts@aifs.gov.in")
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")


def load_zones() -> dict:
    try:
        raw = json.loads((BASE / "zones.json").read_text())
        return {k: v for k, v in raw.items() if not k.startswith("_")}
    except Exception:
        return {}
