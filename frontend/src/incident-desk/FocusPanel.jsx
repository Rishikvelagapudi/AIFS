import { useEffect, useRef, useState } from "react";

export default function FocusPanel({ camera, incident }) {
  const ref = useRef(null);
  const [mode, setMode] = useState("video");
  const [selectedFrameIdx, setSelectedFrameIdx] = useState(2);
  const ts = incident?.video_ts;
  const frames = incident?.evidence_frames || [];

  useEffect(() => {
    setMode("video");
    const v = ref.current;
    if (!v || ts == null) return;
    const seek = () => {
      v.currentTime = Math.max(0, ts - 2);
      v.play().catch(() => {});
    };
    v.readyState >= 1 ? seek() : v.addEventListener("loadedmetadata", seek, { once: true });
    setSelectedFrameIdx(frames.length > 2 ? 2 : 0);
  }, [incident?.id, camera?.id]);

  if (!camera) return null;
  const sev = incident?.severity || "normal";
  const activeFrame = frames[selectedFrameIdx] || frames[0];
  const activeImgUrl = mode === "sequence" && activeFrame ? activeFrame.url : (incident?.evidence_url || camera.video_url);

  const seekVideoTo = (targetTs) => {
    setMode("video");
    const v = ref.current;
    if (v && targetTs != null) {
      v.currentTime = Math.max(0, targetTs);
      v.play().catch(() => {});
    }
  };

  return (
    <div className={`focus sev-${sev}`}>
      {incident && (
        <div className={`banner sev-${incident.severity}`}>
          <strong>{incident.severity} · {incident.camera_name} · {incident.video_ts_text}</strong>
          <span>{incident.alert_text}</span>
        </div>
      )}
      <div className="stage">
        {mode === "video" || !incident ? (
          <video ref={ref} src={camera.video_url} controls muted autoPlay playsInline />
        ) : (
          <div className="stage-evidence-wrap">
            <img src={activeImgUrl} alt={activeFrame?.phase || "Evidence"} />
            {mode === "sequence" && activeFrame && (
              <div className="stage-overlay-badge">
                <span className="badge-phase">PHASE #{selectedFrameIdx + 1}: {activeFrame.phase}</span>
                <span className="badge-offset">T{activeFrame.offset_sec >= 0 ? `+${activeFrame.offset_sec}` : activeFrame.offset_sec}s ({activeFrame.video_ts_text})</span>
                <span className="badge-obs">{activeFrame.observation}</span>
              </div>
            )}
          </div>
        )}
      </div>

      {incident && frames.length > 0 && (
        <div className="filmstrip-bar">
          <div className="filmstrip-label">
            <span>Evidence Frames Timeline (T-3.0s to T+3.0s)</span>
            {activeFrame && (
              <button className="btn btn-sm btn-seek" onClick={() => seekVideoTo(activeFrame.video_ts)}>
                Play Video from Frame ({activeFrame.video_ts_text})
              </button>
            )}
          </div>
          <div className="filmstrip-items">
            {frames.map((f, idx) => (
              <button
                key={f.index ?? idx}
                className={`filmstrip-card ${mode === "sequence" && selectedFrameIdx === idx ? "active" : ""}`}
                onClick={() => {
                  setSelectedFrameIdx(idx);
                  setMode("sequence");
                }}
              >
                <div className="thumb-wrap">
                  <img src={f.url} alt={f.phase} />
                  <span className="thumb-offset">{f.offset_sec >= 0 ? `+${f.offset_sec}` : f.offset_sec}s</span>
                </div>
                <div className="thumb-meta">
                  <strong>#{idx + 1} {f.phase}</strong>
                  <em>{f.video_ts_text}</em>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="focus-bar">
        <span>{camera.id} · {camera.name}</span>
        {incident && (
          <div className="seg">
            <button className={mode === "video" ? "on" : ""} onClick={() => setMode("video")}>Video</button>
            <button className={mode === "evidence" ? "on" : ""} onClick={() => setMode("evidence")}>Apex Frame</button>
            {frames.length > 0 && (
              <button className={mode === "sequence" ? "on" : ""} onClick={() => setMode("sequence")}>
                Multi-Frame Sequence ({frames.length})
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
