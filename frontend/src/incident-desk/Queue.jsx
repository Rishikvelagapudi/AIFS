import { STATUS_LABEL } from "./cctvChannels";

export function QueueItem({ i, selected, onPick, showSev }) {
  return (
    <li>
      <button className={`q ${showSev ? `sev-${i.severity}` : ""} ${selected === i.id ? "q-on" : ""}`} onClick={() => onPick(i)}>
        <strong>{i.label}</strong>
        <span>{i.camera_name} · {i.video_ts_text}</span>
        <em>{STATUS_LABEL[i.status]}</em>
      </button>
    </li>
  );
}

export default function Queue({ queue, closed, selected, onPick }) {
  return (
    <div className="panel">
      <h2>Incident queue</h2>
      {queue.length === 0 && <p className="muted">No open incidents. New ones appear here the moment a camera flags them.</p>}
      <ul className="queue">
        {queue.map((i) => <QueueItem key={i.id} i={i} selected={selected} onPick={onPick} showSev />)}
      </ul>
      {closed.length > 0 && (
        <details>
          <summary>{closed.length} closed</summary>
          <ul className="queue closed">
            {closed.map((i) => <QueueItem key={i.id} i={i} selected={selected} onPick={onPick} />)}
          </ul>
        </details>
      )}
    </div>
  );
}
