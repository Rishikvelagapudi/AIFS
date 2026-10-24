export async function patchIncident(id, body) {
  const r = await fetch(`/api/incidents/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error((await r.json()).detail || "Update failed");
  return await r.json();
}

export async function deepInvestigate(id) {
  const r = await fetch(`/api/incidents/${id}/deep-investigate`, {
    method: "POST",
  });
  if (!r.ok) throw new Error((await r.json()).detail || "Deep investigation failed");
  return await r.json();
}

export async function getIncident(id) {
  const r = await fetch(`/api/incidents/${id}`);
  if (!r.ok) throw new Error((await r.json()).detail || "Failed to load incident");
  return await r.json();
}

export async function getFullReport(id) {
  const r = await fetch(`/api/incidents/${id}/full-report`);
  if (!r.ok) throw new Error((await r.json()).detail || "Failed to load full report");
  return await r.json();
}

export async function sendIncidentEmail(id, email = null) {
  const r = await fetch(`/api/incidents/${id}/send-email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(email ? { email } : {}),
  });
  if (!r.ok) throw new Error((await r.json()).detail || "Failed to dispatch email");
  return await r.json();
}

export async function getEmailDispatches() {
  const r = await fetch("/api/email-dispatches");
  if (!r.ok) throw new Error((await r.json()).detail || "Failed to load email dispatches");
  return await r.json();
}

export async function sendIncidentSms(id, target = null) {
  return await sendIncidentEmail(id, target);
}

export async function getSmsDispatches() {
  return await getEmailDispatches();
}

export async function getEmergencyContact() {
  const r = await fetch("/api/emergency-contact");
  if (!r.ok) throw new Error((await r.json()).detail || "Failed to load emergency contact");
  return await r.json();
}

export async function updateEmergencyContact(body) {
  const r = await fetch("/api/emergency-contact", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error((await r.json()).detail || "Failed to update emergency contact");
  return await r.json();
}

export async function upload(files) {
  const fd = new FormData();
  [...files].forEach((f) => fd.append("files", f));
  const r = await fetch("/api/upload", { method: "POST", body: fd });
  if (!r.ok) throw new Error((await r.json()).detail || "Upload failed");
  return await r.json();
}

export function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

export async function getSmtpConfig() {
  const r = await fetch("/api/smtp-config");
  if (!r.ok) throw new Error((await r.json()).detail || "Failed to load SMTP settings");
  return await r.json();
}

export async function updateSmtpConfig(body) {
  const r = await fetch("/api/smtp-config", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error((await r.json()).detail || "Failed to update SMTP settings");
  return await r.json();
}

export async function sendTestEmail(email = null) {
  const r = await fetch("/api/test-email", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(email ? { email } : {}),
  });
  if (!r.ok) throw new Error((await r.json()).detail || "Failed to dispatch test email");
  return await r.json();
}

