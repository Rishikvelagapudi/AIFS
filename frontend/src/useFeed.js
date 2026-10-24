import { useEffect, useRef, useState } from "react";

const byId = (list) => Object.fromEntries((list || []).map((x) => [x.id, x]));

export function useFeed(onNewIncident, onEmailDispatch) {
  const [cameras, setCameras] = useState({});
  const [incidents, setIncidents] = useState({});
  const [emailDispatches, setEmailDispatches] = useState([]);
  const [emergencyContact, setEmergencyContact] = useState({
    email: "rishikvelagapudi@gmail.com",
    phone: "+91 9347137844",
    contact_name: "Emergency Command Desk",
    auto_email_enabled: true,
    auto_sms_enabled: true,
  });
  const [lastEmailDispatch, setLastEmailDispatch] = useState(null);
  const [online, setOnline] = useState(false);

  const incCb = useRef(onNewIncident);
  incCb.current = onNewIncident;

  const emailCb = useRef(onEmailDispatch);
  emailCb.current = onEmailDispatch;

  useEffect(() => {
    let ws, timer, stopped = false;
    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${location.host}/ws`);
      ws.onopen = () => setOnline(true);
      ws.onclose = () => {
        setOnline(false);
        if (!stopped) timer = setTimeout(connect, 1500);
      };
      ws.onmessage = (e) => {
        try {
          const m = JSON.parse(e.data);
          if (m.type === "snapshot") {
            setCameras(byId(m.cameras));
            setIncidents(byId(m.incidents));
            const dispatches = m.email_dispatches || m.sms_dispatches || [];
            if (Array.isArray(dispatches)) setEmailDispatches(dispatches);
            if (m.emergency_contact) setEmergencyContact(m.emergency_contact);
          } else if (m.type === "camera_update") {
            setCameras((c) => ({ ...c, [m.camera.id]: { ...m.camera } }));
          } else if (m.type === "incident_new") {
            setIncidents((i) => ({ ...i, [m.incident.id]: m.incident }));
            incCb.current?.(m.incident);
          } else if (m.type === "incident_update") {
            setIncidents((i) => ({ ...i, [m.incident.id]: { ...m.incident } }));
          } else if (m.type === "email_dispatch") {
            setEmailDispatches((prev) => [m.dispatch, ...prev.filter((d) => d.id !== m.dispatch.id)]);
            setLastEmailDispatch(m.dispatch);
            emailCb.current?.(m.dispatch);
          } else if (m.type === "sms_dispatch") {
            setEmailDispatches((prev) => [m.dispatch, ...prev.filter((d) => d.id !== m.dispatch.id)]);
            setLastEmailDispatch(m.dispatch);
            emailCb.current?.(m.dispatch);
          } else if (m.type === "emergency_contact_update") {
            if (m.emergency_contact) setEmergencyContact(m.emergency_contact);
          }
        } catch (err) {
          console.error("WS parse error:", err);
        }
      };
    };
    connect();
    return () => {
      stopped = true;
      clearTimeout(timer);
      ws && ws.close();
    };
  }, []);

  return {
    cameras,
    incidents,
    online,
    emailDispatches,
    emergencyContact,
    lastEmailDispatch,
    // Compatibility aliases
    smsDispatches: emailDispatches,
    lastSmsDispatch: lastEmailDispatch,
  };
}
