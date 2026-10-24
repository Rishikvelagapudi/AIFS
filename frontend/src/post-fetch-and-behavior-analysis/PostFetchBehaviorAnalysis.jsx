import { useState } from "react";

const DEMO_TRAJECTORIES = [
  {
    id: "TRJ-904",
    targetName: "Subject #8412 (Black Jacket, Red Backpack)",
    category: "Restricted Zone Loitering & Egress Anomaly",
    severity: "critical",
    riskScore: 92,
    timeWindow: "09:14:00 - 09:38:15",
    totalDwellTime: "24m 15s",
    path: [
      { step: 1, cam: "CAM-01", name: "Main Entrance North", zone: "Zone A - Gate 1", time: "09:14:22", speed: "1.1 m/s (Walking)", event: "Ingress detected" },
      { step: 2, cam: "CAM-04", name: "Lobby & Reception", zone: "Zone A - Atrium", time: "09:17:40", speed: "0.9 m/s (Browsing)", event: "Bypassed security checkpoint" },
      { step: 3, cam: "CAM-02", name: "Corridor East Wing", zone: "Zone B - Concourse", time: "09:21:10", speed: "1.4 m/s (Fast walk)", event: "Directional transit" },
      { step: 4, cam: "CAM-05", name: "Server Room Vault", zone: "Zone D - Restricted", time: "09:24:30", speed: "0.2 m/s (Stationary)", event: "🚨 Unauthorized Dwell (>12 mins in Restricted Vault)" },
      { step: 5, cam: "CAM-07", name: "Emergency Exit South", zone: "Zone B - Stairwell", time: "09:37:05", speed: "4.3 m/s (Running)", event: "🚨 Sudden velocity spike / Emergency door push" }
    ],
    behaviorMetrics: {
      dwellTimeAlert: "12m 35s in Vault (Max threshold: 0m 0s for unbadged)",
      velocityDiscrepancy: "390% sudden acceleration before egress",
      gaitStability: "Normal walking transitioned to rapid evasion",
      facialGazeDeviation: "Avoided overhead CCTV optics 7 times",
    },
    observations: [
      "Subject entered through public gate but avoided receptionist desk.",
      "Tailgated authorized engineer through Server Room Vault magnetic airlock at 09:24.",
      "Stayed stationary near rack B-04 for 12.5 minutes before perimeter alert triggered.",
      "Departed via South stairwell fire door at sprint velocity."
    ]
  },
  {
    id: "TRJ-905",
    targetName: "Unattended Cargo / Abandoned Bag Event",
    category: "Stationary Object Persistence Analysis",
    severity: "high",
    riskScore: 78,
    timeWindow: "10:45:10 - 11:15:00",
    totalDwellTime: "29m 50s",
    path: [
      { step: 1, cam: "CAM-06", name: "Basement Parking B2", zone: "Zone E - Parking", time: "10:45:10", speed: "0.8 m/s", event: "Vehicle parked at Bay 14" },
      { step: 2, cam: "CAM-06", name: "Basement Parking B2", zone: "Zone E - Parking", time: "10:46:50", speed: "0.0 m/s", event: "⚠️ Backpack placed near pillar C4" },
      { step: 3, cam: "CAM-06", name: "Basement Parking B2", zone: "Zone E - Parking", time: "10:48:10", speed: "1.6 m/s", event: "Owner departed area without cargo" }
    ],
    behaviorMetrics: {
      dwellTimeAlert: "26m 40s stationary without owner in 10m radius",
      velocityDiscrepancy: "Static zero-optical-flow persistence",
      gaitStability: "N/A (Stationary Object)",
      facialGazeDeviation: "N/A",
    },
    observations: [
      "Backpack placed beside pillar C4 at 10:46:50.",
      "Owner vehicle drove away toward exit ramp at 10:48:10.",
      "Optical tracking confirms bag remains unattended with zero interaction.",
      "Protocol 4-B unattended item safety inspection recommended."
    ]
  },
  {
    id: "TRJ-906",
    targetName: "Loading Dock Reverse Directional Breaching",
    category: "Wrong-Way Traffic & Speed Telemetry",
    severity: "medium",
    riskScore: 64,
    timeWindow: "11:20:00 - 11:32:00",
    totalDwellTime: "12m 00s",
    path: [
      { step: 1, cam: "CAM-08", name: "Loading Bay Dock 3", zone: "Zone F - Logistics", time: "11:21:15", speed: "2.4 m/s", event: "Wrong-way forklift approach" },
      { step: 2, cam: "CAM-08", name: "Loading Bay Dock 3", zone: "Zone F - Logistics", time: "11:25:30", speed: "0.3 m/s", event: "Blocked emergency fire shutter lane" }
    ],
    behaviorMetrics: {
      dwellTimeAlert: "4m 15s lane obstruction",
      velocityDiscrepancy: "Reverse vector travel against one-way markings",
      gaitStability: "Vehicle optical flow heading 180° inverted",
      facialGazeDeviation: "N/A",
    },
    observations: [
      "Logistics vehicle crossed yellow safety boundary in reverse direction.",
      "Temporarily obstructed fire containment shutter threshold.",
      "Operator notified via automated audio speaker dispatch."
    ]
  }
];

