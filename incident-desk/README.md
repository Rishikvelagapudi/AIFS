# Incident Desk Module — AIFS

**Multi-Camera Real-Time Incident Management & CCTV Surveillance Agent**

## Overview
The Incident Desk is Module 01 of the Artificial Intelligence Forensic System (AIFS). It ingests concurrent CCTV camera streams, performs real-time YOLOv8 computer vision detection, queues prioritized safety incidents, triggers voice alerts, and provides full-page forensic dossiers.

## Features
- **3×3 CCTV Surveillance Matrix Wall:** Simultaneous 9-camera CCTV monitoring wall with active recording indicators, zone labels, timecode HUD reticles, and scanlines.
- **Automated Anomaly Detection:**
  - Vehicle collision (Critical)
  - Person fall / ground posture loss (High; escalates to Critical near collisions)
  - Unauthorized entry into restricted zones (High)
  - Sudden abnormal motion & optical flow disruption (Medium)
- **High-Resolution Focus Inspector:** Synchronized video scrubber, apex evidence frame, and multi-frame sequence viewer (T-3.0s to T+3.0s).
- **Audio Voice Dispatch:** Automatic text-to-speech voice alerts for critical and high-priority incidents.
- **Complete Video Report Modal:** Full-page incident dossier with telemetry metrics, root cause analysis, threat evaluation, SOP directive checklist, and operator sign-off notes.

## Run & Start
```bash
# Backend server
cd backend && pip install -r requirements.txt
uvicorn main:app --port 8000

# Frontend development
cd frontend && npm install && npm run dev
```

## File Structure
- `frontend/src/incident-desk/`
  - `IncidentDesk.jsx`: Main Incident Desk page component.
  - `CCTVGrid3x3.jsx`: 3x3 surveillance grid wall.
  - `FocusPanel.jsx`: High-res player and clip timeline.
  - `Queue.jsx`: Live incident queue & closed incident history.
  - `Report.jsx`: Live report and deep investigation trigger.
  - `CompleteVideoReportModal.jsx`: Modal investigation dossier.
  - `ReportPromptDialog.jsx`: Detailed report inquiry modal.
  - `cctvChannels.js`: Channel metadata and status maps.
  - `api.js`: Video upload, incident patching, and deep investigation API client.
