import { useState } from "react";

const DEMO_CASES = [
  {
    id: "FOR-2026-081",
    title: "Deepfake Impersonation Call (Voice & Face Clone)",
    type: "Synthetic Video/Audio",
    sourceFile: "urgent_wire_transfer_call.mp4",
    verdict: "DEEPFAKE DETECTED",
    verdictType: "danger",
    confidence: 96.4,
    sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    metrics: {
      facialLandmarkAnomaly: "94% (Facial jitter along jawline & ears)",
      audioSpectralDivergence: "98% (High-frequency vocoder distortion >14kHz)",
      blinkRatePeriodicity: "0.2 blinks/min (Abnormal physiological baseline)",
      metadataIntegrity: "Suspicious (Exif metadata stripped, synthetic codec)",
    },
    findings: [
      "Facial boundary blending artifacts detected around chin and earlobes in frames 142–310.",
      "Audio track contains neural TTS synthesis signatures in the 12kHz–16kHz frequency bands.",
      "Pupil glint reflections are geometrically asymmetric with respect to ambient lighting.",
      "Voice biometrics mismatch registered identity profile by 88.2%."
    ],
    chainOfCustody: [
      { time: "2026-10-19 09:12:04", action: "Evidence ingested from Public Transit Help Desk", actor: "Officer K. Rao (Badge #401)" },
      { time: "2026-10-19 09:12:18", action: "SHA-256 fingerprint computed & locked", actor: "AIFS Core Node 01" },
      { time: "2026-10-19 09:12:45", action: "Neural deepfake detection completed", actor: "Forensic Vision Agent v4.2" }
    ]
  },
  {
    id: "FOR-2026-082",
    title: "Perimeter Camera Timestamp & Frame Insertion Tamper",
    type: "Video Splice & Timecode Alteration",
    sourceFile: "cam03_west_fence_splice.mp4",
    verdict: "TAMPER DETECTED",
    verdictType: "danger",
    confidence: 91.8,
    sha256: "8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4",
    metrics: {
      facialLandmarkAnomaly: "N/A (No frontal faces in zone)",
      audioSpectralDivergence: "84% (Room impulse response shift at T=14.2s)",
      blinkRatePeriodicity: "N/A",
      metadataIntegrity: "Corrupted (PTS/DTS timestamp jitter across frame 420)",
    },
    findings: [
      "Video frames #420 through #485 show repeated optical background tiles without sensor noise variance.",
      "Compression quantization table mismatch detected at cut point 00:14:200.",
      "Timecode font anti-aliasing differs from native Hikvision CCTV OSD generator.",
      "12 seconds of real-time footage removed and replaced with a static looped background plate."
    ],
    chainOfCustody: [
      { time: "2026-10-19 10:05:22", action: "Flagged by Incident Desk automated temporal audit", actor: "Incident Desk CAM-03" },
      { time: "2026-10-19 10:05:30", action: "Transferred to AI Forensic Lab for frame audit", actor: "Hub Orchestrator" }
    ]
  },
  {
    id: "FOR-2026-083",
    title: "Main Gate Surveillance Entry - Genuine Authenticated",
    type: "Authentic Multi-Sensor Feed",
    sourceFile: "cam01_main_entrance_verified.mp4",
    verdict: "VERIFIED AUTHENTIC",
    verdictType: "success",
    confidence: 99.1,
    sha256: "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9",
    metrics: {
      facialLandmarkAnomaly: "1.4% (Standard natural skin and muscular motion)",
      audioSpectralDivergence: "0.8% (Continuous environmental ambient sound)",
      blinkRatePeriodicity: "16.8 blinks/min (Normal human autonomic rate)",
      metadataIntegrity: "Valid (Complete camera sensor hardware EXIF signature)",
    },
    findings: [
      "Continuous optical sensor noise present across all RGB color channels.",
      "Natural ocular saccades, micro-expressions, and involuntary blinking patterns verified.",
      "Hardware cryptographic timestamp matches facility master NTP server.",
      "No generative AI compression or neural inpainting artifacts found."
    ],
    chainOfCustody: [
      { time: "2026-10-19 11:30:00", action: "Automated random sample audit", actor: "System Scheduled Audit" },
      { time: "2026-10-19 11:30:15", action: "Cryptographic verification completed", actor: "AIFS Core Node 01" }
    ]
  }
];

