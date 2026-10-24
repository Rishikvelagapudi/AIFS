export default function CCTVGrid3x3({
  channels,
  camList,
  activeCamId,
  selectedIncidentId,
  queue,
  onPickCell,
  onInspectCell,
  onOpenReport,
  onUploadChannel,
  clockStr,
}) {
  return (
    <div className="cctv-grid-3x3">
      {channels.map((ch, idx) => {
        const cam = camList.find((c) => c.id === ch.id) || camList[idx] || null;
        const camIncidents = cam ? queue.filter((i) => i.camera_id === cam.id) : [];
        const topIncident = camIncidents[0] || null;
        const isActive = (cam && activeCamId === cam.id) || (!cam && activeCamId === ch.id);
        const hasCritical = topIncident?.severity === "critical";
        const hasHigh = topIncident?.severity === "high";

        return (
          <div
            key={ch.id}
            className={`cctv-cell ${isActive ? "cctv-cell-active" : ""} ${
              hasCritical ? "has-critical" : hasHigh ? "has-high" : ""
            } ${!cam ? "cctv-cell-standby" : ""}`}
            onClick={() => onPickCell(ch, cam, topIncident)}
          >
            {/* Corner HUD Reticles */}
            <span className="cctv-reticle cctv-reticle-tl" />
            <span className="cctv-reticle cctv-reticle-tr" />
            <span className="cctv-reticle cctv-reticle-bl" />
            <span className="cctv-reticle cctv-reticle-br" />

            {/* Scanline CRT overlay */}
            <div className="cctv-scanlines" />

            {/* Video or Standby Content */}
            {cam ? (
              <div className="cctv-video-wrap">
                <video
                  src={cam.video_url}
                  muted
                  autoPlay
                  loop
                  playsInline
                  preload="metadata"
                />
                {cam.status === "analyzing" && (
                  <div className="cctv-analyzing-bar">
                    <div
                      className="cctv-analyzing-progress"
                      style={{ width: `${Math.round(cam.progress * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="cctv-standby-screen">
                <div className="cctv-standby-grid-bg" />
                <div className="cctv-standby-center">
                  <div className="cctv-radar-pulse" />
                  <span className="cctv-standby-status">NO SIGNAL</span>
                  <span className="cctv-standby-sub">CAM STANDBY</span>
                  <label
                    className="cctv-connect-btn"
                    onClick={(e) => e.stopPropagation()}
                  >
                    + Connect Feed
                    <input
                      type="file"
                      accept="video/*"
                      hidden
                      onChange={(e) => onUploadChannel(e.target.files)}
                    />
                  </label>
                </div>
              </div>
            )}

            {/* Top OSD Bar */}
            <div className="cctv-cell-osd-top">
              <div className="cctv-cell-osd-left">
                <span className={`cctv-rec-dot ${cam ? "rec-active" : "rec-standby"}`}>●</span>
                <span className="cctv-rec-label">{cam ? "REC" : "STBY"}</span>
                <strong className="cctv-cam-tag">{ch.id}</strong>
                <span className="cctv-cam-name" title={cam?.name || ch.name}>
                  {cam?.name || ch.name}
                </span>
              </div>
              <div className="cctv-cell-osd-right">
                <span className="cctv-timecode">{clockStr}</span>
                <span className="cctv-fps">{ch.fps} FPS</span>
              </div>
            </div>

            {/* Center Reticle Crosshair */}
            <div className="cctv-crosshair">
              <div className="cctv-crosshair-h" />
              <div className="cctv-crosshair-v" />
            </div>

            {/* Bottom OSD Bar */}
            <div className="cctv-cell-osd-bottom">
              <div className="cctv-cell-osd-left">
                <span className="cctv-zone-tag">{ch.zone}</span>
                {topIncident && (
                  <span className={`cctv-alert-tag sev-${topIncident.severity}`}>
                    {topIncident.severity === "critical" ? "🚨 " : "⚠️ "}
                    {topIncident.label}
                  </span>
                )}
              </div>
              <div className="cctv-cell-osd-right">
                {cam && (
                  <>
                    <button
                      className="cctv-btn-report"
                      title="View Complete Report for this video"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenReport(ch, cam);
                      }}
                    >
                      📄 Report
                    </button>
                    <button
                      className="cctv-btn-inspect"
                      title="Enlarge in Focus Inspector"
                      onClick={(e) => {
                        e.stopPropagation();
                        onInspectCell(ch, cam, topIncident);
                      }}
                    >
                      🔍 Inspect
                    </button>
                  </>
                )}
                <span className="cctv-res-tag">{ch.res}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
