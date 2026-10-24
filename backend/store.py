"""In-memory store with JSON persistence and an optional MongoDB mirror (set MONGO_URL)."""
import json
import logging
import threading

from config import DATA_DIR, MONGO_URL, STATIC_EMERGENCY_EMAIL, STATIC_EMERGENCY_PHONE

log = logging.getLogger("store")


class Store:
    def __init__(self):
        self.cameras: dict[str, dict] = {}
        self.paths: dict[str, str] = {}
        self.incidents: dict[str, dict] = {}
        self.email_dispatches: list[dict] = []
        self.emergency_contact: dict = {
            "email": STATIC_EMERGENCY_EMAIL,
            "phone": STATIC_EMERGENCY_PHONE,
            "contact_name": "Emergency Command Desk",
            "auto_email_enabled": True,
            "auto_sms_enabled": True,
        }
        self._lock = threading.Lock()
        self._file = DATA_DIR / "incidents.json"
        self._email_file = DATA_DIR / "email_dispatches.json"
        self._sms_file = DATA_DIR / "sms_dispatches.json"
        self._contact_file = DATA_DIR / "emergency_contact.json"
        self._col = None
        if self._contact_file.exists():
            try:
                raw_contact = json.loads(self._contact_file.read_text())
                if isinstance(raw_contact, dict):
                    self.emergency_contact.update(raw_contact)
            except Exception as exc:  # noqa: BLE001
                log.warning("Could not load initial emergency contact: %s", exc)
        if self._file.exists():
            try:
                raw = json.loads(self._file.read_text())
                if isinstance(raw, list):
                    for inc in raw:
                        self.incidents[inc["id"]] = inc
            except Exception as exc:  # noqa: BLE001
                log.warning("Could not load initial incidents: %s", exc)
        target_dispatch_file = self._email_file if self._email_file.exists() else self._sms_file
        if target_dispatch_file.exists():
            try:
                raw_d = json.loads(target_dispatch_file.read_text())
                if isinstance(raw_d, list):
                    self.email_dispatches = raw_d
            except Exception as exc:
                log.warning("Could not load initial dispatches: %s", exc)
        if MONGO_URL:
            try:
                from pymongo import MongoClient

                self._col = MongoClient(MONGO_URL, serverSelectionTimeoutMS=2000)["incident_desk"]["incidents"]
            except Exception as exc:  # noqa: BLE001
                log.warning("MongoDB mirror disabled: %s", exc)

    @property
    def sms_dispatches(self) -> list[dict]:
        return self.email_dispatches

    @sms_dispatches.setter
    def sms_dispatches(self, val: list[dict]):
        self.email_dispatches = val

    def next_id(self) -> str:
        with self._lock:
            return f"INC-{len(self.incidents) + 1:04d}"

    def add_incident(self, inc: dict):
        self.incidents[inc["id"]] = inc
        self.save_incident(inc)

    def save_incident(self, inc: dict):
        with self._lock:
            self._file.write_text(json.dumps(list(self.incidents.values()), indent=2))
        if self._col is not None:
            try:
                self._col.replace_one({"id": inc["id"]}, inc, upsert=True)
            except Exception as exc:  # noqa: BLE001
                log.warning("MongoDB write failed: %s", exc)

    def add_email_dispatch(self, dispatch: dict):
        with self._lock:
            self.email_dispatches.insert(0, dispatch)
            try:
                self._email_file.write_text(json.dumps(self.email_dispatches, indent=2))
                self._sms_file.write_text(json.dumps(self.email_dispatches, indent=2))
            except Exception as exc:
                log.warning("Failed to save email dispatch log: %s", exc)

    def add_sms_dispatch(self, dispatch: dict):
        self.add_email_dispatch(dispatch)

    def save_emergency_contact(self, contact: dict):
        with self._lock:
            self.emergency_contact = dict(contact)
            try:
                self._contact_file.write_text(json.dumps(self.emergency_contact, indent=2))
            except Exception as exc:
                log.warning("Failed to save emergency contact file: %s", exc)

    def incidents_for(self, cam_id: str) -> list[dict]:
        return [i for i in self.incidents.values() if i["camera_id"] == cam_id]

    def clear(self):
        self.cameras.clear()
        self.paths.clear()
        self.incidents.clear()
        self.email_dispatches.clear()
        self._file.write_text("[]")
        if self._email_file.exists():
            self._email_file.write_text("[]")
        if self._sms_file.exists():
            self._sms_file.write_text("[]")
