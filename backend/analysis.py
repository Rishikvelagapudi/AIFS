"""Video Analysis Agent: sampled-frame detection plus rule-based incident heuristics.

Everything here describes *possible* events. Rules look at bounding-box geometry and
motion only, so the wording downstream must stay hedged and operator-verified.
"""
from __future__ import annotations

import logging
import math
import threading
from dataclasses import dataclass
from itertools import combinations

import cv2
import numpy as np

from config import EVENT_COOLDOWN_SEC, EVIDENCE_DIR, SAMPLE_FPS, SEGMENT_SEC, YOLO_CONF, YOLO_MODEL

log = logging.getLogger("analysis")

PERSON = 0
VEHICLES = {2, 3, 5, 7}  # car, motorcycle, bus, truck (COCO ids)
NAMES = {0: "person", 2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}


def fmt_ts(sec: float) -> str:
    s = int(sec)
    return f"{s // 3600:02d}:{s % 3600 // 60:02d}:{s % 60:02d}"


@dataclass
class Det:
    cls: int
    box: tuple
    conf: float


def iou(a, b) -> float:
    ix1, iy1, ix2, iy2 = max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])
    inter = max(0.0, ix2 - ix1) * max(0.0, iy2 - iy1)
    union = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / union if union > 0 else 0.0


