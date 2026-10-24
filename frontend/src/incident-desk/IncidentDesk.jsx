import { useState, useMemo, useRef, useEffect } from "react";
import CCTVGrid3x3 from "./CCTVGrid3x3";
import FocusPanel from "./FocusPanel";
import Queue from "./Queue";
import Report from "./Report";
import ReportPromptDialog from "./ReportPromptDialog";
import CompleteVideoReportModal from "./CompleteVideoReportModal";
import EmergencyReportView from "./EmergencyReportView";
import { CCTV_CHANNELS, OPEN_STATUSES } from "./cctvChannels";
import {
  upload,
  patchIncident,
  deepInvestigate,
  sendIncidentEmail,
  sendIncidentSms,
  updateEmergencyContact,
  getSmtpConfig,
  updateSmtpConfig,
  sendTestEmail,
} from "./api";

function useCctvClock() {
  const [time, setTime] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = time.getFullYear();
  const mm = pad(time.getMonth() + 1);
  const dd = pad(time.getDate());
  const hh = pad(time.getHours());
  const min = pad(time.getMinutes());
  const ss = pad(time.getSeconds());
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
}

export default function IncidentDesk({
  cameras = {},
  incidents = {},
  online = true,
  emailDispatches = [],
  smsDispatches = [],
  emergencyContact = {},
  lastEmailDispatch = null,
  lastSmsDispatch = null,
  initialIncidentId = null,
  initialViewMode = "matrix3x3",
  onReturnHome,
  onNavigateModule,
  onOpenEmergencyReport: externalOpenReport,
}) {
  const activeDispatches = emailDispatches.length > 0 ? emailDispatches : smsDispatches;
  const latestAlert = lastEmailDispatch || lastSmsDispatch;

  const [focusCam, setFocusCam] = useState(null);
  const [selected, setSelected] = useState(initialIncidentId || null);
  const [voice, setVoice] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [viewMode, setViewMode] = useState(initialIncidentId ? "review" : initialViewMode);
  const [promptTarget, setPromptTarget] = useState(null);
  const [reportModalData, setReportModalData] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailToast, setEmailToast] = useState(null);
  const [emailInput, setEmailInput] = useState(emergencyContact?.email || "rishikvelagapudi@gmail.com");
  const [emailSaved, setEmailSaved] = useState(false);
  const [quickEmailSending, setQuickEmailSending] = useState(false);

  // Real SMTP / Gmail Delivery Configuration state
  const [smtpConfig, setSmtpConfig] = useState({
    host: "smtp.gmail.com",
    port: 587,
    user: "",
    password: "",
    is_configured: false,
    has_password: false,
  });
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [smtpSaved, setSmtpSaved] = useState(false);
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState(null);

  const clockStr = useCctvClock();

  // Watch for incoming real-time Email dispatches
  useEffect(() => {
    if (latestAlert) {
      setEmailToast(latestAlert);
      const timer = setTimeout(() => setEmailToast(null), 9000);
      return () => clearTimeout(timer);
    }
  }, [latestAlert]);

  useEffect(() => {
    if (emergencyContact?.email) {
      setEmailInput(emergencyContact.email);
    }
  }, [emergencyContact?.email]);

  // Load SMTP configuration when Email modal opens
  useEffect(() => {
    if (showEmailModal) {
      getSmtpConfig()
        .then((cfg) => {
          setSmtpConfig((prev) => ({
            ...prev,
            host: cfg.host || "smtp.gmail.com",
            port: cfg.port || 587,
            user: cfg.user || "",
            from_email: cfg.from_email || "",
            is_configured: !!cfg.is_configured,
            has_password: !!cfg.has_password,
            password: "",
          }));
        })
        .catch(() => {});
    }
  }, [showEmailModal]);

  useEffect(() => {
    if (initialIncidentId) {
      setSelected(initialIncidentId);
      setViewMode("review");
    }
  }, [initialIncidentId]);

  const handleOpenEmergencyReport = (incId) => {
    if (incId) setSelected(incId);
    setViewMode("review");
    if (externalOpenReport) externalOpenReport(incId);
    try {
      window.history.pushState({}, "", `/incident-report/${incId || selected}`);
    } catch (e) {}
  };

  const handleReturnFromReview = () => {
    setViewMode("matrix3x3");
    try {
      window.history.pushState({}, "", "/");
    } catch (e) {}
  };

  const handleSaveSmtp = async () => {
    setSmtpLoading(true);
    try {
      const updated = await updateSmtpConfig({
        host: smtpConfig.host,
        port: Number(smtpConfig.port) || 587,
        user: smtpConfig.user,
        password: smtpConfig.password,
        from_email: smtpConfig.from_email || smtpConfig.user,
      });
      setSmtpConfig((prev) => ({
        ...prev,
        ...updated,
        password: "",
      }));
      setSmtpSaved(true);
      setTimeout(() => setSmtpSaved(false), 2500);
    } catch (e) {
      alert("Failed to save SMTP config: " + e.message);
    } finally {
      setSmtpLoading(false);
    }
  };

  const handleSendLiveTest = async () => {
    setTestEmailSending(true);
    setTestEmailResult(null);
    try {
      const res = await sendTestEmail(emailInput || "rishikvelagapudi@gmail.com");
      setTestEmailResult({
        ok: true,
        message: res.message || `Test email delivered successfully to ${emailInput || "rishikvelagapudi@gmail.com"}!`,
      });
    } catch (e) {
      setTestEmailResult({
        ok: false,
        message:
          e.message ||
          "SMTP transmission failed. For Gmail, make sure to generate an App Password at myaccount.google.com/apppasswords.",
      });
    } finally {
      setTestEmailSending(false);
    }
  };

  const camList = useMemo(() => Object.values(cameras).sort((a, b) => a.id.localeCompare(b.id)), [cameras]);
  const queue = useMemo(
    () =>
      Object.values(incidents)
        .filter((i) => OPEN_STATUSES.includes(i.status))
        .sort((a, b) => b.priority_score - a.priority_score || b.video_ts - a.video_ts),
    [incidents]
  );
  const closed = useMemo(() => Object.values(incidents).filter((i) => !OPEN_STATUSES.includes(i.status)), [incidents]);
  const incident = incidents[selected];
  const camera = cameras[incident?.camera_id || focusCam] || camList[0];
  const criticalOpen = queue.filter((i) => i.severity === "critical").length;

  const onFiles = async (files) => {
    if (!files?.length) return;
    setBusy(true);
    setError("");
    try {
      await upload(files);
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  const reset = async () => {
    await fetch("/api/reset", { method: "POST" });
    setSelected(null);
    setFocusCam(null);
    setPromptTarget(null);
    setReportModalData(null);
  };

  const handleLoadDemo = async () => {
    setBusy(true);
    setError("");
    try {
      const r = await fetch("/api/load-demo", { method: "POST" });
      if (!r.ok) {
        const err = await r.json();
        throw new Error(err.detail || "Failed to load demo feeds");
      }
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  };

  const pickIncident = (inc) => {
    setSelected(inc.id);
    setFocusCam(inc.camera_id);
  };

  const openReportModal = (ch, cam) => {
    if (!cam) return;
    const camIncidents = Object.values(incidents).filter((i) => i.camera_id === cam.id);
    const top = camIncidents[0] || null;
    setReportModalData({
      channel: ch,
      cam,
      incidents: camIncidents,
      activeIncidentId: top?.id || null,
    });
  };

  const pickCell = (ch, cam, topInc) => {
    if (cam) {
      setFocusCam(cam.id);
      if (topInc) {
        setSelected(topInc.id);
      } else {
        const first = queue.find((i) => i.camera_id === cam.id);
        setSelected(first ? first.id : null);
      }
      const camIncidents = Object.values(incidents).filter((i) => i.camera_id === cam.id);
      setPromptTarget({
        channel: ch,
        cam,
        topIncident: topInc,
        allIncidents: camIncidents,
      });
    } else {
      setFocusCam(ch.id);
    }
  };

  const inspectCell = (ch, cam, topInc) => {
    if (cam) {
      setFocusCam(cam.id);
      if (topInc) {
        setSelected(topInc.id);
      } else {
        const first = queue.find((i) => i.camera_id === cam.id);
        setSelected(first ? first.id : null);
      }
    } else {
      setFocusCam(ch.id);
    }
    setViewMode("focus");
  };

  const handleQuickEmail = async (incId) => {
    if (!incId) return;
    setQuickEmailSending(true);
    try {
      const res = await sendIncidentEmail(incId);
      setEmailToast(res);
      setTimeout(() => setEmailToast(null), 8000);
    } catch (e) {
      alert("Failed to send email alert: " + e.message);
    } finally {
      setQuickEmailSending(false);
    }
  };

  const handleSaveEmail = async () => {
    try {
      await updateEmergencyContact({ email: emailInput });
      setEmailSaved(true);
      setTimeout(() => setEmailSaved(false), 2000);
    } catch (e) {
      alert("Failed to save emergency email: " + e.message);
    }
  };

  if (viewMode === "review" && (selected || queue[0]?.id)) {
    const activeIncId = selected || queue[0]?.id;
    return (
      <EmergencyReportView
        incidentId={activeIncId}
        onReturnToConsole={handleReturnFromReview}
        onReturnHome={onReturnHome}
        incidentsMap={incidents}
        camerasMap={cameras}
      />
    );
  }

  return (
    <div className="desk">
      <header className="bar">
        <button className="btn btn-sm btn-home" onClick={onReturnHome} title="Return to Landing Page">
          ← Home
        </button>
        <div className="bar-title-wrap">
          <h1>Incident Desk</h1>
          <span className="module-badge">AIFS Module 01</span>
        </div>
        <div className="bar-stats">
          <span className={criticalOpen ? "pill pill-critical" : "pill"}>{criticalOpen} critical open</span>
          <span className="pill">{queue.length} awaiting action</span>
          <span className={online ? "pill pill-ok" : "pill pill-high"}>{online ? "Connected" : "Reconnecting"}</span>
        </div>
        <div className="bar-actions">
          <button
            className="btn btn-sm btn-email-center btn-sms-center"
            onClick={() => setShowEmailModal(true)}
            title="Open Emergency Email Alert Dispatch Center"
          >
            📧 Email Alert Center ({activeDispatches.length})
          </button>
          <button
            className="btn btn-load-demo"
            onClick={handleLoadDemo}
            disabled={busy}
            title="Populate 9 CCTV Cameras from Demo Bank"
          >
            ⚡ {busy ? "Loading..." : "Load 9 CCTV Feeds"}
          </button>
          <label className="btn">
            <input type="checkbox" checked={voice} onChange={(e) => setVoice(e.target.checked)} /> Voice alerts
          </label>
          <label className="btn btn-primary">
            {busy ? "Uploading…" : "+ Add videos"}
            <input type="file" accept="video/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
          </label>
          {camList.length > 0 && (
            <button className="btn" onClick={reset}>
              Start over
            </button>
          )}
        </div>
      </header>

      {error && <div className="error">{error}</div>}

      <main className="floor">
        <section className="center">
          {/* Top 3x3 Control Bar */}
          <div className="cctv-matrix-bar">
            <div className="cctv-matrix-bar-left">
              <div className="cctv-matrix-title">
                <span className="matrix-icon">⊞</span>
                <strong>3×3 CCTV SURVEILLANCE WALL</strong>
                <span className="matrix-count">({camList.length}/9 Active Feeds)</span>
              </div>
              {criticalOpen > 0 ? (
                <span className="cctv-matrix-alert-pill">
                  🚨 {criticalOpen} CRITICAL {criticalOpen === 1 ? "BREACH" : "BREACHES"} ACTIVE
                </span>
              ) : (
                <span className="cctv-matrix-status-pill">● SOC NOMINAL</span>
              )}
            </div>
            <div className="cctv-matrix-bar-right">
              {camera && (
                <button
                  className="btn btn-sm btn-video-report"
                  onClick={() => {
                    const ch = CCTV_CHANNELS.find((c) => c.id === camera.id) || CCTV_CHANNELS[0];
                    openReportModal(ch, camera);
                  }}
                  title="Open Complete Video Report for selected camera"
                >
                  📄 Video Report ({camera.id})
                </button>
              )}
              <div className="cctv-view-toggles">
                <button
                  className={`btn btn-sm ${viewMode === "matrix3x3" ? "btn-primary" : ""}`}
                  onClick={() => setViewMode("matrix3x3")}
                  title="Full 3x3 Grid Wall"
                >
                  ⊞ 3×3 Grid
                </button>
                <button
                  className={`btn btn-sm ${viewMode === "focus" ? "btn-primary" : ""}`}
                  onClick={() => setViewMode("focus")}
                  title="Focus Player & Dossier with 3x3 Grid"
                >
                  ▣ Focus & Grid
                </button>
                {(selected || queue[0]?.id) && (
                  <button
                    className={`btn btn-sm btn-emergency-review ${viewMode === "review" ? "btn-primary" : ""}`}
                    onClick={() => handleOpenEmergencyReport(selected || queue[0]?.id)}
                    title="Open Incident Video Review and 5-Frame Critical Breakdown"
                  >
                    🚨 Video Review & Frames
                  </button>
                )}
              </div>
              {camList.length < 9 && (
                <button
                  className="btn btn-sm btn-load-demo"
                  onClick={handleLoadDemo}
                  disabled={busy}
                  title="Load all 9 demo camera feeds"
                >
                  ⚡ Load 9 Feeds
                </button>
              )}
            </div>
          </div>

          {/* Active Alert Banner if there is an incident */}
          {incident && viewMode === "matrix3x3" && (
            <div className={`cctv-active-alert-strip sev-${incident.severity}`}>
              <div className="strip-left">
                <span className="strip-badge">{incident.severity.toUpperCase()}</span>
                <strong>{incident.camera_name} ({incident.video_ts_text}):</strong>
                <span>{incident.alert_text}</span>
              </div>
              <div className="strip-right-actions">
                <button
                  className="btn btn-sm btn-emergency-review"
                  onClick={() => handleOpenEmergencyReport(incident.id)}
                  title="Open dedicated video review and evidence breakdown interface"
                >
                  🚨 Review Video Report (SMS Interface) →
                </button>
                <button
                  className="btn btn-sm btn-sms-quick"
                  disabled={quickSmsSending}
                  onClick={() => handleQuickSms(incident.id)}
                  title="Dispatch Emergency SMS to static phone number"
                >
                  {quickSmsSending ? "Sending…" : "📱 Send SMS"}
                </button>
                <button
                  className="btn btn-sm btn-seek"
                  onClick={() => setViewMode("focus")}
                >
                  Inspect →
                </button>
              </div>
            </div>
          )}

          {/* Focus Panel if in focus view mode */}
          {viewMode === "focus" && camera && (
            <FocusPanel camera={camera} incident={incident} />
          )}

          {/* The 3x3 CCTV Frame Wall */}
          <CCTVGrid3x3
            channels={CCTV_CHANNELS}
            camList={camList}
            activeCamId={camera?.id}
            selectedIncidentId={selected}
            queue={queue}
            onPickCell={pickCell}
            onInspectCell={inspectCell}
            onOpenReport={openReportModal}
            onUploadChannel={onFiles}
            clockStr={clockStr}
          />
        </section>

        <aside className="side">
          <Queue queue={queue} closed={closed} selected={selected} onPick={pickIncident} />
          {incident && <Report key={incident.id} inc={incident} onOpenEmergencyReport={handleOpenEmergencyReport} />}
        </aside>
      </main>

      {/* Interactive Report Prompt Dialog */}
      {promptTarget && (
        <ReportPromptDialog
          target={promptTarget}
          onConfirm={() => {
            openReportModal(promptTarget.channel, promptTarget.cam);
            setPromptTarget(null);
          }}
          onFocusOnly={() => {
            setPromptTarget(null);
          }}
          onClose={() => setPromptTarget(null)}
        />
      )}

      {/* Complete Video Report Modal */}
      {reportModalData && (
        <CompleteVideoReportModal
          data={reportModalData}
          allIncidentsMap={incidents}
          onClose={() => setReportModalData(null)}
          onPatchIncident={patchIncident}
          onDeepInvestigate={deepInvestigate}
        />
      )}

      {/* Live Emergency Email Dispatch Toast Popup */}
      {emailToast && (
        <div className="sms-live-toast email-live-toast" onClick={() => handleOpenEmergencyReport(emailToast.incident_id)}>
          <div className="sms-toast-header">
            <span className="sms-live-dot">●</span>
            <strong>🚨 EMERGENCY EMAIL ALERT DISPATCHED</strong>
            <button
              className="btn-close-toast"
              onClick={(e) => {
                e.stopPropagation();
                setEmailToast(null);
              }}
            >
              ✕
            </button>
          </div>
          <div className="sms-toast-body">
            <div className="sms-toast-phone">
              To Static Emergency Email: <strong>{emailToast.recipient_email || emailToast.recipient_phone}</strong>
            </div>
            <div className="sms-toast-msg-preview">
              <span className="sms-msg-label">SUBJECT:</span>
              <p>{emailToast.subject || `${emailToast.label} (${emailToast.incident_id})`}</p>
            </div>
            <div className="sms-toast-action-link">
              <span>👉 Click notification to open Video Review Interface</span>
              <button className="btn btn-sm btn-primary">Open Report Now →</button>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Email Dispatch Center Modal */}
      {showEmailModal && (
        <div className="report-modal-backdrop" onClick={() => setShowEmailModal(false)}>
          <div className="sms-center-modal email-center-modal" onClick={(e) => e.stopPropagation()}>
            <div className="report-modal-header">
              <div className="modal-header-left">
                <span className="confidential-tag">AIFS EMERGENCY COMMUNICATIONS GATEWAY</span>
                <h2>📧 Emergency Email Alert Dispatch Center</h2>
                <span className="modal-header-meta">High-priority automated Email dispatch engine for critical & high incident alerts.</span>
              </div>
              <button className="btn btn-sm btn-close-modal" onClick={() => setShowEmailModal(false)}>✕ Close</button>
            </div>

            <div className="sms-center-body">
              {/* Static Email Address Configuration Card */}
              <div className="sms-config-card email-config-card">
                <div className="config-info">
                  <strong>Configured Static Emergency Email Address:</strong>
                  <p>When an emergency incident or alert is detected by the AI agent, the system immediately and automatically pushes an official dispatch email with telemetry data and the direct review interface link to this email address.</p>
                </div>
                <div className="config-input-row">
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="rishikvelagapudi@gmail.com"
                    className="sms-phone-input email-input"
                  />
                  <button className="btn btn-primary" onClick={handleSaveEmail}>
                    {emailSaved ? "Saved!" : "Save Email Address"}
                  </button>
                </div>
              </div>

              {/* Real Gmail / SMTP Dispatch Configuration & Test Card */}
              <div
                className="sms-config-card email-config-card smtp-config-card"
                style={{
                  marginTop: "14px",
                  background: "linear-gradient(135deg, rgba(22, 8, 48, 0.9) 0%, rgba(11, 3, 24, 0.95) 100%)",
                  border: "1px solid rgba(0, 229, 255, 0.35)",
                  borderRadius: "8px",
                  padding: "16px",
                }}
              >
                <div className="config-info">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
                    <strong style={{ color: "var(--cyan)", fontSize: "14px" }}>
                      ⚡ Real Email (SMTP / Gmail) Delivery Gateway:
                    </strong>
                    <span className={`pill ${smtpConfig.is_configured ? "pill-ok" : "pill-high"}`}>
                      {smtpConfig.is_configured ? "● SMTP Connected & Configured" : "○ Gmail App Password Needed"}
                    </span>
                  </div>
                  <p style={{ margin: "6px 0 10px", fontSize: "12.5px", color: "#ddd" }}>
                    కచ్చితంగా మీ మెయిల్ (<strong>{emailInput || "rishikvelagapudi@gmail.com"}</strong>) కి రియల్ అలర్ట్ మెసేజ్ రావడానికి, మీ పంపించే Gmail మరియు 16 అక్షరాల Google App Password ఇక్కడ నమోదు చేసి టెస్ట్ చేయండి.
                  </p>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "12px" }}>
                  <div>
                    <label style={{ fontSize: "11px", color: "var(--cyan)", display: "block", marginBottom: "4px", fontWeight: "600" }}>
                      Sender Gmail / SMTP Username:
                    </label>
                    <input
                      type="text"
                      value={smtpConfig.user}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, user: e.target.value })}
                      placeholder="e.g. sender@gmail.com"
                      className="sms-phone-input email-input"
                      style={{ width: "100%", padding: "7px 10px", fontSize: "13px" }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: "11px", color: "var(--cyan)", display: "block", marginBottom: "4px", fontWeight: "600" }}>
                      Google App Password (16 characters):
                    </label>
                    <input
                      type="password"
                      value={smtpConfig.password}
                      onChange={(e) => setSmtpConfig({ ...smtpConfig, password: e.target.value })}
                      placeholder={smtpConfig.has_password ? "•••••••••••••••• (Saved)" : "16-letter App Password"}
                      className="sms-phone-input email-input"
                      style={{ width: "100%", padding: "7px 10px", fontSize: "13px" }}
                    />
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                  <div style={{ fontSize: "11px", color: "var(--muted)" }}>
                    Host: <code>{smtpConfig.host || "smtp.gmail.com"}:{smtpConfig.port || 587}</code> (STARTTLS)
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button className="btn btn-sm btn-primary" onClick={handleSaveSmtp} disabled={smtpLoading}>
                      {smtpSaved ? "Credentials Saved!" : "Save SMTP Settings"}
                    </button>
                    <button
                      className="btn btn-sm btn-resend-email"
                      onClick={handleSendLiveTest}
                      disabled={testEmailSending}
                      style={{ background: "linear-gradient(135deg, #00e5ff, #00b4d8)", color: "#000", fontWeight: "700" }}
                      title="Send immediate test email to recipient"
                    >
                      {testEmailSending ? "Sending Test Email…" : `🚀 Send Test Email to ${emailInput || "rishikvelagapudi@gmail.com"}`}
                    </button>
                  </div>
                </div>

                {/* Live Diagnostic Message Banner */}
                {testEmailResult && (
                  <div
                    style={{
                      marginTop: "12px",
                      padding: "10px 14px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      background: testEmailResult.ok ? "rgba(0, 255, 136, 0.15)" : "rgba(255, 42, 109, 0.2)",
                      border: `1px solid ${testEmailResult.ok ? "#00ff88" : "#ff2a6d"}`,
                      color: "#fff",
                    }}
                  >
                    <strong>{testEmailResult.ok ? "✅ SUCCESS: " : "⚠️ SMTP NOTICE: "}</strong>
                    <span>{testEmailResult.message}</span>
                  </div>
                )}

                <div style={{ marginTop: "10px", fontSize: "11px", color: "#a692ce", background: "rgba(10, 3, 24, 0.6)", padding: "8px 12px", borderRadius: "4px", lineHeight: "1.5" }}>
                  💡 <strong>Google App Password ఎలా పొందాలి (Quick Guide):</strong><br />
                  1. Visit <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer" style={{ color: "var(--cyan)", textDecoration: "underline" }}>myaccount.google.com/apppasswords</a>.<br />
                  2. మీ Google Account లో 2-Step Verification ఆన్ చేయండి.<br />
                  3. "App Name" లో <code>AIFS Alert</code> అని ఇచ్చి Create పై క్లిక్ చేయండి.<br />
                  4. అక్కడ వచ్చే 16 అక్షరాల పాస్‌వర్డ్ కాపీ చేసి ఇక్కడ పేస్ట్ చేసి Save క్లిక్ చేయండి.
                </div>
              </div>

              {/* Sent Email Dispatches History Table */}
              <div className="sms-history-section email-history-section">
                <h3>Sent Emergency Email Dispatches ({activeDispatches.length})</h3>
                {activeDispatches.length === 0 ? (
                  <p className="muted">No email alerts dispatched yet. Dispatches will trigger automatically when an incident of High or Critical severity is flagged.</p>
                ) : (
                  <div className="sms-table-wrap">
                    <table className="sms-table email-table">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Recipient Email</th>
                          <th>Incident</th>
                          <th>Severity</th>
                          <th>Subject / Brief</th>
                          <th>Status</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activeDispatches.map((d) => (
                          <tr key={d.id}>
                            <td>{d.dispatched_at}</td>
                            <td><strong>{d.recipient_email || d.recipient_phone}</strong></td>
                            <td>{d.incident_id}</td>
                            <td>
                              <span className={`pill pill-${d.severity || "high"}`}>
                                {(d.severity || "HIGH").toUpperCase()}
                              </span>
                            </td>
                            <td style={{ maxWidth: "260px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              <span title={d.subject || d.label}>{d.subject || d.label}</span>
                            </td>
                            <td><span className="badge-delivered">● {d.status || "DELIVERED"}</span></td>
                            <td>
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => {
                                  setShowEmailModal(false);
                                  onOpenEmergencyReport?.(d.incident_id);
                                }}
                              >
                                Open Report & Video →
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
