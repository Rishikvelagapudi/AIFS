import logging
import shutil
import uuid
from pathlib import Path
from typing import Literal, Optional

from fastapi import FastAPI, File, HTTPException, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from config import EVIDENCE_DIR, MAX_CAMERAS, UPLOAD_DIR
from email_service import (
    dispatch_email_alert,
    dispatch_sms_alert,
    get_smtp_config,
    save_smtp_config,
    send_test_email,
)
from orchestrator import Hub, Orchestrator
from store import Store

logging.basicConfig(level=logging.INFO)
app = FastAPI(title="AIFS Incident Management Agent")
store, hub = Store(), Hub()
orch = Orchestrator(store, hub)

VIDEO_EXT = {".mp4", ".mov", ".m4v", ".webm", ".avi", ".mkv"}
Severity = Literal["critical", "high", "medium", "low"]


class SendEmailRequest(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None


class SendSmsRequest(BaseModel):
    phone: Optional[str] = None
    email: Optional[str] = None


class EmergencyContactPatch(BaseModel):
    email: Optional[str] = None
    phone: Optional[str] = None
    contact_name: Optional[str] = None
    auto_email_enabled: Optional[bool] = None
    auto_sms_enabled: Optional[bool] = None


class SmtpConfigPatch(BaseModel):
    host: Optional[str] = None
    port: Optional[int] = None
    user: Optional[str] = None
    password: Optional[str] = None
    from_email: Optional[str] = None


class TestEmailRequest(BaseModel):
    email: Optional[str] = None


class IncidentPatch(BaseModel):
    status: Optional[Literal["awaiting_verification", "verified", "rejected", "resolved"]] = None
    severity: Optional[Severity] = None
    observation: Optional[str] = None
    interpretation: Optional[str] = None
    recommended_action: Optional[str] = None
    executive_summary: Optional[str] = None
    operator_notes: Optional[str] = None
    actor: str = "operator"


@app.post("/api/upload")
async def upload(files: list[UploadFile] = File(...)):
    if len(store.cameras) + len(files) > MAX_CAMERAS:
        raise HTTPException(400, f"At most {MAX_CAMERAS} cameras per session. Reset to start over.")
    added = []
    for f in files:
        ext = Path(f.filename or "").suffix.lower()
        if ext not in VIDEO_EXT:
            raise HTTPException(400, f"{f.filename}: unsupported file type")
        dest = UPLOAD_DIR / f"{uuid.uuid4().hex[:8]}_{Path(f.filename).name}"
        with dest.open("wb") as out:
            shutil.copyfileobj(f.file, out)
        added.append(await orch.add_video(dest, f.filename))
    return dict(cameras=added)


@app.get("/api/state")
def state():
    return orch.snapshot()


@app.get("/api/videos/{cam_id}")
def video(cam_id: str):
    path = store.paths.get(cam_id)
    if not path:
        raise HTTPException(404)
    return FileResponse(path)


@app.patch("/api/incidents/{inc_id}")
async def patch_incident(inc_id: str, body: IncidentPatch):
    inc = await orch.update_incident(inc_id, body.model_dump(exclude={"actor"}, exclude_none=True), body.actor)
    if not inc:
        raise HTTPException(404)
    return inc


@app.post("/api/incidents/{inc_id}/deep-investigate")
async def deep_investigate(inc_id: str):
    inc = await orch.deep_investigate(inc_id)
    if not inc:
        raise HTTPException(404, "Incident or camera video file not found")
    return inc


@app.post("/api/load-demo")
async def load_demo():
    demo_files = sorted(list(UPLOAD_DIR.glob("*.mp4")))
    if not demo_files:
        raise HTTPException(404, "No demo videos found in uploads directory")
    added = []
    for f in demo_files:
        if len(store.cameras) >= 9:
            break
        orig_name = f.name.split("_", 1)[-1]
        added.append(await orch.add_video(f, orig_name))
    return dict(cameras=added)


@app.post("/api/reset")
async def reset():
    await orch.reset()
    return dict(ok=True)


@app.get("/api/incidents/{inc_id}")
def get_incident(inc_id: str):
    inc = store.incidents.get(inc_id)
    if not inc:
        raise HTTPException(404, "Incident not found")
    return inc


@app.get("/api/incidents/{inc_id}/full-report")
async def get_full_report(inc_id: str):
    inc = store.incidents.get(inc_id)
    if not inc:
        raise HTTPException(404, "Incident not found")
    cam = store.cameras.get(inc.get("camera_id", ""))
    dispatches = [d for d in store.email_dispatches if d.get("incident_id") == inc_id]
    return {
        "incident": inc,
        "camera": cam,
        "evidence_frames": inc.get("evidence_frames", []),
        "dispatches": dispatches,
        "video_url": cam.get("video_url") if cam else f"/api/videos/{inc.get('camera_id')}",
    }


@app.post("/api/incidents/{inc_id}/send-email")
async def send_incident_email(inc_id: str, body: Optional[SendEmailRequest] = None):
    inc = store.incidents.get(inc_id)
    if not inc:
        raise HTTPException(404, "Incident not found")
    cam = store.cameras.get(inc.get("camera_id", ""))
    target_email = body.email if body and body.email else (body.phone if body and body.phone and "@" in body.phone else None)
    dispatch = await dispatch_email_alert(store, hub, inc, cam, recipient_email=target_email)
    return dispatch


@app.post("/api/incidents/{inc_id}/send-sms")
async def send_incident_sms(inc_id: str, body: Optional[SendSmsRequest] = None):
    # Backward compatible route forwarding to email dispatch
    return await send_incident_email(inc_id, body=body)


@app.get("/api/email-dispatches")
def get_email_dispatches():
    return store.email_dispatches


@app.get("/api/sms-dispatches")
def get_sms_dispatches():
    return store.email_dispatches


@app.get("/api/emergency-contact")
def get_emergency_contact():
    return store.emergency_contact


@app.patch("/api/emergency-contact")
async def patch_emergency_contact(body: EmergencyContactPatch):
    if body.email is not None:
        store.emergency_contact["email"] = body.email
    if body.phone is not None:
        store.emergency_contact["phone"] = body.phone
        if "@" in body.phone:
            store.emergency_contact["email"] = body.phone
    if body.contact_name is not None:
        store.emergency_contact["contact_name"] = body.contact_name
    if body.auto_email_enabled is not None:
        store.emergency_contact["auto_email_enabled"] = body.auto_email_enabled
    if body.auto_sms_enabled is not None:
        store.emergency_contact["auto_sms_enabled"] = body.auto_sms_enabled
    store.save_emergency_contact(store.emergency_contact)
    await hub.broadcast({"type": "emergency_contact_update", "emergency_contact": store.emergency_contact})
    return store.emergency_contact


@app.get("/api/smtp-config")
def get_smtp_settings():
    cfg = get_smtp_config()
    pw = cfg.get("password") or ""
    masked_pw = ("*" * (len(pw) - 4) + pw[-4:]) if len(pw) >= 4 else ("*" * len(pw))
    return {
        "host": cfg.get("host") or "smtp.gmail.com",
        "port": cfg.get("port") or 587,
        "user": cfg.get("user") or "",
        "from_email": cfg.get("from_email") or "",
        "has_password": bool(pw),
        "masked_password": masked_pw,
        "is_configured": bool(cfg.get("user") and cfg.get("password")),
    }


@app.post("/api/smtp-config")
def update_smtp_settings(body: SmtpConfigPatch):
    data = {}
    if body.host is not None:
        data["host"] = body.host
    if body.port is not None:
        data["port"] = body.port
    if body.user is not None:
        data["user"] = body.user
    if body.password is not None and body.password.strip():
        data["password"] = body.password.strip()
    if body.from_email is not None:
        data["from_email"] = body.from_email
    save_smtp_config(data)
    return get_smtp_settings()


@app.post("/api/test-email")
async def trigger_test_email(body: Optional[TestEmailRequest] = None):
    target = (body.email if body and body.email else None) or store.emergency_contact.get("email") or "rishikvelagapudi@gmail.com"
    try:
        res = await send_test_email(target)
        return res
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@app.websocket("/ws")
async def ws(sock: WebSocket):
    await sock.accept()
    hub.clients.add(sock)
    try:
        await sock.send_json(orch.snapshot())
        while True:
            await sock.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        hub.clients.discard(sock)


app.mount("/api/evidence", StaticFiles(directory=EVIDENCE_DIR), name="evidence")

DIST = Path(__file__).parent.parent / "frontend" / "dist"


@app.get("/incident-report/{path:path}")
def serve_incident_report(path: str):
    idx = DIST / "index.html"
    if idx.exists():
        return FileResponse(idx)
    raise HTTPException(404, "Frontend dist not built")


if DIST.exists():
    app.mount("/", StaticFiles(directory=DIST, html=True), name="frontend")