export default function PostFetchBehaviorAnalysis({ onReturnHome, onNavigateModule }) {
  const [selectedCase, setSelectedCase] = useState(DEMO_TRAJECTORIES[0]);
  const [activeCamFilter, setActiveCamFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStep, setActiveStep] = useState(0);

  const handleExportJson = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(selectedCase, null, 2));
    const dl = document.createElement("a");
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", `AIFS_PostFetch_Behavior_${selectedCase.id}.json`);
    dl.click();
  };

  return (
    <div className="desk post-fetch-screen">
      {/* Top Header Bar */}
      <header className="bar">
        <button className="btn btn-sm btn-home" onClick={onReturnHome} title="Return to Landing Page">
          ← Home
        </button>
        <div className="bar-title-wrap">
          <h1>Post Fetch & Behavior Analysis</h1>
          <span className="module-badge">AIFS Module 03</span>
        </div>
        <div className="bar-stats">
          <span className="pill pill-source">Multi-Camera Trajectory & Kinematics</span>
          <span className="pill pill-ok">Spatial Temporal Engine Active</span>
        </div>
        <div className="bar-actions">
          <button className="btn btn-primary" onClick={handleExportJson}>
            📥 Export Trajectory Dossier
          </button>
          <button className="btn" onClick={() => onNavigateModule("ai-forensic")}>
            Go to AI Forensic →
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="post-fetch-body">
        {/* Top Query & Search Filter Bar */}
        <div className="post-fetch-filter-bar">
          <div className="filter-item">
            <span className="matrix-icon">🔎</span>
            <strong>POST-FETCH SEARCH QUERY:</strong>
          </div>
          <div className="filter-input-wrap">
            <input
              type="text"
              placeholder="Search by Target ID, Clothing, Camera, or Anomaly..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pf-search-input"
            />
          </div>
          <div className="trajectory-buttons-row">
            {DEMO_TRAJECTORIES.map((t) => (
              <button
                key={t.id}
                className={`btn btn-sm ${selectedCase.id === t.id ? "btn-primary" : ""}`}
                onClick={() => {
                  setSelectedCase(t);
                  setActiveStep(0);
                }}
              >
                {t.id}: {t.category.slice(0, 24)}…
              </button>
            ))}
          </div>
        </div>

        {/* 2-Column Behavior Layout */}
        <div className="behavior-grid">
          {/* Left Column: Trajectory Mapping & Multi-Camera Path Replay */}
          <div className="behavior-main-pane">
            {/* Target Profile Card */}
            <div className="target-profile-card">
              <div className="target-card-top">
                <div>
                  <span className="case-tag">{selectedCase.id}</span>
                  <h2>{selectedCase.targetName}</h2>
                  <span className="target-meta">
                    Window: {selectedCase.timeWindow} · Total Duration: {selectedCase.totalDwellTime}
                  </span>
                </div>
                <div className="risk-score-box">
                  <span className={`risk-badge sev-${selectedCase.severity}`}>
                    RISK SCORE: {selectedCase.riskScore}/100
                  </span>
                  <span className="risk-label">{selectedCase.category}</span>
                </div>
              </div>

              {/* Behavior Telemetry Tiles */}
              <div className="behavior-telemetry-grid">
                <div className="b-card">
                  <span className="b-label">DWELL TIME VIOLATION</span>
                  <strong>{selectedCase.behaviorMetrics.dwellTimeAlert}</strong>
                  <span className="b-sub">Restricted Zone Dwell Engine</span>
                </div>
                <div className="b-card">
                  <span className="b-label">VELOCITY ANOMALY</span>
                  <strong>{selectedCase.behaviorMetrics.velocityDiscrepancy}</strong>
                  <span className="b-sub">Kinematic Acceleration Curve</span>
                </div>
                <div className="b-card">
                  <span className="b-label">GAIT & STABILITY</span>
                  <strong>{selectedCase.behaviorMetrics.gaitStability}</strong>
                  <span className="b-sub">Pose Vector Analysis</span>
                </div>
                <div className="b-card">
                  <span className="b-label">SURVEILLANCE EVASION</span>
                  <strong>{selectedCase.behaviorMetrics.facialGazeDeviation}</strong>
                  <span className="b-sub">Camera Gaze Occlusion Count</span>
                </div>
              </div>
            </div>

            {/* Multi-Camera Trajectory Timeline & Path Reconstruction */}
            <div className="trajectory-timeline-container">
              <div className="tt-header">
                <h3>📍 Reconstructed Multi-Camera Trajectory Path ({selectedCase.path.length} Waypoints)</h3>
                <span className="tt-sub">Synchronized spatial-temporal transition mapping</span>
              </div>

              <div className="trajectory-steps-list">
                {selectedCase.path.map((step, idx) => (
                  <div
                    key={idx}
                    className={`trajectory-step-card ${activeStep === idx ? "active-step" : ""}`}
                    onClick={() => setActiveStep(idx)}
                  >
                    <div className="step-num-col">
                      <span className="step-num">{step.step}</span>
                      <div className="step-line"></div>
                    </div>
                    <div className="step-content">
                      <div className="step-title-row">
                        <strong>{step.cam}: {step.name}</strong>
                        <span className="step-time">{step.time}</span>
                      </div>
                      <span className="step-zone">{step.zone} · Speed: {step.speed}</span>
                      <p className="step-event">{step.event}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Spatial Density & Anomaly Heatmap Simulation */}
            <div className="heatmap-preview-card">
              <div className="hm-header">
                <h4>Facility Spatial Density & Loitering Heatmap</h4>
                <span className="pill pill-ok">Normalized 2D Density Projection</span>
              </div>
              <div className="hm-stage">
                <div className="hm-zone-box zone-entrance">
                  <span>CAM-01 Entrance</span>
                  <div className="density-blob low">Traffic: 14%</div>
                </div>
                <div className="hm-zone-box zone-lobby">
                  <span>CAM-04 Atrium</span>
                  <div className="density-blob med">Traffic: 42%</div>
                </div>
                <div className="hm-zone-box zone-vault danger-zone">
                  <span>CAM-05 Server Vault</span>
                  <div className="density-blob high animate-pulse">🚨 ABNORMAL DWELL: 94%</div>
                </div>
                <div className="hm-zone-box zone-exit">
                  <span>CAM-07 Exit</span>
                  <div className="density-blob med">Traffic: 38%</div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Behavior Intelligence & Findings Panel */}
          <div className="behavior-side-pane">
            <div className="panel behavior-report-panel">
              <div className="report-header">
                <h2>Behavior Intelligence Analysis</h2>
                <span className="pill pill-critical">{selectedCase.severity.toUpperCase()}</span>
              </div>

              <div className="findings-list">
                {selectedCase.observations.map((obs, i) => (
                  <div key={i} className="finding-item">
                    <span className="finding-num">0{i + 1}</span>
                    <p>{obs}</p>
                  </div>
                ))}
              </div>

              <div className="behavior-action-box">
                <h3>Recommended Command Action:</h3>
                <div className={`action-callout ${selectedCase.severity === "critical" ? "danger-callout" : "ok-callout"}`}>
                  <strong>🚨 Protocol Directive:</strong>
                  <p>
                    {selectedCase.severity === "critical"
                      ? "Escalate to on-site security response. Lock down Server Room Vault access logs and retrieve physical badge swipe timestamps."
                      : "Dispatch perimeter ground unit to inspect unattended item and verify parking lot clearance."}
                  </p>
                </div>
              </div>

              <div className="behavior-side-actions">
                <button className="btn btn-primary btn-block" onClick={handleExportJson}>
                  📥 Export Trajectory Dossier (JSON)
                </button>
                <button className="btn btn-block" onClick={() => window.print()}>
                  🖨️ Print Behavior Report (1-Page)
                </button>
                <button className="btn btn-block" onClick={() => onNavigateModule("incident-desk")}>
                  Return to Incident Desk →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
