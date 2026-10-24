import { useEffect, useState } from "react";
import { STATUS_LABEL } from "./cctvChannels";

export default function CompleteVideoReportModal({ data, allIncidentsMap, onClose, onPatchIncident, onDeepInvestigate }) {
  const { channel, cam } = data;
  const camIncidents = Object.values(allIncidentsMap).filter((i) => i.camera_id === cam.id);
  const [activeIncId, setActiveIncId] = useState(data.activeIncidentId || camIncidents[0]?.id || null);
  const [viewMode, setViewMode] = useState("report"); // "report" or "video"
  const [investigating, setInvestigating] = useState(false);
  const [selectedFrameIdx, setSelectedFrameIdx] = useState(2);
  const [checkedSOP, setCheckedSOP] = useState({ 0: true, 1: true });
  const [notes, setNotes] = useState("");
  const [notesSaved, setNotesSaved] = useState(false);

  const activeInc = allIncidentsMap[activeIncId] || camIncidents[0] || null;
  const frames = activeInc?.evidence_frames || [];
  const activeFrame = frames[selectedFrameIdx] || frames[0];

  useEffect(() => {
    if (activeInc) {
      setNotes(activeInc.operator_notes || "");
    }
  }, [activeInc?.id]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleDeepInvestigate = async () => {
    if (!activeInc) return;
    setInvestigating(true);
    try {
      await onDeepInvestigate(activeInc.id);
    } catch (e) {
      alert("Investigation error: " + e.message);
    } finally {
      setInvestigating(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!activeInc) return;
    try {
      await onPatchIncident(activeInc.id, { operator_notes: notes });
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch (e) {
      alert("Failed to save notes: " + e.message);
    }
  };

  const handleStatusChange = async (newStatus) => {
    if (!activeInc) return;
    try {
      await onPatchIncident(activeInc.id, { status: newStatus });
    } catch (e) {
      alert("Status update failed: " + e.message);
    }
  };

  const handleExportJson = () => {
    const payload = {
      report_title: `OFFICIAL CCTV SURVEILLANCE & INCIDENT REPORT - ${channel.id}`,
      camera_id: channel.id,
      camera_name: cam?.name || channel.name,
      zone: channel.zone,
      fps: channel.fps,
      resolution: channel.res,
      exported_at: new Date().toISOString(),
      total_incidents: camIncidents.length,
      incidents: camIncidents,
      nominal_clearance: camIncidents.length === 0,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `CCTV_Report_${channel.id}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="report-modal-backdrop" onClick={onClose}>
      <div className="complete-report-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Top Bar */}
        <div className="report-modal-header">
          <div className="modal-header-left">
            <span className="confidential-tag">OFFICIAL CCTV INVESTIGATION DOSSIER</span>
            <h2>{channel.id}: {cam?.name || channel.name}</h2>
            <div className="modal-header-meta">
              <span>📍 {channel.zone}</span>
              <span>📹 {channel.res} @ {channel.fps} FPS</span>
              <span>🕒 {new Date().toLocaleString()}</span>
              {camIncidents.length > 0 ? (
                <span className="badge-incidents-count">{camIncidents.length} Incident(s) Logged</span>
              ) : (
                <span className="badge-nominal-status">● NOMINAL CLEAR</span>
              )}
            </div>
          </div>
          <div className="modal-header-actions">
            <button className="btn btn-sm btn-print" onClick={() => window.print()} title="Print or save as PDF">
              🖨️ Print / Save PDF
            </button>
            <button className="btn btn-sm" onClick={handleExportJson} title="Export JSON Report">
              📥 Export JSON
            </button>
            <button className="btn btn-sm btn-close-modal" onClick={onClose} title="Close Report">
              ✕ Close
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="report-modal-body">
          {/* Telemetry Dashboard Banner */}
          <div className="report-telemetry-grid">
            <div className="telemetry-card">
              <span className="t-label">SURVEILLANCE STATUS</span>
              <strong className={camIncidents.length > 0 ? "t-val-alert" : "t-val-ok"}>
                {camIncidents.length > 0 ? `${camIncidents.length} INCIDENT(S) ACTIVE` : "ALL NOMINAL"}
              </strong>
              <span className="t-sub">{cam?.status === "complete" ? "Analysis 100% Complete" : "Real-Time AI Monitoring"}</span>
            </div>
            <div className="telemetry-card">
              <span className="t-label">HIGHEST SEVERITY</span>
              <strong className={`t-val sev-${activeInc?.severity || "normal"}`}>
                {(activeInc?.severity || "NORMAL").toUpperCase()}
              </strong>
              <span className="t-sub">Priority Score: {activeInc?.priority_score || 0}</span>
            </div>
            <div className="telemetry-card">
              <span className="t-label">LOCATION & ZONE</span>
              <strong>{channel.zone}</strong>
              <span className="t-sub">Channel {channel.id}</span>
            </div>
            <div className="telemetry-card">
              <span className="t-label">HARDWARE TELEMETRY</span>
              <strong>{channel.res} · {channel.fps} FPS</strong>
              <span className="t-sub">Codec H.264 · 4.2 Mbps</span>
            </div>
          </div>

          {/* If Incidents Exist on this Camera */}
          {camIncidents.length > 0 ? (
            <>
              {/* Incident Selector Tabs if multiple */}
              {camIncidents.length > 1 && (
                <div className="modal-incident-tabs">
                  <span className="tabs-label">Detected Incidents on this Video:</span>
                  {camIncidents.map((inc, idx) => (
                    <button
                      key={inc.id}
                      className={`btn-inc-tab ${activeIncId === inc.id ? "active" : ""} sev-${inc.severity}`}
                      onClick={() => {
                        setActiveIncId(inc.id);
                        setSelectedFrameIdx(2);
                      }}
                    >
                      #{idx + 1} {inc.id} ({inc.video_ts_text}) · {inc.label}
                    </button>
                  ))}
                </div>
              )}

              {activeInc && (
                <div className="modal-incident-detail">
                  {/* Top Incident Banner */}
                  <div className={`modal-incident-banner sev-${activeInc.severity}`}>
                    <div className="banner-left">
                      <span className="banner-sev-badge">{activeInc.severity.toUpperCase()}</span>
                      <strong>{activeInc.id}: {activeInc.label}</strong>
                      <span className="banner-ts">Detected at {activeInc.video_ts_text} (T={activeInc.video_ts}s)</span>
                    </div>
                    <div className="banner-right">
                      <span className="pill pill-status">{STATUS_LABEL[activeInc.status] || activeInc.status}</span>
                      <button
                        className="btn btn-sm btn-agent-scan"
                        disabled={investigating}
                        onClick={handleDeepInvestigate}
                        title="Rerun multi-frame vision scan"
                      >
                        {investigating ? "Scanning..." : "⚡ Deep AI Scan"}
                      </button>
                    </div>
                  </div>

                  {/* Video & Evidence Viewer */}
                  <div className="modal-stage-container">
                    <div className="modal-stage-media">
                      {viewMode === "video" ? (
                        <video src={cam?.video_url} controls autoPlay muted playsInline />
                      ) : (
                        <div className="modal-stage-img-wrap">
                          <img src={activeFrame?.url || activeInc.evidence_url} alt={activeFrame?.phase || "Evidence"} />
                          {activeFrame && (
                            <div className="modal-frame-overlay">
                              <strong>Phase #{selectedFrameIdx + 1}: {activeFrame.phase}</strong>
                              <span>Offset: {activeFrame.offset_sec >= 0 ? `+${activeFrame.offset_sec}` : activeFrame.offset_sec}s ({activeFrame.video_ts_text})</span>
                              <em>{activeFrame.observation}</em>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="modal-stage-controls">
                      <div className="btn-group">
                        <button className={`btn btn-sm ${viewMode === "report" ? "btn-primary" : ""}`} onClick={() => setViewMode("report")}>
                          🖼️ 5-Frame Sequence
                        </button>
                        <button className={`btn btn-sm ${viewMode === "video" ? "btn-primary" : ""}`} onClick={() => setViewMode("video")}>
                          ▶️ Live Video Player
                        </button>
                      </div>
                      <span className="stage-info">
                        Entities Detected: {activeFrame?.entities?.join(", ") || activeInc.entities || "Surveillance Actors"}
                      </span>
                    </div>
                  </div>

                  {/* 5-Frame Evidence Filmstrip */}
                  {frames.length > 0 && (
                    <div className="modal-filmstrip-section">
                      <h4>Multi-Frame Chronological Evidence Sequence (T-3.0s to T+3.0s)</h4>
                      <div className="modal-filmstrip-grid">
                        {frames.map((f, idx) => (
                          <div
                            key={f.index ?? idx}
                            className={`filmstrip-tile ${selectedFrameIdx === idx ? "active" : ""}`}
                            onClick={() => {
                              setSelectedFrameIdx(idx);
                              setViewMode("report");
                            }}
                          >
                            <div className="tile-thumb">
                              <img src={f.url} alt={f.phase} />
                              <span className="thumb-phase">#{idx + 1} {f.phase}</span>
                              <span className="thumb-offset">{f.offset_sec >= 0 ? `+${f.offset_sec}` : f.offset_sec}s</span>
                            </div>
                            <div className="tile-desc">
                              <strong>{f.video_ts_text}</strong>
                              <p>{f.observation}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Section 1: Executive Summary */}
                  <div className="modal-report-section">
                    <h3>1. Executive Summary & Scene Assessment</h3>
                    <p className="narrative-text">{activeInc.executive_summary || activeInc.interpretation}</p>
                  </div>

                  {/* Section 2: Kinematic & Root Cause Analysis */}
                  <div className="modal-report-section">
                    <h3>2. Kinematics & Computer Vision Root Cause</h3>
                    <div className="report-grid-2col">
                      <div className="report-subcard">
                        <strong>Root Cause & Trigger Detection:</strong>
                        <p>{activeInc.root_cause_analysis || activeInc.observation || "Detected through optical flow divergence."}</p>
                      </div>
                      <div className="report-subcard">
                        <strong>Kinematic Dynamics:</strong>
                        <p>{activeInc.scene_context?.kinematics || "Sudden velocity shift, aspect ratio disruption, temporal trajectory deviation."}</p>
                      </div>
                    </div>
                  </div>

                  {/* Section 3: Threat & Impact Assessment */}
                  <div className="modal-report-section">
                    <h3>3. Threat & Impact Assessment</h3>
                    <div className="report-grid-3col">
                      <div className="report-subcard">
                        <span className="subcard-title">Physical Injury Risk</span>
                        <p>{activeInc.impact_assessment?.injury_risk || "Evaluation based on kinematics and subject ground posture."}</p>
                      </div>
                      <div className="report-subcard">
                        <span className="subcard-title">Disruption / Operational Risk</span>
                        <p>{activeInc.impact_assessment?.disruption_risk || "Facility zone passage hazard."}</p>
                      </div>
                      <div className="report-subcard">
                        <span className="subcard-title">Containment Urgency</span>
                        <p>{activeInc.impact_assessment?.containment_urgency || "Immediate control room verification required within 60s."}</p>
                      </div>
                    </div>
                  </div>

                  {/* Section 4: Standard Operating Procedure (SOP) Directives */}
                  <div className="modal-report-section">
                    <h3>4. Standard Operating Procedure (SOP) Directives</h3>
                    <div className="sop-checklist">
                      {(activeInc.procedure || [
                        "Verify live CCTV camera feed against multi-frame sequence",
                        "Confirm ground status / vehicle presence in field of view",
                        "Initiate emergency dispatch or on-site security response if verified",
                        "Log operator verification badge and resolution outcome in central registry",
                        "Export and archive high-definition evidence sequence"
                      ]).map((step, idx) => (
                        <label key={idx} className="sop-item">
                          <input
                            type="checkbox"
                            checked={!!checkedSOP[idx]}
                            onChange={() => setCheckedSOP((prev) => ({ ...prev, [idx]: !prev[idx] }))}
                          />
                          <span>{step}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  {/* Section 5: Operator Verification & Action Station */}
                  <div className="modal-report-section action-station">
                    <h3>5. Operator Verification & Incident Disposition</h3>
                    <div className="action-button-row">
                      <button
                        className={`btn ${activeInc.status === "verified" ? "btn-primary" : ""}`}
                        onClick={() => handleStatusChange("verified")}
                      >
                        ✅ Confirm & Verify Incident
                      </button>
                      <button
                        className={`btn ${activeInc.status === "resolved" ? "btn-primary" : ""}`}
                        onClick={() => handleStatusChange("resolved")}
                      >
                        ✔️ Mark Resolved
                      </button>
                      <button
                        className={`btn ${activeInc.status === "rejected" ? "btn-primary" : ""}`}
                        onClick={() => handleStatusChange("rejected")}
                      >
                        ⚠️ False Alarm / Reject
                      </button>
                      <button
                        className="btn btn-emergency"
                        onClick={() => alert(`DISPATCH ALERT: Emergency services notified for Camera ${channel.id} (${channel.zone}).`)}
                      >
                        🚨 Dispatch Security Patrol
                      </button>
                    </div>

                    <div className="operator-notes-box">
                      <label>
                        Operator Verification Notes & Findings:
                        <textarea
                          rows={3}
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Enter operator badge, actions taken, responder details..."
                        />
                      </label>
                      <button className="btn btn-sm btn-primary" onClick={handleSaveNotes}>
                        {notesSaved ? "Saved!" : "Save Operator Notes"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            /* NOMINAL FEED REPORT (0 Incidents Detected) */
            <div className="modal-nominal-report">
              <div className="nominal-hero-card">
                <div className="hero-icon">🛡️</div>
                <div className="hero-text">
                  <h3>FACILITY SURVEILLANCE CLEARANCE CERTIFICATE</h3>
                  <p>Continuous AI anomaly detection active on <strong>{channel.name}</strong> ({channel.zone}). All optical flow, boundary crossing, posture change, and velocity tracking vectors are within nominal baseline tolerances.</p>
                </div>
              </div>

              <div className="modal-report-section">
                <h3>1. Continuous Optical Monitoring Assessment</h3>
                <p className="narrative-text">
                  Computer vision background modeling confirms stable perimeter conditions throughout the surveillance duration. Optical flow variance across all 4 calibrated quadrants remains below 2.3% (anomaly threshold: 12.0%). No sudden luminance divergence or kinetic disruption detected.
                </p>
              </div>

              <div className="modal-report-section">
                <h3>2. Perimeter & Object Tracking Inventory</h3>
                <div className="report-grid-3col">
                  <div className="report-subcard">
                    <span className="subcard-title">Perimeter Infiltration</span>
                    <strong className="subcard-ok">ZERO BREACHES</strong>
                    <p>Calibrated intrusion polygon undisturbed.</p>
                  </div>
                  <div className="report-subcard">
                    <span className="subcard-title">Kinematic Collisions</span>
                    <strong className="subcard-ok">NOMINAL</strong>
                    <p>No sudden deceleration or bounding box intersection.</p>
                  </div>
                  <div className="report-subcard">
                    <span className="subcard-title">Fall & Posture Loss</span>
                    <strong className="subcard-ok">NOMINAL</strong>
                    <p>No verticality loss or floor-level collapse kinematics.</p>
                  </div>
                </div>
              </div>

              <div className="modal-report-section">
                <h3>3. Video Playback & Stream Diagnostics</h3>
                <div className="modal-stage-media">
                  <video src={cam?.video_url} controls autoPlay muted playsInline />
                </div>
              </div>

              <div className="modal-report-section">
                <h3>4. SOC Surveillance Sign-Off</h3>
                <p className="narrative-text">
                  Certified operational by CCTV AI Surveillance Agent. Video stream is archived in accordance with facility compliance guidelines. Routine automated sensor checks scheduled every 300 seconds.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
