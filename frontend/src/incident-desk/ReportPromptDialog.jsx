export default function ReportPromptDialog({ target, onConfirm, onFocusOnly, onClose }) {
  const { channel, cam, topIncident, allIncidents = [] } = target;
  const hasIncident = allIncidents.length > 0;
  const sev = topIncident?.severity || "normal";

  return (
    <div className="report-modal-backdrop" onClick={onClose}>
      <div className="report-prompt-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="prompt-header">
          <div className="prompt-header-icon">
            {hasIncident ? (sev === "critical" ? "🚨" : "⚠️") : "📹"}
          </div>
          <div className="prompt-header-text">
            <h3>{channel.id}: {cam?.name || channel.name}</h3>
            <span className="prompt-zone-tag">{channel.zone} · {channel.res}</span>
          </div>
          <button className="btn-close-prompt" onClick={onClose} title="Dismiss">✕</button>
        </div>

        <div className="prompt-body">
          {hasIncident ? (
            <div className={`prompt-incident-alert sev-${sev}`}>
              <div className="alert-badge">{sev.toUpperCase()} ALERT DETECTED</div>
              <strong>{topIncident?.label || "Surveillance Breach"}</strong>
              <p>{topIncident?.alert_text || "Automated analysis flagged an incident on this camera feed."}</p>
              <div className="alert-meta">
                <span>⏱ Timestamp: {topIncident?.video_ts_text}</span>
                <span>📊 Confidence: {Math.round((topIncident?.confidence || 0.85) * 100)}%</span>
                <span>🔢 Total Events: {allIncidents.length}</span>
              </div>
            </div>
          ) : (
            <div className="prompt-nominal-alert">
              <div className="nominal-badge">● NOMINAL SURVEILLANCE</div>
              <strong>Perimeter Secure & Active</strong>
              <p>Continuous AI monitoring active on {channel.name}. Zero anomaly breaches or security threats detected.</p>
              <div className="alert-meta">
                <span>FPS: {channel.fps}</span>
                <span>Status: Continuous Monitoring</span>
              </div>
            </div>
          )}

          <div className="prompt-question-box">
            <div className="question-icon">📄</div>
            <div className="question-text">
              <h4>Would you like to view the complete detailed report for this video?</h4>
              <p>Generates full forensic analysis, multi-frame evidence timeline, kinematic metrics, SOP checklist, and incident dossier.</p>
            </div>
          </div>
        </div>

        <div className="prompt-actions">
          <button className="btn btn-primary btn-lg" onClick={onConfirm}>
            📄 Yes, View Complete Report
          </button>
          <button className="btn btn-lg" onClick={onFocusOnly}>
            👁️ Just Focus Video
          </button>
          <button className="btn btn-sm btn-ghost" onClick={onClose}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
