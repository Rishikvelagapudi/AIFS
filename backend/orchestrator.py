"""Orchestrator: one asyncio task per camera, all feeding one shared incident queue."""
from __future__ import annotations

import asyncio
import logging
import time
from pathlib import Path

from agents import (
    SEV_RANK, IncidentDetectionAgent, InvestigationAgent, PriorityAlertAgent,
    ReportingAgent, VideoAnalysisAgent, now_iso,
)
from analysis import extract_evidence_frames
from config import ANALYSIS_SPEED, EVENT_COOLDOWN_SEC, EVIDENCE_DIR, UPLOAD_DIR, load_zones  # noqa: F401
from email_service import dispatch_email_alert

log = logging.getLogger("orchestrator")
OPEN_STATES = ("awaiting_verification", "verified")


class Hub:
    def __init__(self):
        self.clients = set()

    async def broadcast(self, msg: dict):
        for c in list(self.clients):
            try:
                await c.send_json(msg)
            except Exception:  # noqa: BLE001
                self.clients.discard(c)


class Orchestrator:
    def __init__(self, store, hub: Hub):
        self.store, self.hub = store, hub
        self.tasks: dict[str, asyncio.Task] = {}
        self.video = VideoAnalysisAgent()
        self.detect = IncidentDetectionAgent()
        self.priority = PriorityAlertAgent()
        self.investigate = InvestigationAgent()
        self.reporting = ReportingAgent()

    def snapshot(self) -> dict:
        return dict(
            type="snapshot",
            cameras=list(self.store.cameras.values()),
            incidents=list(self.store.incidents.values()),
            email_dispatches=self.store.email_dispatches[:25],
            sms_dispatches=self.store.email_dispatches[:25],
            emergency_contact=self.store.emergency_contact,
        )

    async def add_video(self, path: Path, original_name: str) -> dict:
        cam_id = f"CAM-{len(self.store.cameras) + 1:02d}"
        cam = dict(id=cam_id, name=Path(original_name).stem[:40], status="queued", progress=0.0,
                   video_ts=0.0, video_url=f"/api/videos/{cam_id}", severity="normal", incident_count=0, error=None)
        self.store.cameras[cam_id] = cam
        self.store.paths[cam_id] = str(path)
        await self.hub.broadcast(dict(type="camera_update", camera=cam))
        self.tasks[cam_id] = asyncio.create_task(self.run_camera(cam_id))
        return cam

    async def run_camera(self, cam_id: str):
        cam = self.store.cameras[cam_id]
        zones = load_zones()
        zone = zones.get(cam_id) or zones.get(Path(self.store.paths[cam_id]).stem.split("_", 1)[-1])
        started = time.monotonic()
        try:
            cam["status"] = "analyzing"
            await self.hub.broadcast(dict(type="camera_update", camera=cam))
            gen = self.video.open(self.store.paths[cam_id], zone).segments()
            while True:
                t0 = time.monotonic()
                seg = await asyncio.to_thread(next, gen, None)  # heavy work off the event loop
                if seg is None:
                    break
                cam["progress"], cam["video_ts"] = round(seg["progress"], 3), round(seg["t_end"], 1)
                for ev in seg["events"]:
                    await self.handle_event(cam, ev, time.monotonic() - started)
                await self.hub.broadcast(dict(type="camera_update", camera=cam))
                pace = (seg["t_end"] - seg["t_start"]) / ANALYSIS_SPEED
                await asyncio.sleep(max(0.0, pace - (time.monotonic() - t0)))
            cam["status"], cam["progress"] = "complete", 1.0
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001
            log.exception("Camera %s failed", cam_id)
            cam["status"], cam["error"] = "error", str(exc)
        await self.hub.broadcast(dict(type="camera_update", camera=cam))

    async def handle_event(self, cam: dict, ev: dict, wall_s: float):
        cand = self.detect.classify(ev)
        if not cand:
            return
        cand["id"] = self.store.next_id()
        cand["video_ts"] = round(ev["t"], 1)
        history = self.store.incidents_for(cam["id"])

        video_path = self.store.paths.get(cam["id"])
        zones = load_zones()
        zone = zones.get(cam["id"]) or (zones.get(Path(video_path).stem.split("_", 1)[-1]) if video_path else None)

        evidence_frames = []
        if video_path and Path(video_path).exists():
            evidence_frames = await asyncio.to_thread(
                extract_evidence_frames, video_path, ev["t"], cand["id"], ev["type"], zone, ev.get("jpeg", b"")
            )

        inc = self.reporting.draft(self.priority.prioritize(cam, cand, history), cam, ev, wall_s, evidence_frames)
        inc = self.investigate.investigate(self.store, inc)

        p_img = EVIDENCE_DIR / f"{inc['id']}.jpg"
        if not p_img.exists() and ev.get("jpeg"):
            p_img.write_bytes(ev["jpeg"])

        self.store.add_incident(inc)
        self.refresh_camera(cam)
        await self.hub.broadcast(dict(type="incident_new", incident=inc))

        # Automatic Emergency Email Alert: agent automatically pushes all detected alerts to mail
        if self.store.emergency_contact.get("auto_email_enabled", True):
            asyncio.create_task(dispatch_email_alert(self.store, self.hub, inc, cam))

        asyncio.create_task(self.enrich(inc, ev.get("jpeg", b"")))

    async def enrich(self, inc: dict, jpeg: bytes):
        changes = await self.reporting.enrich(inc, jpeg)
        if changes and inc["status"] == "awaiting_verification":
            inc.update(changes)
            self.store.save_incident(inc)
            await self.hub.broadcast(dict(type="incident_update", incident=inc))

    def _resolve_video_path(self, cam_id: str, cam_name: str) -> str | None:
        p = self.store.paths.get(cam_id)
        if p and Path(p).exists():
            return p
        if UPLOAD_DIR.exists():
            for f in UPLOAD_DIR.iterdir():
                if f.is_file() and f.suffix.lower() in {".mp4", ".mov", ".m4v", ".webm", ".avi", ".mkv"}:
                    if cam_name and (cam_name in f.name or f.stem.endswith(cam_name)):
                        return str(f)
            # Fallback to any video in UPLOAD_DIR
            videos = list(UPLOAD_DIR.glob("*.mp4"))
            if videos:
                return str(videos[0])
        return None

    async def deep_investigate(self, inc_id: str) -> dict | None:
        inc = self.store.incidents.get(inc_id)
        if not inc:
            return None
        cam_id = inc["camera_id"]
        video_path = self._resolve_video_path(cam_id, inc.get("camera_name", ""))
        if not video_path or not Path(video_path).exists():
            return None
        self.store.paths[cam_id] = video_path

        zones = load_zones()
        zone = zones.get(cam_id) or zones.get(Path(video_path).stem.split("_", 1)[-1])
        evidence_frames = await asyncio.to_thread(
            extract_evidence_frames, video_path, inc["video_ts"], inc["id"], inc["type"], zone
        )
        if evidence_frames:
            cam = self.store.cameras.get(cam_id) or dict(id=cam_id, name=inc.get("camera_name", cam_id))
            inc["evidence_frames"] = evidence_frames
            self.reporting.rebuild_dossier(inc, cam, evidence_frames)
            inc["description_source"] = "agent_deep_investigation"
            inc["audit"].append(dict(at=now_iso(), actor="agent", action="Deep multi-frame investigation completed"))
            self.store.save_incident(inc)
            await self.hub.broadcast(dict(type="incident_update", incident=inc))
        return inc

    def refresh_camera(self, cam: dict):
        open_inc = [i for i in self.store.incidents_for(cam["id"]) if i["status"] in OPEN_STATES]
        cam["incident_count"] = len(open_inc)
        cam["severity"] = max((i["severity"] for i in open_inc), key=lambda s: SEV_RANK[s], default="normal")

    async def update_incident(self, inc_id: str, patch: dict, actor: str) -> dict | None:
        inc = self.store.incidents.get(inc_id)
        if not inc:
            return None
        for key, val in patch.items():
            if val is None or inc.get(key) == val:
                continue
            action = f"Status set to {val}" if key == "status" else f"Edited {key.replace('_', ' ')}"
            inc["audit"].append(dict(at=now_iso(), actor=actor, action=action))
            inc[key] = val
            if key in ("observation", "interpretation", "recommended_action", "executive_summary", "operator_notes"):
                inc["description_source"] = "operator"
        self.store.save_incident(inc)
        cam = self.store.cameras.get(inc["camera_id"])
        if cam:
            self.refresh_camera(cam)
            await self.hub.broadcast(dict(type="camera_update", camera=cam))
        await self.hub.broadcast(dict(type="incident_update", incident=inc))
        return inc

    async def reset(self):
        for t in self.tasks.values():
            t.cancel()
        await asyncio.gather(*self.tasks.values(), return_exceptions=True)
        self.tasks.clear()
        self.store.clear()
        await self.hub.broadcast(self.snapshot())