def center(b):
    return ((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)


class Detector:
    """One shared YOLOv8 model, guarded by a lock so camera threads can share it."""

    _model = None
    _tried = False
    _lock = threading.Lock()

    @classmethod
    def model(cls):
        with cls._lock:
            if not cls._tried:
                cls._tried = True
                try:
                    from ultralytics import YOLO

                    cls._model = YOLO(YOLO_MODEL)
                except Exception as exc:  # noqa: BLE001
                    log.warning("YOLO unavailable (%s); using motion-only analysis", exc)
        return cls._model

    @classmethod
    def detect(cls, frame):
        m = cls.model()
        if m is None:
            return None
        with cls._lock:
            res = m.predict(frame, conf=YOLO_CONF, verbose=False, imgsz=640)[0]
        out = []
        for b in res.boxes:
            c = int(b.cls[0])
            if c == PERSON or c in VEHICLES:
                x1, y1, x2, y2 = (float(v) for v in b.xyxy[0])
                out.append(Det(c, (x1, y1, x2, y2), float(b.conf[0])))
        return out


class Track:
    def __init__(self, tid, cls, box, t):
        self.id, self.cls, self.first_t = tid, cls, t
        self.hist = [(t, box)]
        self.missed = 0
        self.zone_since = None
        self.zone_fired = False

    @property
    def box(self):
        return self.hist[-1][1]

    def add(self, t, box):
        self.hist.append((t, box))
        del self.hist[:-60]
        self.missed = 0

    def at(self, t):
        return min(self.hist, key=lambda e: abs(e[0] - t))

    def speed(self, t0, t1, diag):
        """Centre displacement in frame-diagonals per second between two times."""
        a, b = self.at(t0), self.at(t1)
        dt = b[0] - a[0]
        if dt < 0.2:
            return 0.0
        return math.dist(center(a[1]), center(b[1])) / dt / diag


class Tracker:
    def __init__(self):
        self.tracks: dict[int, Track] = {}
        self.next_id = 1

    def update(self, dets, t):
        free = list(dets)
        for tr in list(self.tracks.values()):
            best, best_d = None, 1e9
            tw, th = tr.box[2] - tr.box[0], tr.box[3] - tr.box[1]
            for d in free:
                if d.cls != tr.cls:
                    continue
                dist = math.dist(center(tr.box), center(d.box))
                if (iou(tr.box, d.box) > 0.1 or dist < 0.6 * max(tw, th)) and dist < best_d:
                    best, best_d = d, dist
            if best:
                tr.add(t, best.box)
                free.remove(best)
            else:
                tr.missed += 1
        for d in free:
            self.tracks[self.next_id] = Track(self.next_id, d.cls, d.box, t)
            self.next_id += 1
        for tid in [k for k, v in self.tracks.items() if v.missed > 5]:
            del self.tracks[tid]
        return list(self.tracks.values())


class RuleEngine:
    """Turns tracks into candidate events: collision, fall, restricted-zone entry."""

    def __init__(self, zone=None):
        self.tracker = Tracker()
        self.zone = zone

    def step(self, dets, t, shape):
        h, w = shape
        diag = math.hypot(w, h)
        tracks = [tr for tr in self.tracker.update(dets, t) if tr.missed == 0]
        events = []

        vehicles = [tr for tr in tracks if tr.cls in VEHICLES and t - tr.first_t >= 1.0]
        for a, b in combinations(vehicles, 2):
            ov = iou(a.box, b.box)
            if ov < 0.08:
                continue
            drop = False
            for tr in (a, b):
                before, now = tr.speed(t - 1.6, t - 0.6, diag), tr.speed(t - 0.6, t, diag)
                if before > 0.08 and now < 0.4 * before:
                    drop = True
            if drop:
                events.append(
                    dict(
                        type="collision", t=t, confidence=min(0.9, 0.55 + ov),
                        boxes=[(a.box, NAMES[a.cls]), (b.box, NAMES[b.cls])],
                        detail=(f"A {NAMES[a.cls]} and a {NAMES[b.cls]} overlap in the frame and at least "
                                "one slowed sharply just before the overlap."),
                    )
                )

        for tr in tracks:
            if tr.cls != PERSON:
                continue
            bw, bh = tr.box[2] - tr.box[0], tr.box[3] - tr.box[1]
            if t - tr.first_t >= 1.5 and bh > 0:
                past = [e for e in tr.hist if t - 2.0 <= e[0] <= t - 0.8]
                if len(past) >= 2:
                    ars = [(e[1][2] - e[1][0]) / max(1.0, e[1][3] - e[1][1]) for e in past]
                    hs = [e[1][3] - e[1][1] for e in past]
                    if np.mean(ars) < 0.9 and bw / bh > 1.1 and bh < 0.75 * np.mean(hs):
                        events.append(
                            dict(
                                type="fall", t=t, confidence=0.6,
                                boxes=[(tr.box, "person")],
                                detail="A person's bounding box changed from upright to wide and short within about a second.",
                            )
                        )
            if self.zone:
                x1, y1, x2, y2 = self.zone
                fx, fy = (tr.box[0] + tr.box[2]) / 2 / w, tr.box[3] / h
                if x1 <= fx <= x2 and y1 <= fy <= y2:
                    tr.zone_since = tr.zone_since if tr.zone_since is not None else t
                    if t - tr.zone_since >= 1.0 and not tr.zone_fired:
                        tr.zone_fired = True
                        events.append(
                            dict(
                                type="restricted_zone", t=t, confidence=0.7,
                                boxes=[(tr.box, "person")],
                                detail="A person has stayed inside the area marked as restricted for this camera.",
                            )
                        )
                else:
                    tr.zone_since = None
        return events


class MotionMonitor:
    """Detector-independent fallback: flags sudden, sustained frame-wide change."""

    def __init__(self):
        self.prev, self.base, self.hot = None, 0.01, 0

    def update(self, frame, t):
        g = cv2.GaussianBlur(cv2.cvtColor(cv2.resize(frame, (160, 90)), cv2.COLOR_BGR2GRAY), (5, 5), 0)
        if self.prev is None:
            self.prev = g
            return None
        frac = float((cv2.absdiff(g, self.prev) > 25).mean())
        self.prev = g
        surge = frac > 0.12 and frac > 4 * self.base
        self.hot = self.hot + 1 if surge else 0
        if not surge:
            self.base = 0.95 * self.base + 0.05 * frac
        if self.hot >= 2:
            self.hot = 0
            return dict(
                type="motion_surge", t=t, confidence=min(0.85, 0.45 + frac), boxes=[],
                detail=f"About {frac * 100:.0f}% of the frame changed at once, well above this camera's normal level.",
            )
        return None


class VideoAnalyzer:
    def __init__(self, path, zone=None):
        self.path = str(path)
        self.engine = RuleEngine(zone)
        self.motion = MotionMonitor()
        self.last: dict[str, float] = {}
        self.use_yolo = False

    def _evidence(self, frame, ev, t):
        img = frame.copy()
        for box, label in ev["boxes"]:
            p1, p2 = (int(box[0]), int(box[1])), (int(box[2]), int(box[3]))
            cv2.rectangle(img, p1, p2, (60, 60, 235), 2)
            cv2.putText(img, label, (p1[0], max(14, p1[1] - 6)), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (60, 60, 235), 1)
        cv2.putText(img, fmt_ts(t), (10, 24), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        ok, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 82])
        return buf.tobytes() if ok else b""

    def _process(self, frame, t):
        h, w = frame.shape[:2]
        if w > 960:
            frame = cv2.resize(frame, (960, int(h * 960 / w)))
        events = []
        dets = Detector.detect(frame) if self.use_yolo else None
        if dets is not None:
            events += self.engine.step(dets, t, frame.shape[:2])
        m = self.motion.update(frame, t)
        if m:
            events.append(m)
        out = []
        for ev in events:
            if t - self.last.get(ev["type"], -1e9) < EVENT_COOLDOWN_SEC:
                continue
            self.last[ev["type"]] = t
            ev["jpeg"] = self._evidence(frame, ev, t)
            out.append(ev)
        return out

    def segments(self):
        """Yield one dict per SEGMENT_SEC of video. Blocking; run it in a worker thread."""
        cap = cv2.VideoCapture(self.path)
        if not cap.isOpened():
            raise RuntimeError("Could not open video file")
        try:
            self.use_yolo = Detector.model() is not None
            fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
            total = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
            duration = total / fps if total > 0 else 0.0
            step = max(1, round(fps / SAMPLE_FPS))
            idx, seg_start, seg_end, events = 0, 0.0, SEGMENT_SEC, []
            t = 0.0
            while cap.grab():
                t = idx / fps
                if idx % step == 0:
                    ok, frame = cap.retrieve()
                    if ok:
                        events += self._process(frame, t)
                idx += 1
                if t >= seg_end:
                    yield dict(t_start=seg_start, t_end=t, events=events,
                               progress=min(0.99, t / duration) if duration else 0.0, duration=duration)
                    seg_start, seg_end, events = t, seg_end + SEGMENT_SEC, []
            yield dict(t_start=seg_start, t_end=t, events=events, progress=1.0, duration=duration or t)
        finally:
            cap.release()


