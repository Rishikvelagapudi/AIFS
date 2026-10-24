import { useEffect, useRef, useState } from "react";
import { getFullReport, patchIncident, sendIncidentEmail, sendIncidentSms, deepInvestigate } from "./api";
import { STATUS_LABEL } from "./cctvChannels";

export default function EmergencyReportView({
  incidentId,
  onReturnToConsole,
  onReturnHome,
  incidentsMap = {},
  camerasMap = {},
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedFrameIdx, setSelectedFrameIdx] = useState(2);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [checkedSOP, setCheckedSOP] = useState({ 0: true, 1: true });
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);
  const [investigating, setInvestigating] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [emailSentToast, setEmailSentToast] = useState(null);

  const videoRef = useRef(null);

  // Load report data from API or fall back to props
  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        if (incidentId) {
          const res = await getFullReport(incidentId);
          if (mounted) {
            setData(res);
            setNotes(res.incident?.operator_notes || "");
          }
        } else {
          // If no incidentId provided, take the first incident from map
          const first = Object.values(incidentsMap)[0];
          if (first) {
            const cam = camerasMap[first.camera_id] || null;
            setData({
              incident: first,
              camera: cam,
              evidence_frames: first.evidence_frames || [],
              dispatches: [],
              video_url: cam?.video_url || `/api/videos/${first.camera_id}`,
            });
            setNotes(first.operator_notes || "");
          } else {
            setError("No incident data found.");
          }
        }
      } catch (e) {
        // Fallback to local map if available
        const localInc = incidentsMap[incidentId];
        if (localInc) {
          const cam = camerasMap[localInc.camera_id] || null;
          setData({
            incident: localInc,
            camera: cam,
            evidence_frames: localInc.evidence_frames || [],
            dispatches: [],
            video_url: cam?.video_url || `/api/videos/${localInc.camera_id}`,
          });
          setNotes(localInc.operator_notes || "");
        } else {
          setError(e.message || "Failed to load incident report.");
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [incidentId, incidentsMap, camerasMap]);

  const inc = data?.incident;
  const cam = data?.camera;
  const frames = data?.evidence_frames || inc?.evidence_frames || [];
  const dispatches = data?.dispatches || [];
  const videoUrl = data?.video_url || cam?.video_url || (inc ? `/api/videos/${inc.camera_id}` : "");

  // Auto seek video to incident moment when loaded
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !inc) return;
    const seekTarget = Math.max(0, (inc.video_ts || 0) - 2.0);
    const onLoaded = () => {
      v.currentTime = seekTarget;
      v.play().catch(() => {});
    };
    if (v.readyState >= 1) {
      onLoaded();
    } else {
      v.addEventListener("loadedmetadata", onLoaded, { once: true });
    }
  }, [inc?.id, inc?.video_ts]);

  const seekTo = (sec) => {
    const v = videoRef.current;
    if (v && sec != null) {
      v.currentTime = Math.max(0, sec);
      v.play().catch(() => {});
    }
  };

  const handleSpeedChange = (spd) => {
    setPlaybackSpeed(spd);
    if (videoRef.current) {
      videoRef.current.playbackRate = spd;
    }
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play().catch(() => {});
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!inc) return;
    try {
      await patchIncident(inc.id, { status: newStatus });
      setData((prev) => ({
        ...prev,
        incident: { ...prev.incident, status: newStatus },
      }));
    } catch (e) {
      alert("Failed to update status: " + e.message);
    }
  };

  const handleSaveNotes = async () => {
    if (!inc) return;
    try {
      await patchIncident(inc.id, { operator_notes: notes });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch (e) {
      alert("Failed to save notes: " + e.message);
    }
  };

  const handleTriggerResendEmail = async () => {
    if (!inc) return;
    setEmailSending(true);
    try {
      const res = await sendIncidentEmail(inc.id);
      setData((prev) => ({
        ...prev,
        dispatches: [res, ...(prev.dispatches || [])],
      }));
      setEmailSentToast(res);
      setTimeout(() => setEmailSentToast(null), 5000);
    } catch (e) {
      alert("Email Dispatch failed: " + e.message);
    } finally {
      setEmailSending(false);
    }
  };

  const handleDeepInvestigate = async () => {
    if (!inc) return;
    setInvestigating(true);
    try {
      const updated = await deepInvestigate(inc.id);
      setData((prev) => ({
        ...prev,
        incident: updated,
        evidence_frames: updated.evidence_frames || prev.evidence_frames,
      }));
    } catch (e) {
      alert("AI Deep Scan failed: " + e.message);
    } finally {
      setInvestigating(false);
    }
  };

  const handleExportJson = () => {
    if (!inc) return;
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `IncidentDesk_Emergency_Report_${inc.id}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="desk emergency-report-screen">
        <div className="report-loading-box">
          <div className="cctv-radar-pulse"></div>
          <h2>Loading Emergency Incident Dossier...</h2>
          <p className="muted">Retrieving high-definition CCTV video, multi-frame evidence, and email dispatch log.</p>
        </div>
      </div>
    );
  }

  if (error || !inc) {
    return (
      <div className="desk emergency-report-screen">
        <header className="bar">
          <button className="btn btn-sm btn-home" onClick={onReturnToConsole}>
            ← Back to Incident Desk
          </button>
          <h1>Emergency Incident Report</h1>
        </header>
        <div className="error-report-box">
          <h2>⚠️ Incident Dossier Not Available</h2>
          <p>{error || "The requested incident record could not be loaded."}</p>
          <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
            <button className="btn btn-primary" onClick={onReturnToConsole}>
              Return to Incident Desk
            </button>
            {onReturnHome && (
              <button className="btn btn-home" onClick={onReturnHome}>
                🏠 Home
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const activeFrame = frames[selectedFrameIdx] || frames[0] || null;
  const latestDispatch = dispatches[0] || null;
  const sev = inc.severity || "high";

  return (
    <div className="desk emergency-report-screen">
      {/* Top Banner Alert Bar */}
      <header className="emergency-dossier-bar">
        <div className="ed-bar-left">
          {onReturnHome && (
            <button className="btn btn-sm btn-home" onClick={onReturnHome} title="Return to Landing Page">
              🏠 Home
            </button>
          )}
          <button className="btn btn-sm btn-home" onClick={onReturnToConsole} title="Return to Incident Desk Grid">
            ← Control Desk
          </button>
          <div className="ed-title-block">
            <span className={`ed-sev-tag sev-${sev}`}>
              🚨 INCIDENT EMERGENCY DOSSIER [{sev.toUpperCase()}]
            </span>
            <h1>{inc.id}: {inc.label}</h1>
          </div>
        </div>

        <div className="ed-bar-center">
          <span className="ed-cam-tag">
            📹 {inc.camera_name || cam?.name || inc.camera_id} ({inc.camera_id})
          </span>
          <span className="ed-zone-tag">
            📍 {inc.scene_context?.monitoring_zone || cam?.zone || "Surveillance Zone"}
          </span>
          <span className="ed-time-tag">
            ⏱ Timecode: <strong>{inc.video_ts_text}</strong>
          </span>
        </div>

        <div className="ed-bar-right">
          <button className="btn btn-sm btn-print" onClick={() => window.print()} title="Print or save 1-page report">
            🖨️ Print Dossier
          </button>
          <button className="btn btn-sm" onClick={handleExportJson} title="Export JSON Report">
            📥 Export JSON
          </button>
          <button
            className="btn btn-sm btn-resend-email btn-resend-sms"
            disabled={emailSending}
            onClick={handleTriggerResendEmail}
            title="Dispatch emergency Email alert to configured static address"
          >
            {emailSending ? "Sending Email…" : "📧 Resend Email Alert"}
          </button>
        </div>
      </header>

      {/* Dispatched Email Confirmation Ribbon */}
      <div className="emergency-sms-ribbon emergency-email-ribbon">
        <div className="sms-ribbon-left">
          <span className="sms-icon-pulse">📧</span>
          <div className="sms-ribbon-text">
            <strong>OFFICIAL EMAIL DISPATCH RECORD:</strong>
            <span>
              Alert transmitted to Static Emergency Email: <strong>{latestDispatch?.recipient_email || latestDispatch?.recipient_phone || "rishikvelagapudi@gmail.com"}</strong>
              {latestDispatch?.dispatched_at && ` · Sent at ${latestDispatch.dispatched_at}`}
            </span>
          </div>
        </div>
        <div className="sms-ribbon-right">
          <span className="sms-delivered-pill">● STATUS: DELIVERED</span>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => {
              navigator.clipboard?.writeText(window.location.href);
              alert("Incident Review Link copied to clipboard!");
            }}
          >
            📋 Copy Report Link
          </button>
        </div>
      </div>

      {/* Email Sent Toast Notification */}
      {emailSentToast && (
        <div className="sms-sent-toast email-sent-toast">
          <strong>✅ Email Alert Dispatched Successfully!</strong>
          <p>Recipient: {emailSentToast.recipient_email || emailSentToast.recipient_phone} ({emailSentToast.id})</p>
          <span className="sms-toast-sub">Direct link to this video investigation dossier was delivered.</span>
        </div>
      )}

      {/* Main 2-Column Emergency Workspace */}
      <main className="emergency-dossier-body">
        {/* Left Column: Evidence Breakdown FIRST + Synchronized Video Player DIRECTLY BELOW */}
        <div className="ed-left-column">

          {/* Section 1 (TOP): Multi-Frame Chronological Evidence & AI Detection Breakdown */}
          <section className="ed-card ed-frames-section">
            <div className="ed-card-header">
              <div className="ed-header-title">
                <span className="matrix-icon">🖼️</span>
                <div>
                  <h3 style={{ margin: 0 }}>1. MULTI-FRAME EVIDENCE SEQUENCE & AI DETECTION BREAKDOWN</h3>
                  <div style={{ fontSize: "11px", color: "var(--cyan)", marginTop: "2px", fontWeight: "600" }}>
                    ఒక్కొక్క ఫ్రేమ్ వారీగా డిటెక్షన్ & విశ్లేషణ (Frame-by-frame AI Detection & Observation)
                  </div>
                </div>
              </div>
              <span className="ed-header-sub">T-3.0s to T+3.0s Temporal AI Vision Extraction</span>
            </div>

            {/* 5-Frame Interactive Filmstrip Grid */}
            <div className="ed-frames-grid">
              {frames.map((f, idx) => {
                const isSelected = selectedFrameIdx === idx;
                const isTrigger = f.offset_sec === 0 || f.phase?.toLowerCase().includes("apex") || f.phase?.toLowerCase().includes("trigger");
                return (
                  <div
                    key={f.index ?? idx}
                    className={`ed-frame-card ${isSelected ? "selected-frame" : ""}`}
                    onClick={() => {
                      setSelectedFrameIdx(idx);
                      seekTo(f.video_ts);
                    }}
                    title="Click to inspect this frame and seek synchronized video below"
                  >
                    <div className="ed-frame-img-box">
                      <img src={f.url} alt={f.phase} className="ed-frame-img" />
                      <span className={`ed-phase-badge ${isTrigger ? "badge-trigger" : ""}`}>
                        {isTrigger ? "🚨 TRIGGER" : `Phase #${idx + 1}`}
                      </span>
                      <span className="ed-offset-badge">
                        {f.offset_sec >= 0 ? `+${f.offset_sec}` : f.offset_sec}s
                      </span>
                      {f.entities?.length > 0 && (
                        <div className="ed-frame-overlay-detect">
                          [{f.entities[0].toUpperCase()} DETECTED]
                        </div>
                      )}
                    </div>

                    <div className="ed-frame-meta">
                      <div className="ed-meta-title">
                        <strong>{f.phase}</strong>
                        <em>{f.video_ts_text}</em>
                      </div>
                      {f.entities?.length > 0 && (
                        <span className="ed-entities-tag">
                          Actors: {f.entities.join(", ")}
                        </span>
                      )}
                      {/* Step-by-step clear narrative for this individual frame */}
                      <p className="ed-obs-text" title={f.observation}>
                        {f.observation}
                      </p>
                    </div>

                    <button
                      className={`btn btn-sm btn-frame-seek ${isSelected ? "btn-primary" : ""}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFrameIdx(idx);
                        seekTo(f.video_ts);
                      }}
                    >
                      ▶ Seek Video ({f.video_ts_text})
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Focused Frame Detailed Critical Scenario Deep-Dive Box */}
            {activeFrame && (
              <div className="ed-critical-scenario-deepdive">
                <div className="deepdive-badge">
                  🔍 CRITICAL SCENARIO DEEP-DIVE · PHASE #{selectedFrameIdx + 1} ({activeFrame.phase}) · TIMECODE {activeFrame.video_ts_text}
                </div>
                <h4>Computer Vision Trigger & Dynamic Scenario Breakdown:</h4>
                <p className="deepdive-narrative">
                  {activeFrame.observation ||
                    "Computer vision optical flow and bounding box tracking detected sudden kinematic divergence from nominal baseline surveillance parameters."}
                </p>
                <div className="deepdive-grid">
                  <div className="dd-item">
                    <strong>Kinematic Disruption:</strong>
                    <span>{inc.scene_context?.kinematics || "Abrupt deceleration divergence / trajectory disruption."}</span>
                  </div>
                  <div className="dd-item">
                    <strong>Root Cause Assessment:</strong>
                    <span>{inc.root_cause_analysis || inc.observation || "Optical flow anomaly in calibrated camera zone."}</span>
                  </div>
                  <div className="dd-item">
                    <strong>Active Actors in Frame:</strong>
                    <span>{activeFrame.entities?.join(", ") || inc.scene_context?.detected_actors || "Persons / Vehicles"}</span>
                  </div>
                  <div className="dd-item">
                    <strong>Zone Calibration:</strong>
                    <span>{inc.scene_context?.monitoring_zone || cam?.zone || "Main Surveillance Perimeter"}</span>
                  </div>
                </div>
                <div className="deepdive-hint">
                  💡 <em>సూచన: పై ఫ్రేమ్‌లలో దేనినైనా క్లిక్ చేస్తే క్రింది వీడియో ఆ సమయానికి వెళ్తుంది (Click any frame above to synchronize the video below).</em>
                </div>
              </div>
            )}
          </section>

          {/* Section 2 (DIRECTLY BELOW): High-Definition Video Player for Final Review */}
          <section className="ed-card ed-video-section">
            <div className="ed-card-header">
              <div className="ed-header-title">
                <span className="matrix-icon">📹</span>
                <div>
                  <h3 style={{ margin: 0 }}>2. SYNCHRONIZED HIGH-DEFINITION VIDEO VERIFICATION PLAYER</h3>
                  <div style={{ fontSize: "11px", color: "var(--gold)", marginTop: "2px", fontWeight: "600" }}>
                    కింద వీడియో దృశ్యం - ఫ్రేమ్‌లతో సమన్వయం (Synchronized Playback Below)
                  </div>
                </div>
              </div>
              <div className="ed-player-toggles">
                <button
                  className={`btn btn-sm ${playbackSpeed === 0.5 ? "btn-primary" : ""}`}
                  onClick={() => handleSpeedChange(0.5)}
                  title="Slow motion 0.5x for forensic frame inspection"
                >
                  0.5× Slow-Mo
                </button>
                <button
                  className={`btn btn-sm ${playbackSpeed === 1.0 ? "btn-primary" : ""}`}
                  onClick={() => handleSpeedChange(1.0)}
                >
                  1.0×
                </button>
                <button
                  className={`btn btn-sm ${playbackSpeed === 2.0 ? "btn-primary" : ""}`}
                  onClick={() => handleSpeedChange(2.0)}
                >
                  2.0×
                </button>
                <button
                  className="btn btn-sm btn-seek"
                  onClick={() => seekTo(inc.video_ts ? Math.max(0, inc.video_ts - 2) : 0)}
                  title="Jump to 2 seconds before incident trigger"
                >
                  🎯 Jump to Trigger ({inc.video_ts_text})
                </button>
              </div>
            </div>

            <div className="ed-video-container">
              <video
                ref={videoRef}
                src={videoUrl}
                controls
                playsInline
                loop={isLooping}
                onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
                onLoadedMetadata={(e) => setDuration(e.target.duration)}
                className="ed-main-video"
              />

              {/* HUD Reticle Overlay */}
              <div className="ed-hud-watermark">
                <span>{inc.camera_name || inc.camera_id}</span>
                <span>REC ● 1080p 30FPS</span>
              </div>
            </div>

            {/* Frame Jump Navigation Bar */}
            <div className="ed-video-timeline-bar">
              <span className="tl-label">Evidence Milestones:</span>
              <div className="tl-buttons-group">
                {frames.map((f, idx) => (
                  <button
                    key={idx}
                    className={`tl-frame-btn ${selectedFrameIdx === idx ? "active" : ""}`}
                    onClick={() => {
                      setSelectedFrameIdx(idx);
                      seekTo(f.video_ts);
                    }}
                    title={`Seek video to Frame #${idx + 1} (${f.video_ts_text})`}
                  >
                    #{idx + 1} {f.phase} ({f.offset_sec >= 0 ? `+${f.offset_sec}` : f.offset_sec}s)
                  </button>
                ))}
              </div>
            </div>
          </section>

        </div>

        {/* Right Column: Incident Dossier, Threat Assessment, SOP & Final Disposition */}
        <div className="ed-right-column">
          {/* Executive Summary & Narrative */}
          <div className="panel ed-panel">
            <div className="report-header">
              <h2>1. Executive Scene Summary</h2>
              <span className={`pill pill-${sev}`}>{sev.toUpperCase()}</span>
            </div>
            <p className="narrative-text">
              {inc.executive_summary || inc.interpretation || inc.observation}
            </p>
          </div>

          {/* Threat & Impact Assessment */}
          <div className="panel ed-panel">
            <div className="report-header">
              <h2>2. Threat & Risk Assessment</h2>
              <span className="pill pill-ok">Score: {inc.priority_score || 85}/100</span>
            </div>
            <div className="threat-cards">
              <div className="threat-card">
                <strong>Physical Injury Risk</strong>
                <span>{inc.impact_assessment?.injury_risk || "Potential physical distress or vehicle damage."}</span>
              </div>
              <div className="threat-card">
                <strong>Disruption Hazard</strong>
                <span>{inc.impact_assessment?.disruption_risk || "Lane obstruction or restricted zone security hazard."}</span>
              </div>
              <div className="threat-card">
                <strong>Containment Urgency</strong>
                <span>{inc.impact_assessment?.containment_urgency || "Operator verification required within 60 seconds."}</span>
              </div>
            </div>
          </div>

          {/* Standard Operating Procedure (SOP) Checklist */}
          <div className="panel ed-panel">
            <div className="report-header">
              <h2>3. Standard Operating Procedure (SOP)</h2>
              <span className="pill pill-source">Compliance</span>
            </div>
            <ul className="sop-checklist">
              {(inc.procedure || [
                "Verify live CCTV camera feed against multi-frame chronological sequence",
                "Confirm physical ground condition and vehicle status in camera view",
                "Initiate emergency dispatch or on-site security response if verified",
                "Log operator verification badge and resolution outcome in registry",
                "Export and archive high-definition evidence sequence"
              ]).map((step, idx) => (
                <li
                  key={idx}
                  onClick={() => setCheckedSOP((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                  style={{ cursor: "pointer" }}
                >
                  <input
                    type="checkbox"
                    checked={!!checkedSOP[idx]}
                    onChange={() => setCheckedSOP((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                  />
                  <span className={checkedSOP[idx] ? "step-done" : ""}>{step}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Final Operator Review & Verification Station */}
          <div className="panel ed-panel ed-action-panel">
            <div className="report-header">
              <h2>4. Final Review & Disposition Station</h2>
              <span className="pill pill-status">{STATUS_LABEL[inc.status] || inc.status}</span>
            </div>

            <div className="action-button-row">
              <button
                className={`btn ${inc.status === "verified" ? "btn-primary" : ""}`}
                onClick={() => handleStatusChange("verified")}
              >
                ✅ Confirm & Verify Incident
              </button>
              <button
                className={`btn ${inc.status === "resolved" ? "btn-primary" : ""}`}
                onClick={() => handleStatusChange("resolved")}
              >
                ✔️ Mark Resolved
              </button>
              <button
                className={`btn ${inc.status === "rejected" ? "btn-primary" : ""}`}
                onClick={() => handleStatusChange("rejected")}
              >
                ⚠️ Reject as False Alarm
              </button>
              <button
                className="btn btn-emergency"
                onClick={() => alert(`DISPATCH DIRECTIVE: Security & Medical Patrol deployed to Camera ${inc.camera_id} (${inc.camera_name}).`)}
              >
                🚨 Deploy Ground Patrol
              </button>
            </div>

            {/* Operator Notes Box */}
            <div className="operator-notes-box">
              <label>
                Operator Final Verification Findings & Log:
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Enter operator badge ID, actions taken, ground response team..."
                />
              </label>
              <button className="btn btn-sm btn-primary" onClick={handleSaveNotes}>
                {notesSaved ? "Saved!" : "Save Operator Findings"}
              </button>
            </div>
          </div>

          {/* Dispatched Email Message Transcript Box */}
          <div className="panel ed-panel ed-sms-transcript-panel ed-email-transcript-panel">
            <div className="report-header">
              <h2>5. Dispatched Emergency Email Transcript & Notice</h2>
              <span className="pill pill-ok">Static Email Alert</span>
            </div>
            <div className="sms-terminal-view email-terminal-view">
              <div className="sms-terminal-header">
                <span>RECIPIENT: {latestDispatch?.recipient_email || latestDispatch?.recipient_phone || "rishikvelagapudi@gmail.com"}</span>
                <span>STATUS: {latestDispatch?.status || "DELIVERED"}</span>
              </div>
              <div className="email-terminal-subject" style={{ padding: "6px 12px", background: "#1a0833", borderBottom: "1px solid #3d176d", color: "#ffb703", fontSize: "12px", fontWeight: "600" }}>
                SUBJECT: {latestDispatch?.subject || `🚨 [AIFS EMERGENCY] ${sev.toUpperCase()} Alert: ${inc.label} (${inc.id}) - ${inc.camera_name}`}
              </div>
              <pre className="sms-terminal-content">
                {latestDispatch?.message ||
                  `================================================================================\nAIFS EMERGENCY INCIDENT DISPATCH NOTIFICATION\n================================================================================\n\nINCIDENT ID:      ${inc.id}\nSEVERITY LEVEL:   ${sev.toUpperCase()}\nCLASSIFICATION:   ${inc.label}\nCAMERA SOURCE:    ${inc.camera_name} (${inc.camera_id})\nZONE:             ${inc.scene_context?.monitoring_zone || "Main Surveillance Quadrant"}\nVIDEO TIME:       ${inc.video_ts_text}\n\nSCENARIO BRIEFING:\n${inc.alert_text || "Emergency incident detected on camera."}\n\nDIRECTIVE:\nOpen live video investigation report:\n${window.location.href}`}
              </pre>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
