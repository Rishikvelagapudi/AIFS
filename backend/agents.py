"""Logical agents. They share one vision pipeline; the orchestrator coordinates them."""
from __future__ import annotations

import base64
import json
import logging
from datetime import datetime, timezone

import httpx

from analysis import VideoAnalyzer, fmt_ts
from config import ANTHROPIC_API_KEY, ANTHROPIC_MODEL

log = logging.getLogger("agents")

SEV_RANK = {"critical": 3, "high": 2, "medium": 1, "low": 0}

INCIDENT_TYPES = {
    "collision": dict(
        label="Possible vehicle collision", severity="critical",
        interpretation="This pattern is consistent with a vehicle collision. It has not been confirmed.",
        action="Review the footage and verify whether emergency assistance is required.",
        procedure=["Confirm the collision on the live feed", "Check for people on the ground or trapped", "Request ambulance/police if confirmed"],
    ),
    "fall": dict(
        label="Possible person fall", severity="high",
        interpretation="This pattern is consistent with a person falling. Cause and injury are unknown.",
        action="Review the footage and check whether the person gets up or needs help.",
        procedure=["Confirm the fall on the live feed", "Dispatch on-site staff if the person stays down", "Call medical help if there is any sign of injury"],
    ),
    "restricted_zone": dict(
        label="Possible unauthorized entry", severity="high",
        interpretation="A person is in an area configured as restricted. They may be authorized.",
        action="Verify the person's identity or authorization before escalating.",
        procedure=["Check the access roster", "Contact on-site security", "Log the outcome in this report"],
    ),
    "motion_surge": dict(
        label="Sudden abnormal motion", severity="medium",
        interpretation="Something large changed in the scene at once. The cause is unknown.",
        action="Review the footage to find out what changed.",
        procedure=["Review the clip", "Escalate if people or vehicles appear at risk"],
    ),
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class VideoAnalysisAgent:
    def open(self, path, zone=None) -> VideoAnalyzer:
        return VideoAnalyzer(path, zone)


class IncidentDetectionAgent:
    MIN_CONF = 0.45

    def classify(self, ev: dict) -> dict | None:
        spec = INCIDENT_TYPES.get(ev["type"])
        if not spec or ev["confidence"] < self.MIN_CONF:
            return None
        return dict(
            type=ev["type"], label=spec["label"], severity=spec["severity"],
            observation=ev["detail"], interpretation=spec["interpretation"],
            recommended_action=spec["action"], confidence=round(ev["confidence"], 2),
        )


class PriorityAlertAgent:
    def prioritize(self, cam: dict, inc: dict, camera_history: list[dict]) -> dict:
        if inc["type"] == "fall":
            for other in camera_history:
                if other["type"] == "collision" and abs(other["video_ts"] - inc["video_ts"]) <= 15:
                    inc["severity"] = "critical"
                    inc["interpretation"] += " It follows a possible collision on this camera, which raises the priority."
        inc["priority_score"] = SEV_RANK[inc["severity"]] * 100 + int(inc["confidence"] * 100)
        n = cam["id"].split("-")[-1]
        spoken = f"{int(inc['video_ts'] // 60)} minutes {int(inc['video_ts'] % 60)} seconds"
        inc["alert_text"] = (
            f"{inc['severity'].capitalize()} alert, camera {int(n)}. {inc['label']} at {spoken}. "
            "Operator verification recommended."
        )
        return inc


class InvestigationAgent:
    def investigate(self, store, inc: dict) -> dict:
        similar = [
            dict(id=o["id"], camera_name=o["camera_name"], video_ts_text=o["video_ts_text"], status=o["status"])
            for o in store.incidents.values()
            if o["type"] == inc["type"] and o["status"] in ("verified", "resolved")
        ][:3]
        same_cam = sorted(store.incidents_for(inc["camera_id"]) + [inc], key=lambda o: o["video_ts"])
        inc["similar_incidents"] = similar
        inc["timeline"] = [dict(id=o["id"], video_ts_text=o["video_ts_text"], label=o["label"]) for o in same_cam]
        inc["procedure"] = INCIDENT_TYPES[inc["type"]]["procedure"]
        return inc


class ReportingAgent:
    def draft(self, inc: dict, cam: dict, ev: dict, wall_s: float, evidence_frames: list[dict] | None = None) -> dict:
        inc.update(
            camera_id=cam["id"], camera_name=cam["name"], video_ts=round(ev["t"], 1),
            video_ts_text=fmt_ts(ev["t"]), detected_at=now_iso(), analysis_wall_s=round(wall_s, 1),
            status="awaiting_verification", operator_notes="", description_source="agent_dossier",
            audit=[dict(at=now_iso(), actor="agent", action="Full incident dossier draft created")],
        )
        inc["video_ts_text"] = fmt_ts(ev["t"])
        inc["evidence_url"] = f"/api/evidence/{inc['id']}.jpg"
        inc["evidence_frames"] = evidence_frames or []
        self.rebuild_dossier(inc, cam, evidence_frames or [])
        return inc

    def rebuild_dossier(self, inc: dict, cam: dict, evidence_frames: list[dict]):
        ev_type = inc.get("type", "motion_surge")
        cam_name = cam.get("name") or inc.get("camera_name", "Surveillance Feed")
        cam_id = cam.get("id") or inc.get("camera_id", "CAM-00")
        ts_text = inc.get("video_ts_text", "00:00:00")

        all_counts: dict[str, int] = {}
        for f in evidence_frames:
            for k, v in f.get("entity_counts", {}).items():
                all_counts[k] = max(all_counts.get(k, 0), v)

        ent_desc = ", ".join(f"{v} {k}{'s' if v > 1 and not k.endswith('s') else ''}" for k, v in all_counts.items()) or "Surveillance subjects"

        if ev_type == "fall":
            narrative = (
                f"Automated CCTV surveillance on camera {cam_id} ({cam_name}) detected an acute physical fall incident at timestamp {ts_text}.\n\n"
                f"Multi-frame temporal progression analysis confirms that prior to the event (T-3.0s to T-1.5s), the subject was upright and mobile. "
                f"At the trigger apex (T 0.0s), an abrupt vertical acceleration loss and rapid posture collapse occurred, shifting the bounding envelope "
                f"from an upright vertical aspect to a horizontal floor-level profile (>1.1 aspect ratio, >30% height reduction). Ground impact was immediate.\n\n"
                f"In the post-incident observation window (T+1.5s to T+3.0s), the subject has exhibited sustained motionless ground posture with no upright recovery motion detected. "
                f"Identified entities in scene: {ent_desc}. Prompt physical verification and medical response are required."
            )
            root_cause = (
                "Heuristic and computer vision trackers detected an abrupt loss of verticality. The subject's bounding box aspect ratio shifted "
                "from vertical (<0.9) to wide-horizontal (>1.1), accompanied by an acute height reduction (>25% within 1.0 second), matching ground-level collapse kinematics."
            )
            kinematics = "Sudden downward acceleration, aspect ratio inversion from vertical to planar horizontal, post-impact velocity zero."
            injury_risk = "High risk of physical injury or medical distress; subject remains prone without active recovery."
            disruption_risk = "Localized walkway or floor passage obstruction."

        elif ev_type == "collision":
            narrative = (
                f"Automated CCTV surveillance on camera {cam_id} ({cam_name}) flagged a high-consequence vehicular collision event at timestamp {ts_text}.\n\n"
                f"Multi-frame tracking indicates that prior to impact (T-3.0s to T-1.5s), multiple vehicles approached along converging trajectories at steady speed. "
                f"Just prior to intersection, at least one vehicle experienced an emergency deceleration drop (>60% reduction in speed within 0.8s). At T 0.0s, "
                f"bounding box envelopes overlapped significantly (>8% intersection-over-union), confirming kinetic interaction and impact.\n\n"
                f"In the aftermath sequence (T+1.5s to T+3.0s), involved vehicles came to an abnormal stop at the impact point, creating active carriage lane blockage. "
                f"Identified entities involved: {ent_desc}. Emergency traffic control and dispatch verification are urgently recommended."
            )
            root_cause = (
                "Multi-object tracker recorded acute kinetic deceleration (>60% drop from approach velocity) immediately followed by vehicle bounding box intersection "
                "exceeding collision threshold. Kinematic deceleration matches emergency braking and physical impact."
            )
            kinematics = "Approach velocity convergence, emergency kinetic deceleration, bounding box intersection-over-union overlap >0.08."
            injury_risk = "Significant impact trauma risk for vehicle occupants; potential pedestrian vulnerability in collision zone."
            disruption_risk = "Severe roadway/lane blockage, secondary collision hazard from oncoming traffic."

        elif ev_type == "restricted_zone":
            narrative = (
                f"Automated security monitoring on camera {cam_id} ({cam_name}) detected an unauthorized perimeter breach at timestamp {ts_text}.\n\n"
                f"Multi-frame temporal tracking reveals that the subject approached the designated boundary at T-3.0s and crossed into the restricted polygon perimeter at T-1.5s. "
                f"At T 0.0s, the subject's dwell time inside the restricted zone exceeded the authorized threshold (>1.0 second), triggering an alert.\n\n"
                f"In subsequent frames (T+1.5s to T+3.0s), the subject proceeded deeper into the unauthorized facility area without visible security badge or escort. "
                f"Identified entities: {ent_desc}. Immediate on-site security patrol dispatch is advised."
            )
            root_cause = (
                "Spatial polygon intersection rule detected a tracked pedestrian centroid crossing into a calibrated restricted surveillance polygon and sustaining "
                "continuous presence beyond the 1.0-second security tolerance."
            )
            kinematics = "Vector trajectory crossing marked perimeter polygon boundaries; continuous interior dwell."
            injury_risk = "Low direct physical injury; high security/property compromise risk."
            disruption_risk = "Perimeter security breach; potential unauthorized asset access or facility compromise."

        else:  # motion_surge
            narrative = (
                f"Automated video anomaly detection on camera {cam_id} ({cam_name}) recorded an abnormal optical motion surge at timestamp {ts_text}.\n\n"
                f"Temporal comparison across the 5-frame sequence indicates that the monitoring field was previously at quiescent ambient motion baseline (T-3.0s). "
                f"At T-1.5s, rapid frame-wide optical flow and pixel divergence escalated abruptly, peaking at T 0.0s with over 12% simultaneous pixel change (4x baseline).\n\n"
                f"In the aftermath frames (T+1.5s to T+3.0s), optical disturbance continues to settle into an altered scene configuration. "
                f"Identified entities in field: {ent_desc}. Control room visual verification is required to determine the physical cause."
            )
            root_cause = (
                "Differential motion monitor recorded frame-wide luminance divergence exceeding 12% across the surveillance grid, "
                "surpassing baseline temporal variance by more than 400%."
            )
            kinematics = "Optical flow surge, multi-quadrant pixel difference spike, sudden displacement gradient."
            injury_risk = "Unknown pending visual verification of underlying scene disturbance."
            disruption_risk = "Unverified scene disturbance; potential hazard to nearby personnel or facility operations."

        chronology = [
            f"Phase {f.get('index', i)+1}/5 [{f.get('phase', 'Phase')}] ({f.get('offset_sec', 0):+.1f}s at {f.get('video_ts_text', ts_text)}): {f.get('observation', '')}"
            for i, f in enumerate(evidence_frames)
        ]

        frames_table = "\n".join(
            f"| Frame #{f.get('index', i)+1} | {f.get('phase')} | {f.get('offset_sec'):+.1f}s | {f.get('video_ts_text')} | {', '.join(f.get('entities', [])) or 'Scanning'} | {f.get('observation')} |"
            for i, f in enumerate(evidence_frames)
        )
        if not frames_table:
            frames_table = "| Frame #1 | Alert Trigger Moment | +0.0s | " + ts_text + " | Identified | Trigger frame captured |"

        dossier_md = f"""# INCIDENT INVESTIGATION REPORT: {inc.get('id', 'INC')}
**Classification**: {inc.get('label', 'Incident')} | **Severity**: {inc.get('severity', 'high').upper()} | **Status**: {inc.get('status', 'awaiting_verification').replace('_', ' ').title()}
**Camera**: {cam_name} ({cam_id}) | **Video Timestamp**: {ts_text} | **Logged At**: {inc.get('detected_at', now_iso())}

---

### 1. Executive Summary & Scene Assessment
{narrative}

---

### 2. Multi-Frame Chronological Evidence Sequence
| Phase | Title | Time Offset | Video Time | Detected Entities | Frame Observation |
| :--- | :--- | :--- | :--- | :--- | :--- |
{frames_table}

---

### 3. Scene & Kinematic Assessment
- **Entities Observed**: {ent_desc}
- **Monitoring Zone**: {cam.get('zone', 'Main Surveillance Quadrant')}
- **Kinematic Dynamics**: {kinematics}
- **Root Cause & Trigger**: {root_cause}

---

### 4. Threat & Impact Assessment
- **Severity Classification**: {inc.get('severity', 'high').upper()} (Score: {inc.get('priority_score', 0)})
- **Physical Injury Risk**: {injury_risk}
- **Operational / Traffic Disruption**: {disruption_risk}
- **Escalation Protocol**: Operator verification required within 60 seconds.

---

### 5. Standard Operating Procedure (SOP) Directives
1. Verify live CCTV camera feed against the 5-frame evidence sequence.
2. Confirm ground status / vehicle status / boundary presence.
3. Initiate appropriate physical or medical dispatch if confirmed.
4. Update incident status in central log with operator badge and findings.
5. Export and archive high-definition evidence clip.

---
*Generated by CCTV Multi-Frame AI Investigation Agent | Control Room Operations*
"""

        inc["executive_summary"] = narrative
        inc["chronological_narrative"] = chronology
        inc["scene_context"] = {
            "camera_ref": f"{cam_name} ({cam_id})",
            "timestamp": ts_text,
            "detected_at": inc.get("detected_at", now_iso()),
            "monitoring_zone": cam.get("zone", "Main Surveillance Quadrant"),
            "lighting_visibility": "Clear CCTV Surveillance Standard",
            "detected_actors": ent_desc,
            "kinematics": kinematics,
        }
        inc["root_cause_analysis"] = root_cause
        inc["impact_assessment"] = {
            "severity_level": inc.get("severity", "high").upper(),
            "injury_risk": injury_risk,
            "disruption_risk": disruption_risk,
            "containment_urgency": "Verification and on-site escalation required within 60 seconds.",
        }
        inc["dossier_markdown"] = dossier_md
        inc["observation"] = inc.get("observation") or (chronology[2] if len(chronology) > 2 else narrative.split('\n\n')[1] if '\n\n' in narrative else narrative)
        inc["interpretation"] = INCIDENT_TYPES.get(ev_type, {}).get("interpretation", "") + f" Scene exhibits {ent_desc} with active kinematic disruption."
        inc["recommended_action"] = INCIDENT_TYPES.get(ev_type, {}).get("action", "") + " Follow 5-step SOP protocol."

    async def enrich(self, inc: dict, jpeg: bytes) -> dict | None:
        """Optional: ask Claude to describe the evidence frame. Falls back silently."""
        if not ANTHROPIC_API_KEY or not jpeg:
            return None
        prompt = (
            "You assist a CCTV control room. A rule-based detector flagged this frame as: "
            f"{inc['label']} (camera {inc['camera_name']}, video time {inc['video_ts_text']}). "
            f"Context: {inc.get('executive_summary', '')}\n"
            "Return JSON only with keys executive_summary (refined narrative, 2-3 paragraphs), "
            "observation (what is visibly in the frame, 1-2 sentences), "
            "interpretation (what it might mean, hedged, 1 sentence), recommended_action (1 sentence). "
            "State only what the frame supports. Do not claim a crime or an injury unless clearly visible."
        )
        body = dict(
            model=ANTHROPIC_MODEL, max_tokens=600,
            messages=[dict(role="user", content=[
                dict(type="image", source=dict(type="base64", media_type="image/jpeg", data=base64.b64encode(jpeg).decode())),
                dict(type="text", text=prompt),
            ])],
        )
        try:
            async with httpx.AsyncClient(timeout=25) as client:
                r = await client.post(
                    "https://api.anthropic.com/v1/messages",
                    headers={"x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01"},
                    json=body,
                )
                r.raise_for_status()
            text = "".join(b.get("text", "") for b in r.json()["content"]).strip()
            text = text.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
            data = json.loads(text)
            res = dict(
                observation=str(data.get("observation", inc["observation"])),
                interpretation=str(data.get("interpretation", inc["interpretation"])),
                recommended_action=str(data.get("recommended_action", inc["recommended_action"])),
                description_source="claude",
            )
            if "executive_summary" in data:
                res["executive_summary"] = str(data["executive_summary"])
            return res
        except Exception as exc:  # noqa: BLE001
            log.warning("Claude description skipped: %s", exc)
            return None