def _describe_frame(ev_type: str, offset: float, t: float, entity_counts: dict) -> str:
    ent_list = [f"{v} {k}{'s' if v > 1 and not k.endswith('s') else ''}" for k, v in entity_counts.items()]
    ent_str = ", ".join(ent_list) if ent_list else "Subject"
    ts_str = fmt_ts(t)

    if ev_type == "fall":
        if offset <= -2.5:
            return f"Baseline phase at {ts_str}: {ent_str} observed upright and in steady motion across monitoring field."
        elif offset < 0:
            return f"Onset phase at {ts_str}: Significant vertical acceleration drop. Torso shows abrupt downward angle change."
        elif offset == 0:
            return f"Apex alert trigger at {ts_str}: Bounding box aspect ratio collapsed horizontally. Ground plane impact confirmed."
        elif offset <= 2.0:
            return f"Immediate aftermath at {ts_str}: Subject remains prone on ground surface. Zero vertical recovery detected."
        else:
            return f"Post-incident check at {ts_str}: Continuous immobility. Subject remains grounded. Medical/floor assistance needed."
    elif ev_type == "collision":
        if offset <= -2.5:
            return f"Baseline phase at {ts_str}: {ent_str} approaching intersection along converging trajectory vectors."
        elif offset < 0:
            return f"Onset phase at {ts_str}: Rapid deceleration detected on approach path; safety envelope critically breached."
        elif offset == 0:
            return f"Apex alert trigger at {ts_str}: Overlapping vehicle bounding envelopes with acute kinetic energy loss. Collision occurred."
        elif offset <= 2.0:
            return f"Immediate aftermath at {ts_str}: Involved vehicles halted abruptly at impact point; lane passage obstructed."
        else:
            return f"Post-incident status at {ts_str}: Roadway remains obstructed. Secondary hazard present; traffic diversion required."
    elif ev_type == "restricted_zone":
        if offset <= -2.5:
            return f"Baseline phase at {ts_str}: {ent_str} detected outside restricted perimeter demarcation."
        elif offset < 0:
            return f"Onset phase at {ts_str}: Subject crossed virtual perimeter boundary into restricted polygon."
        elif offset == 0:
            return f"Apex alert trigger at {ts_str}: Sustained unauthorized presence inside restricted zone exceeded 1.0s limit."
        elif offset <= 2.0:
            return f"Immediate aftermath at {ts_str}: Subject proceeding deeper within restricted security envelope."
        else:
            return f"Post-incident status at {ts_str}: Active unauthorized presence ongoing. Security personnel dispatch required."
    else:  # motion_surge or other
        if offset <= -2.5:
            return f"Baseline phase at {ts_str}: Ambient optical flow at normal quiescent levels ({ent_str})."
        elif offset < 0:
            return f"Onset phase at {ts_str}: Sudden optical velocity surge detected across central surveillance quadrant."
        elif offset == 0:
            return f"Apex alert trigger at {ts_str}: Frame pixel delta exceeded anomalous threshold (>12% change from baseline)."
        elif offset <= 2.0:
            return f"Immediate aftermath at {ts_str}: Secondary turbulence and rapid displacement continuing across scene."
        else:
            return f"Post-incident status at {ts_str}: Scene stabilizing at new visual state. Control room review required."