export default function AiForensic({ onReturnHome, onNavigateModule }) {
  const [selectedCase, setSelectedCase] = useState(DEMO_CASES[0]);
  const [activeTab, setActiveTab] = useState("overview"); // "overview" | "facial" | "spectral" | "chain"
  const [analyzing, setAnalyzing] = useState(false);
  const [fileName, setFileName] = useState("");
  const [customHash, setCustomHash] = useState("");

  const handleSimulateScan = (caseItem) => {
    setAnalyzing(true);
    setTimeout(() => {
      setSelectedCase(caseItem);
      setAnalyzing(false);
    }, 600);
  };

  const handleCustomFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setAnalyzing(true);
    setTimeout(() => {
      setSelectedCase({
        id: `FOR-${Date.now().toString().slice(-4)}`,
        title: `Uploaded Media: ${f.name}`,
        type: "User Ingested Media Evidence",
        sourceFile: f.name,
        verdict: "SUSPICIOUS / ELEVATED SYNTHESIS",
        verdictType: "danger",
        confidence: 89.2,
        sha256: "f2ca1bb6c7e907d06dafe4687e579fce76b37e4e93b7605022da52e6ccc26fd2",
        metrics: {
          facialLandmarkAnomaly: "78.4% (Irregular facial texture gradient)",
          audioSpectralDivergence: "82.1% (Phase discontinuity in speech peaks)",
          blinkRatePeriodicity: "4.1 blinks/min (Low frequency autonomic drift)",
          metadataIntegrity: "Modified (Web-encoded MP4 container)",
        },
        findings: [
          `File ${f.name} ingested for full frame-by-frame neural forensic inspection.`,
          "Potential facial reenactment or deepfake voice clone signatures observed.",
          "Spectral analysis indicates synthetic smoothing across phoneme boundaries.",
          "Detailed forensic examination recommended before court presentation."
        ],
        chainOfCustody: [
          { time: new Date().toLocaleString(), action: `Uploaded ${f.name} for forensic triage`, actor: "Operator Terminal" }
        ]
      });
      setAnalyzing(false);
    }, 1200);
  };

  const handleExportForensicReport = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(selectedCase, null, 2));
    const dl = document.createElement("a");
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", `AIFS_Forensic_Report_${selectedCase.id}.json`);
    dl.click();
  };

  return (
    <div className="desk ai-forensic-screen">
      {/* Top Header Bar */}
      <header className="bar">
        <button className="btn btn-sm btn-home" onClick={onReturnHome} title="Return to Landing Page">
          ← Home
        </button>
        <div className="bar-title-wrap">
          <h1>AI Forensic Laboratory</h1>
          <span className="module-badge">AIFS Module 02</span>
        </div>
        <div className="bar-stats">
          <span className="pill pill-source">AI Deepfake & Tamper Detection</span>
          <span className="pill pill-ok">Neural Engine v4.2 Active</span>
        </div>
        <div className="bar-actions">
          <label className="btn btn-primary">
            {analyzing ? "Scanning Media…" : "+ Ingest Media for Analysis"}
            <input type="file" accept="video/*,audio/*,image/*" hidden onChange={handleCustomFile} />
          </label>
          <button className="btn" onClick={() => onNavigateModule("incident-desk")}>
            Go to Incident Desk →
          </button>
        </div>
      </header>

      {/* Main Forensic Content */}
      <div className="forensic-body">
        {/* Top Demo Selector Bar */}
        <div className="forensic-case-selector-bar">
          <div className="selector-title">
            <span className="matrix-icon">🔬</span>
            <strong>SELECT FORENSIC EVIDENCE DOSSIER:</strong>
          </div>
          <div className="case-buttons-row">
            {DEMO_CASES.map((c) => (
              <button
                key={c.id}
                className={`btn btn-sm ${selectedCase.id === c.id ? "btn-primary" : ""}`}
                onClick={() => handleSimulateScan(c)}
              >
                {c.id}: {c.title.slice(0, 32)}…
              </button>
            ))}
          </div>
        </div>

        {/* Forensic Workspace 2-Column Layout */}
        <div className="forensic-grid">
          {/* Left Column: Forensic Dashboard & Evidence Visualizer */}
          <div className="forensic-main-pane">
            {/* Primary Dossier Header */}
            <div className="forensic-dossier-card">
              <div className="dossier-top">
                <div>
                  <span className="case-tag">{selectedCase.id}</span>
                  <h2>{selectedCase.title}</h2>
                  <span className="case-sub">Source: {selectedCase.sourceFile} · Format: {selectedCase.type}</span>
                </div>
                <div className="dossier-verdict-box">
                  <span className={`verdict-pill ${selectedCase.verdictType}`}>
                    {selectedCase.verdict}
                  </span>
                  <span className="verdict-conf">Confidence: {selectedCase.confidence}%</span>
                </div>
              </div>

              {/* Forensic Metric Cards */}
              <div className="forensic-metric-cards">
                <div className="f-metric-card">
                  <span className="fm-label">Facial Landmark Variance</span>
                  <strong>{selectedCase.metrics.facialLandmarkAnomaly}</strong>
                  <span className="fm-sub">68-Point Mesh Deviation</span>
                </div>
                <div className="f-metric-card">
                  <span className="fm-label">Spectral Voiceprint Audio</span>
                  <strong>{selectedCase.metrics.audioSpectralDivergence}</strong>
                  <span className="fm-sub">High-Freq Vocoder Glitches</span>
                </div>
                <div className="f-metric-card">
                  <span className="fm-label">Ocular Blink Periodicity</span>
                  <strong>{selectedCase.metrics.blinkRatePeriodicity}</strong>
                  <span className="fm-sub">Physiological Baseline Check</span>
                </div>
                <div className="f-metric-card">
                  <span className="fm-label">Metadata & Hash Integrity</span>
                  <strong>{selectedCase.metrics.metadataIntegrity}</strong>
                  <span className="fm-sub">Exif & Digital Signature</span>
                </div>
              </div>
            </div>

            {/* Interactive Visual Inspection Area */}
            <div className="forensic-visual-area">
              <div className="visual-tabs">
                <button
                  className={`v-tab ${activeTab === "overview" ? "active" : ""}`}
                  onClick={() => setActiveTab("overview")}
                >
                  🔍 Visual Evidence & ELA
                </button>
                <button
                  className={`v-tab ${activeTab === "facial" ? "active" : ""}`}
                  onClick={() => setActiveTab("facial")}
                >
                  👤 Facial Mesh & Biometrics
                </button>
                <button
                  className={`v-tab ${activeTab === "spectral" ? "active" : ""}`}
                  onClick={() => setActiveTab("spectral")}
                >
                  🎙️ Audio Spectrogram
                </button>
                <button
                  className={`v-tab ${activeTab === "chain" ? "active" : ""}`}
                  onClick={() => setActiveTab("chain")}
                >
                  ⛓️ Cryptographic Custody
                </button>
              </div>

              <div className="visual-display-panel">
                {activeTab === "overview" && (
                  <div className="tab-pane overview-pane">
                    <div className="hud-video-preview">
                      <div className="hud-reticles">
                        <span className="cctv-reticle cctv-reticle-tl"></span>
                        <span className="cctv-reticle cctv-reticle-tr"></span>
                        <span className="cctv-reticle cctv-reticle-bl"></span>
                        <span className="cctv-reticle cctv-reticle-br"></span>
                      </div>
                      <div className="hud-overlay-tag">ELA PIXEL LEVEL RESIDUAL ANALYSIS</div>
                      <div className="hud-sample-img-box">
                        <img
                          src={selectedCase.verdictType === "danger" ? "/comics/deepfake.jpg" : "/comics/social_good.jpg"}
                          alt="Forensic Frame"
                          className="forensic-sample-img"
                        />
                        {selectedCase.verdictType === "danger" && (
                          <div className="tamper-bounding-box">
                            <span className="tamper-box-label">⚠ SYNTHETIC FACIAL BOUNDARY (96.4%)</span>
                          </div>
                        )}
                      </div>
                      <div className="hud-meta-bar">
                        <span>FPS: 30.00</span>
                        <span>Res: 1920x1080</span>
                        <span>Color: Rec.709</span>
                        <span>Alg: MesoNet-Inception v4</span>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "facial" && (
                  <div className="tab-pane facial-pane">
                    <div className="facial-mesh-preview">
                      <div className="mesh-points-grid">
                        <div className="mesh-circle pulse"></div>
                        <span className="mesh-data-label">Landmark Eye-to-Mouth Ratio: 1.42 (Irregular)</span>
                        <span className="mesh-data-label">Texture Gradient Inconsistency: +24.8dB</span>
                        <span className="mesh-data-label">Synthetic Ear Edge Artifact: Confirmed</span>
                      </div>
                      <div className="mesh-details-list">
                        <h4>Facial Landmark Forensic Telemetry:</h4>
                        <ul>
                          <li><strong>Eye Saccades:</strong> Lack of micro-movements during speaker pauses.</li>
                          <li><strong>Lip Phoneme Synchronization:</strong> Audio /p/ and /b/ plosives lead facial muscle actuation by 85ms.</li>
                          <li><strong>Skin Texture Diffusion:</strong> Subsurface scattering reflectance variance suggests GAN/Diffusion synthesis.</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === "spectral" && (
                  <div className="tab-pane spectral-pane">
                    <div className="spectrogram-visualizer">
                      <div className="spectrogram-bars">
                        {[40, 65, 80, 50, 95, 75, 60, 85, 90, 45, 70, 88, 55, 62, 78, 92, 40, 85].map((h, i) => (
                          <div
                            key={i}
                            className="spectrogram-bar"
                            style={{ height: `${h}%`, backgroundColor: h > 80 ? "#ff0055" : "#00e5ff" }}
                          ></div>
                        ))}
                      </div>
                      <div className="spectrogram-freq-axis">
                        <span>0 Hz</span>
                        <span>4 kHz</span>
                        <span>8 kHz</span>
                        <span>12 kHz</span>
                        <span>16 kHz (Artifact Spike)</span>
                        <span>20 kHz</span>
                      </div>
                    </div>
                    <p className="spectral-note">
                      <strong>Audio Forensic Finding:</strong> Unnatural cutoff above 14.5 kHz combined with characteristic robotic harmonic overtones indicates voice cloning model (e.g. VITS/Bark synthesis architecture).
                    </p>
                  </div>
                )}

                {activeTab === "chain" && (
                  <div className="tab-pane chain-pane">
                    <div className="hash-box">
                      <strong>SHA-256 Cryptographic Hash:</strong>
                      <code>{selectedCase.sha256}</code>
                    </div>
                    <h4>Verified Forensic Audit Trail:</h4>
                    <ul className="custody-timeline">
                      {selectedCase.chainOfCustody.map((entry, idx) => (
                        <li key={idx}>
                          <span className="custody-dot">●</span>
                          <div className="custody-info">
                            <strong>{entry.action}</strong>
                            <span>{entry.time} · {entry.actor}</span>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column: Detailed Forensic Findings & Action Panel */}
          <div className="forensic-side-pane">
            <div className="panel forensic-report-panel">
              <div className="report-header">
                <h2>Forensic Intelligence Findings</h2>
                <span className="pill pill-ok">Automated Dossier</span>
              </div>

              <div className="findings-list">
                {selectedCase.findings.map((f, i) => (
                  <div key={i} className="finding-item">
                    <span className="finding-num">0{i + 1}</span>
                    <p>{f}</p>
                  </div>
                ))}
              </div>

              <div className="forensic-recommendations">
                <h3>Recommended Forensic Disposition:</h3>
                {selectedCase.verdictType === "danger" ? (
                  <div className="action-callout danger-callout">
                    <strong>🚨 Synthetic Impersonation Advisory:</strong>
                    <p>Evidence contains synthetic audio/video manipulation. Flag content, submit report to Cyber Crime cell, and notify target individual.</p>
                  </div>
                ) : (
                  <div className="action-callout ok-callout">
                    <strong>✅ Genuine Media Clearance:</strong>
                    <p>Media passes all neural authenticity criteria. Evidence admissible for legal and surveillance logging.</p>
                  </div>
                )}
              </div>

              <div className="forensic-action-buttons">
                <button className="btn btn-primary btn-block" onClick={handleExportForensicReport}>
                  📥 Export Forensic Certificate (JSON)
                </button>
                <button className="btn btn-block" onClick={() => window.print()}>
                  🖨️ Print Forensic Dossier (1-Page)
                </button>
                <button className="btn btn-block" onClick={() => onNavigateModule("post-fetch")}>
                  Open Post Fetch & Behavior Analysis →
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
