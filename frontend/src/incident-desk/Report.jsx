import { useEffect, useState } from "react";
import { STATUS_LABEL } from "./cctvChannels";
import { patchIncident, deepInvestigate, sendIncidentEmail, sendIncidentSms } from "./api";

export default function Report({ inc, onOpenEmergencyReport }) {
  const [tab, setTab] = useState("dossier");
  const [investigating, setInvestigating] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [checkedSteps, setCheckedSteps] = useState({ 0: true });
  const [draft, setDraft] = useState({
    executive_summary: inc.executive_summary || "",
    observation: inc.observation || "",
    interpretation: inc.interpretation || "",
    recommended_action: inc.recommended_action || "",
    operator_notes: inc.operator_notes || "",
  });

  useEffect(() => {
    setDraft({
      executive_summary: inc.executive_summary || "",
      observation: inc.observation || "",
      interpretation: inc.interpretation || "",
      recommended_action: inc.recommended_action || "",
      operator_notes: inc.operator_notes || "",
    });
  }, [inc.id, inc.executive_summary, inc.observation, inc.operator_notes]);

  const dirty = Object.keys(draft).some((k) => draft[k] !== (inc[k] || ""));
  const set = (k) => (e) => setDraft({ ...draft, [k]: e.target.value });

  const runInvestigation = async () => {
    setInvestigating(true);
    try {
      await deepInvestigate(inc.id);
    } catch (e) {
      alert("Investigation error: " + e.message);
    } finally {
      setInvestigating(false);
    }
  };

  const toggleStep = (idx) => {
    setCheckedSteps((prev) => ({ ...prev, [idx]: !prev[idx] }));
  };

  const handleDispatchEmail = async () => {
    setEmailSending(true);
    try {
      const res = await sendIncidentEmail(inc.id);
      alert(`🚨 Emergency Email Alert Dispatched to ${res.recipient_email}!\n\nSubject:\n${res.subject}\n\nReview link provided in Email:\n${res.report_url}`);
    } catch (e) {
      alert("Failed to send email alert: " + e.message);
    } finally {
      setEmailSending(false);
    }
  };

  const frames = inc.evidence_frames || [];
  const scene = inc.scene_context || {};
  const impact = inc.impact_assessment || {};

  return (
    <div className="panel report">
      <div className="report-header">
        <div className="report-title-row">
          <div>
            <h2>{inc.id} · {inc.label}</h2>
            <div className="report-tags">
              <span className={`pill pill-${inc.severity}`}>{inc.severity.toUpperCase()}</span>
              <span className="pill">{STATUS_LABEL[inc.status]}</span>
              <span className="pill pill-source">{inc.description_source || "Agent Dossier"}</span>
            </div>
          </div>
          <div className="report-toolbar">
            <button
              className="btn btn-sm btn-emergency-link"
              onClick={() => onOpenEmergencyReport?.(inc.id)}
              title="Open dedicated standalone video review and evidence breakdown interface"
            >
              🚨 Open Video Review Interface
            </button>
            <button
              className="btn btn-sm btn-email-alert btn-sms-alert"
              disabled={emailSending}
              onClick={handleDispatchEmail}
              title="Dispatch emergency Email alert to configured static address"
            >
              {emailSending ? "Sending…" : "📧 Send Email"}
            </button>
            <button
              className="btn btn-sm btn-agent-scan"
              disabled={investigating}
              onClick={runInvestigation}
              title="Run AI Agent multi-frame video scan and regenerate full-page dossier"
            >
              {investigating ? "Scanning…" : "AI Deep Scan"}
            </button>
            <button className="btn btn-sm" onClick={() => window.print()} title="Print or export 1-page report">
              Print
            </button>
          </div>
        </div>

        <div className="report-tabs">
          <button className={tab === "dossier" ? "active" : ""} onClick={() => setTab("dossier")}>
            Full Page Dossier
          </button>
          <button className={tab === "edit" ? "active" : ""} onClick={() => setTab("edit")}>
            Edit Draft
          </button>
        </div>
      </div>

      {tab === "edit" ? (
        <div className="report-edit-mode">
          <label>
            Executive Summary / Scene Narrative
            <textarea rows={5} value={draft.executive_summary} onChange={set("executive_summary")} />
          </label>
          <label>
            Observation (Visual Evidence)
            <textarea rows={3} value={draft.observation} onChange={set("observation")} />
          </label>
          <label>
            Interpretation
            <textarea rows={3} value={draft.interpretation} onChange={set("interpretation")} />
          </label>
          <label>
            Recommended Action
            <textarea rows={2} value={draft.recommended_action} onChange={set("recommended_action")} />
          </label>
          <label>
            Operator Notes
            <textarea rows={2} value={draft.operator_notes} onChange={set("operator_notes")} placeholder="Enter verification notes, responder name, or outcome..." />
          </label>
          {dirty && (
            <button className="btn btn-primary mt-8" onClick={() => patchIncident(inc.id, draft)}>
              Save Edits
            </button>
          )}
        </div>
      ) : (
        <div className="report-dossier-mode">
          {/* Executive Summary */}
          <section className="dossier-sec">
            <h3>1. Scene Identification & Executive Narrative</h3>
            <p className="narrative-text">{inc.executive_summary || inc.interpretation || inc.observation}</p>
          </section>

          {/* Multi-Frame Evidence Sequence */}
          {frames.length > 0 && (
            <section className="dossier-sec">
              <h3>2. Multi-Frame Evidence Sequence (T-3.0s to T+3.0s)</h3>
              <div className="dossier-frames-grid">
                {frames.map((f, i) => (
                  <div key={f.index ?? i} className="dossier-frame-card">
                    <div className="df-img-wrap">
                      <img src={f.url} alt={f.phase} />
                      <span className="df-offset">{f.offset_sec >= 0 ? `+${f.offset_sec}` : f.offset_sec}s</span>
                    </div>
                    <div className="df-content">
                      <div className="df-top">
                        <strong>#{i + 1} {f.phase}</strong>
                        <em>{f.video_ts_text}</em>
                      </div>
                      {f.entities?.length > 0 && (
                        <span className="df-entities">Entities: {f.entities.join(", ")}</span>
                      )}
                      <p className="df-obs">{f.observation}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Scene & Kinematic Assessment */}
          <section className="dossier-sec">
            <h3>3. Scene & Kinematic Dynamics</h3>
            <dl className="facts-grid">
              <dt>Camera</dt><dd>{inc.camera_name} ({inc.camera_id})</dd>
              <dt>Video Timestamp</dt><dd>{inc.video_ts_text}</dd>
              <dt>Logged At</dt><dd>{new Date(inc.detected_at).toLocaleString()}</dd>
              <dt>Confidence</dt><dd>{Math.round(inc.confidence * 100)}% (Vision & Rule Detector)</dd>
              <dt>Entities In Scene</dt><dd>{scene.detected_actors || "Persons / Vehicles"}</dd>
              <dt>Monitoring Zone</dt><dd>{scene.monitoring_zone || "Main Surveillance Perimeter"}</dd>
              <dt>Kinematics</dt><dd>{scene.kinematics || "Abrupt acceleration divergence and envelope transition"}</dd>
              <dt>Root Cause</dt><dd>{inc.root_cause_analysis || inc.observation}</dd>
            </dl>
          </section>

          {/* Threat & Impact Assessment */}
          <section className="dossier-sec">
            <h3>4. Threat Level & Impact Evaluation</h3>
            <div className="threat-cards">
              <div className="threat-card">
                <strong>Injury Risk</strong>
                <span>{impact.injury_risk || "Potential physical distress or trauma"}</span>
              </div>
              <div className="threat-card">
                <strong>Disruption Risk</strong>
                <span>{impact.disruption_risk || "Lane obstruction or unauthorized access"}</span>
              </div>
              <div className="threat-card">
                <strong>Containment Urgency</strong>
                <span>{impact.containment_urgency || "Operator verification required within 60s"}</span>
              </div>
            </div>
          </section>

          {/* Standard Operating Procedure (SOP) Checklist */}
          <section className="dossier-sec">
            <h3>5. Standard Operating Procedure (SOP) Directives</h3>
            <ul className="sop-checklist">
              {(inc.procedure || []).map((step, idx) => (
                <li key={idx} onClick={() => toggleStep(idx)}>
                  <input type="checkbox" checked={!!checkedSteps[idx]} onChange={() => toggleStep(idx)} />
                  <span className={checkedSteps[idx] ? "step-done" : ""}>{step}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Operator Sign-off Notes */}
          <section className="dossier-sec">
            <h3>6. Operator Log & Sign-Off</h3>
            <label className="op-notes-label">
              Operator Observations & Action Notes
              <textarea
                rows={2}
                value={draft.operator_notes}
                onChange={set("operator_notes")}
                placeholder="Add verification notes, badge ID, or on-site dispatch status..."
              />
            </label>
            {dirty && (
              <button className="btn btn-sm btn-primary mt-8" onClick={() => patchIncident(inc.id, draft)}>
                Save Notes
              </button>
            )}
          </section>
        </div>
      )}

      {/* Verification Actions */}
      <div className="actions">
        <button
          className="btn btn-primary"
          disabled={inc.status === "verified" || inc.status === "resolved"}
          onClick={() => patchIncident(inc.id, { status: "verified" })}
        >
          Verify Incident
        </button>
        <button
          className="btn"
          disabled={inc.status === "rejected"}
          onClick={() => patchIncident(inc.id, { status: "rejected" })}
        >
          Reject as False Alarm
        </button>
        <button
          className="btn"
          disabled={inc.status === "resolved"}
          onClick={() => patchIncident(inc.id, { status: "resolved" })}
        >
          Mark Resolved
        </button>
      </div>

      {inc.similar_incidents?.length > 0 && (
        <details className="mt-8">
          <summary>Similar verified incidents ({inc.similar_incidents.length})</summary>
          <ul className="plain">
            {inc.similar_incidents.map((s) => (
              <li key={s.id}>{s.id} · {s.camera_name} · {s.video_ts_text}</li>
            ))}
          </ul>
        </details>
      )}

      <details className="mt-8">
        <summary>Audit Trail ({inc.audit?.length || 0} events)</summary>
        <ul className="plain">
          {(inc.audit || []).map((a, i) => (
            <li key={i}>{new Date(a.at).toLocaleTimeString()} · {a.actor} · {a.action}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
