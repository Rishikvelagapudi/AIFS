# AIFS — Artificial Intelligence Forensic System

A unified, multi-module AI surveillance, forensic inspection, and behavior analysis platform designed for civic governance, smart city security operations, and the Fusion AI Summit 2026.

---

## 🏛️ System Architecture & Folder Structure

```
AIFS/
├── landing-page/                     # Executive portal, leaders, honorable speakers, public AI comics
├── incident-desk/                    # Multi-camera 3x3 CCTV surveillance & real-time response agent
├── ai-forensic/                      # Neural deepfake detection, audio/voiceprint & media tampering lab
├── post-fetch-and-behavior-analysis/ # Spatial-temporal trajectory mapping & behavior telemetry
├── backend/                          # FastAPI, YOLOv8 vision pipeline, asyncio orchestrator & WebSocket hub
└── frontend/                         # Vite + React unified responsive application
    └── src/
        ├── landing-page/             # Landing page components & summit data
        ├── incident-desk/            # 3x3 CCTV grid, focus inspector, queue, report modals
        ├── ai-forensic/              # AI forensic deepfake & biometric analysis suite
        ├── post-fetch-and-behavior-analysis/ # Trajectory tracking & behavior analytics
        ├── App.jsx                   # Central module router
        └── styles.css                # Global HUD, glassmorphism & responsive styles
```

---

## 🚀 The 4 Core Modules

### 1. Landing Page (`landing-page/`)
- Hon'ble Patrons & Leadership circular gold-frame showcase.
- Keynote dignitaries and industry leaders from Govt of AP, AidenAI, Murata, Infosys, TCS, Alphanome.AI, and Dharanova.
- 4 Public AI awareness comic art panels with interactive lightbox zoom.
- One-touch routing to all sub-systems.

### 2. Incident Desk (`incident-desk/`)
- 3×3 CCTV matrix surveillance wall with live timecodes, CRT scanlines, and zone tags.
- Automated YOLOv8 multi-camera incident queue with audio voice dispatch alerts.
- High-resolution Focus Inspector with synchronized video scrubber and multi-frame evidence filmstrip (T-3.0s to T+3.0s).
- Full-page investigation dossier with telemetry metrics, root-cause computer vision analysis, and SOP checklist.

### 3. AI Forensic Laboratory (`ai-forensic/`)
- Neural deepfake & synthetic media verification (MesoNet-Inception v4).
- 68-point facial landmark deviation & blink rate periodicity audit.
- High-frequency vocoder audio spectral analysis (>14kHz cutoff detection).
- SHA-256 cryptographic chain of custody and downloadable forensic certificates.

### 4. Post Fetch & Behavior Analysis (`post-fetch-and-behavior-analysis/`)
- Post-event surveillance query engine filtering past events by object class, camera zone, and time window.
- Multi-camera trajectory reconstruction tracking suspect transit across waypoints.
- Dwell-time violation alerts for restricted security perimeters (e.g. Server Room Vault).
- Kinematic velocity curves and spatial density anomaly heatmaps.

---

## 💻 Quick Start

### 1. Backend Service
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --port 8000
```

### 2. Frontend Application (Dev)
```bash
cd frontend
npm install
npm run dev
# Open http://localhost:5173
```

### 3. Production Build
```bash
cd frontend
npm run build
# Or launch through backend at http://localhost:8000
```
