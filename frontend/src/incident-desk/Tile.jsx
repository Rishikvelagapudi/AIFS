import { useState } from "react";

export function Tile({ cam, active, onClick }) {
  const state = { analyzing: "Analysing", complete: "Analysis complete", error: "Error", queued: "Queued" }[cam.status];
  return (
    <button className={`tile sev-${cam.severity} ${active ? "tile-active" : ""}`} onClick={onClick}>
      <video src={cam.video_url} muted autoPlay playsInline preload="metadata" />
      <div className="tile-top">
        <strong>{cam.id}</strong>
        <span>{cam.name}</span>
        {cam.incident_count > 0 && <em className={`badge sev-${cam.severity}`}>{cam.incident_count}</em>}
      </div>
      <div className="tile-bottom">
        <span>{state}</span>
        <div className="progress">
          <div style={{ width: `${Math.round(cam.progress * 100)}%` }} />
        </div>
      </div>
    </button>
  );
}

export function Dropzone({ onFiles }) {
  const [over, setOver] = useState(false);
  return (
    <div
      className={over ? "drop drop-over" : "drop"}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onFiles(e.dataTransfer.files);
      }}
    >
      <h2>Drop CCTV videos here</h2>
      <p>Each video becomes a camera with its own analysis task. Incidents appear as soon as a segment is analysed, without waiting for the other cameras.</p>
      <label className="btn btn-primary">
        Choose videos
        <input type="file" accept="video/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
      </label>
    </div>
  );
}