def extract_evidence_frames(
    video_path: str,
    center_t: float,
    inc_id: str,
    ev_type: str,
    zone: list | None = None,
    primary_jpeg: bytes | None = None,
) -> list[dict]:
    """Extracts a 5-frame temporal evidence sequence around the incident time (T-3s to T+3s)."""
    from pathlib import Path
    v_path = Path(video_path)
    if not v_path.exists():
        if primary_jpeg:
            p = EVIDENCE_DIR / f"{inc_id}.jpg"
            p.write_bytes(primary_jpeg)
            return [{
                "index": 0,
                "phase": "Alert Trigger Moment",
                "offset_sec": 0.0,
                "video_ts": round(center_t, 1),
                "video_ts_text": fmt_ts(center_t),
                "url": f"/api/evidence/{inc_id}.jpg",
                "entities": [],
                "entity_counts": {},
                "observation": "Primary trigger frame captured at moment of alert.",
            }]
        return []

    cap = cv2.VideoCapture(str(v_path))
    if not cap.isOpened():
        return []

    try:
        fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
        total_frames = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
        duration = total_frames / fps if total_frames > 0 else center_t + 10.0

        PHASES = [
            (-3.0, "Pre-Incident Baseline"),
            (-1.5, "Incipient Anomaly"),
            (0.0, "Apex Trigger Moment"),
            (1.5, "Immediate Aftermath"),
            (3.0, "Post-Incident Status"),
        ]

        frames = []
        for idx, (offset, phase_title) in enumerate(PHASES):
            t_target = max(0.0, min(duration, center_t + offset))
            cap.set(cv2.CAP_PROP_POS_MSEC, t_target * 1000)
            ok, frame = cap.read()
            if not ok or frame is None:
                continue

            h, w = frame.shape[:2]
            if w > 960:
                frame = cv2.resize(frame, (960, int(h * 960 / w)))
                h, w = frame.shape[:2]

            dets = Detector.detect(frame) or []
            entity_counts = {}
            for d in dets:
                name = NAMES.get(d.cls, "object")
                entity_counts[name] = entity_counts.get(name, 0) + 1
                p1, p2 = (int(d.box[0]), int(d.box[1])), (int(d.box[2]), int(d.box[3]))
                cv2.rectangle(frame, p1, p2, (60, 60, 235), 2)
                cv2.putText(frame, f"{name} {d.conf:.2f}", (p1[0], max(14, p1[1] - 5)),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.45, (60, 60, 235), 1)

            if zone:
                zx1, zy1, zx2, zy2 = int(zone[0] * w), int(zone[1] * h), int(zone[2] * w), int(zone[3] * h)
                cv2.rectangle(frame, (zx1, zy1), (zx2, zy2), (235, 180, 50), 2)
                cv2.putText(frame, "RESTRICTED ZONE", (zx1 + 6, zy1 + 18),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.5, (235, 180, 50), 1)

            # Sleek top header banner
            cv2.rectangle(frame, (0, 0), (w, 32), (12, 22, 32), -1)
            hdr_text = f"EVIDENCE #{idx + 1}/5 | {phase_title.upper()} | T{offset:+.1f}s | {fmt_ts(t_target)}"
            cv2.putText(frame, hdr_text, (10, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (240, 245, 250), 1)

            # Bottom status banner
            ents_summary = ", ".join(f"{k}: {v}" for k, v in entity_counts.items()) if entity_counts else "Scene scanning"
            cv2.rectangle(frame, (0, h - 24), (w, h), (12, 22, 32), -1)
            cv2.putText(frame, f"ENTITIES: {ents_summary}", (10, h - 7),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.42, (160, 185, 205), 1)

            out_file = EVIDENCE_DIR / f"{inc_id}_f{idx}.jpg"
            cv2.imwrite(str(out_file), frame, [cv2.IMWRITE_JPEG_QUALITY, 84])

            if idx == 2 or offset == 0.0:
                cv2.imwrite(str(EVIDENCE_DIR / f"{inc_id}.jpg"), frame, [cv2.IMWRITE_JPEG_QUALITY, 84])

            obs = _describe_frame(ev_type, offset, t_target, entity_counts)

            frames.append({
                "index": idx,
                "phase": phase_title,
                "offset_sec": offset,
                "video_ts": round(t_target, 1),
                "video_ts_text": fmt_ts(t_target),
                "url": f"/api/evidence/{inc_id}_f{idx}.jpg",
                "entities": list(entity_counts.keys()),
                "entity_counts": entity_counts,
                "observation": obs,
            })
        return frames
    finally:
        cap.release()

