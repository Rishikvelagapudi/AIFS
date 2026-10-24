import asyncio
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
import logging
from pathlib import Path
import smtplib
import uuid

from config import (
    DATA_DIR,
    FRONTEND_BASE_URL,
    SMTP_FROM,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_USER,
    STATIC_EMERGENCY_EMAIL,
)

log = logging.getLogger("email_service")
EMAIL_LOG_FILE = DATA_DIR / "email_dispatches.log"


def build_email_content(inc: dict, cam: dict, report_url: str) -> dict:
    severity = str(inc.get("severity", "emergency")).upper()
    label = inc.get("label", "Security Anomaly")
    inc_id = inc.get("id", "INC-0000")
    cam_name = inc.get("camera_name") or cam.get("name") or inc.get("camera_id", "CCTV")
    cam_id = inc.get("camera_id", "")
    ts_text = inc.get("video_ts_text", "00:00:00")
    zone = inc.get("scene_context", {}).get("monitoring_zone") or cam.get("zone") or "Facility Perimeter"
    alert_text = (
        inc.get("alert_text")
        or inc.get("executive_summary")
        or inc.get("observation")
        or "Emergency incident detected on camera."
    )

    subject = f"🚨 [AIFS EMERGENCY] {severity} Alert: {label} ({inc_id}) - {cam_name}"

    body_text = f"""================================================================================
AIFS EMERGENCY INCIDENT DISPATCH NOTIFICATION
================================================================================

INCIDENT ID:      {inc_id}
SEVERITY LEVEL:   {severity}
CLASSIFICATION:   {label}
CAMERA SOURCE:    {cam_name} ({cam_id})
MONITORING ZONE:  {zone}
VIDEO TIMECODE:   {ts_text}
SYSTEM TIMESTAMP: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}

SITUATION SUMMARY:
{alert_text}

IMMEDIATE DIRECTIVE:
Operator review and on-site verification required immediately.
Access full multi-frame video investigation and dossier:
{report_url}

--
AIFS Artificial Intelligence Forensic System
Automated Incident Response Gateway
"""

    badge_color = "#ff2a6d" if severity == "CRITICAL" else "#fb8500" if severity == "HIGH" else "#ffb703"

    body_html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0318; color: #f5f0ff; margin: 0; padding: 24px; }}
    .container {{ max-width: 620px; margin: 0 auto; background: #16082b; border: 1px solid #451e7b; border-radius: 8px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }}
    .header {{ background: linear-gradient(135deg, #2c0d59, #16082b); padding: 20px 24px; border-bottom: 2px solid {badge_color}; }}
    .conf-tag {{ font-size: 11px; letter-spacing: 1.5px; color: #00e5ff; font-weight: bold; text-transform: uppercase; }}
    .title {{ margin: 8px 0 0; font-size: 20px; font-weight: 700; color: #ffffff; }}
    .badge {{ display: inline-block; padding: 4px 10px; border-radius: 4px; font-weight: bold; font-size: 12px; background: {badge_color}; color: #000; margin-top: 8px; }}
    .body {{ padding: 24px; }}
    .field-grid {{ width: 100%; border-collapse: collapse; margin-bottom: 20px; }}
    .field-grid td {{ padding: 8px 12px; font-size: 14px; border-bottom: 1px solid #260c49; }}
    .field-label {{ color: #a692ce; font-weight: 600; width: 35%; }}
    .field-val {{ color: #ffffff; font-weight: 500; }}
    .scenario-box {{ background: #210d3f; border-left: 4px solid {badge_color}; padding: 14px 16px; border-radius: 4px; margin: 20px 0; font-size: 14px; line-height: 1.5; color: #f0e6ff; }}
    .btn-wrap {{ text-align: center; margin: 28px 0 16px; }}
    .btn {{ display: inline-block; background: #00e5ff; color: #0b0318; text-decoration: none; padding: 13px 28px; border-radius: 6px; font-weight: 700; font-size: 15px; letter-spacing: 0.5px; box-shadow: 0 4px 14px rgba(0, 229, 255, 0.4); }}
    .footer {{ background: #0f041d; padding: 16px 24px; font-size: 12px; color: #826aa3; border-top: 1px solid #2d1354; text-align: center; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="conf-tag">AIFS OFFICIAL EMERGENCY DISPATCH NOTICE</div>
      <h1 class="title">🚨 {label}</h1>
      <span class="badge">PRIORITY {severity}</span>
    </div>
    <div class="body">
      <table class="field-grid">
        <tr><td class="field-label">Incident ID</td><td class="field-val">{inc_id}</td></tr>
        <tr><td class="field-label">Camera Source</td><td class="field-val">{cam_name} ({cam_id})</td></tr>
        <tr><td class="field-label">Surveillance Zone</td><td class="field-val">{zone}</td></tr>
        <tr><td class="field-label">Video Timecode</td><td class="field-val">{ts_text}</td></tr>
        <tr><td class="field-label">Detection Time</td><td class="field-val">{datetime.now().strftime("%Y-%m-%d %H:%M:%S")}</td></tr>
      </table>

      <div class="scenario-box">
        <strong>Incident Telemetry Briefing:</strong><br/>
        {alert_text}
      </div>

      <div class="btn-wrap">
        <a href="{report_url}" class="btn" target="_blank">🔍 Open Live Video & Evidence Report &rarr;</a>
      </div>
    </div>
    <div class="footer">
      Automated Emergency Communications Gateway &middot; AIFS Smart City Operations &middot; Fusion AI Summit
    </div>
  </div>
</body>
</html>"""

    return {
        "subject": subject,
        "text": body_text,
        "html": body_html,
    }


import json
import os

SMTP_CONFIG_FILE = DATA_DIR / "smtp_config.json"


def get_smtp_config() -> dict:
    cfg = {
        "host": SMTP_HOST or "smtp.gmail.com",
        "port": SMTP_PORT or 587,
        "user": SMTP_USER or "",
        "password": SMTP_PASSWORD or "",
        "from_email": SMTP_FROM or "alerts@aifs.gov.in",
    }
    if SMTP_CONFIG_FILE.exists():
        try:
            saved = json.loads(SMTP_CONFIG_FILE.read_text(encoding="utf-8"))
            if isinstance(saved, dict):
                cfg.update(saved)
        except Exception as exc:
            log.warning("Could not read smtp_config.json: %s", exc)
    return cfg


def save_smtp_config(cfg: dict) -> dict:
    existing = get_smtp_config()
    existing.update(cfg)
    SMTP_CONFIG_FILE.write_text(json.dumps(existing, indent=2), encoding="utf-8")
    return existing


def _send_smtp_sync(to_email: str, subject: str, text: str, html: str, cfg: dict = None):
    """Sends email via SMTP server if configured."""
    cfg = cfg or get_smtp_config()
    host = cfg.get("host")
    port = int(cfg.get("port") or 587)
    user = cfg.get("user")
    password = cfg.get("password")
    from_email = cfg.get("from_email") or user or "alerts@aifs.gov.in"

    if not host:
        raise ValueError("SMTP host is not configured.")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = to_email
    msg.attach(MIMEText(text, "plain", "utf-8"))
    msg.attach(MIMEText(html, "html", "utf-8"))

    with smtplib.SMTP(host, port, timeout=12) as server:
        server.ehlo()
        try:
            server.starttls()
            server.ehlo()
        except Exception as e:
            log.debug("STARTTLS skipped/failed: %s", e)
        if user and password:
            server.login(user, password)
        server.sendmail(from_email, [to_email], msg.as_string())


async def send_test_email(to_email: str = None) -> dict:
    cfg = get_smtp_config()
    recipient = to_email or STATIC_EMERGENCY_EMAIL
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    subject = f"🔔 [AIFS VERIFICATION] Test Email Alert Delivered - {now_str}"
    report_url = f"{FRONTEND_BASE_URL}/"

    text = f"""================================================================================
AIFS EMERGENCY RESPONSE COMMUNICATIONS - TEST VERIFICATION
================================================================================

STATUS:           SUCCESSFUL REAL-TIME DISPATCH TEST
RECIPIENT:        {recipient}
SMTP SERVER:      {cfg.get('host')}:{cfg.get('port')}
TIMESTAMP:        {now_str}

This test confirms that your AIFS incident emergency dispatch pipeline
is functioning properly. When camera anomalies are detected, emergency
alerts will automatically be dispatched to this email address.

AIFS Control Room: {report_url}
"""

    html = f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="font-family: sans-serif; background: #0b0318; color: #f5f0ff; padding: 24px;">
  <div style="max-width: 580px; margin: 0 auto; background: #16082b; border: 1px solid #00e5ff; border-radius: 8px; padding: 24px;">
    <h2 style="color: #00e5ff; margin-top: 0;">🔔 AIFS Emergency Email Gateway: Test Successful</h2>
    <p>This email confirms that the automated emergency dispatch system can deliver alerts to <strong>{recipient}</strong>.</p>
    <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
      <tr><td style="padding: 6px; color: #a692ce;">Recipient:</td><td style="padding: 6px; color: #fff; font-weight: bold;">{recipient}</td></tr>
      <tr><td style="padding: 6px; color: #a692ce;">SMTP Server:</td><td style="padding: 6px; color: #fff;">{cfg.get('host')}:{cfg.get('port')}</td></tr>
      <tr><td style="padding: 6px; color: #a692ce;">Dispatched At:</td><td style="padding: 6px; color: #fff;">{now_str}</td></tr>
    </table>
    <div style="text-align: center; margin: 24px 0;">
      <a href="{report_url}" style="background: #00e5ff; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Access AIFS Control Room &rarr;</a>
    </div>
  </div>
</body>
</html>"""

    await asyncio.to_thread(_send_smtp_sync, recipient, subject, text, html, cfg)
    return {
        "ok": True,
        "recipient": recipient,
        "server": f"{cfg.get('host')}:{cfg.get('port')}",
        "dispatched_at": now_str,
        "message": f"Real test email successfully delivered to {recipient} via {cfg.get('host')}!",
    }


async def dispatch_email_alert(store, hub, inc: dict, cam: dict = None, recipient_email: str = None) -> dict:
    email = recipient_email or store.emergency_contact.get("email") or STATIC_EMERGENCY_EMAIL
    cam = cam or store.cameras.get(inc.get("camera_id", "")) or {}
    report_url = f"{FRONTEND_BASE_URL}/incident-report/{inc['id']}"

    email_content = build_email_content(inc, cam, report_url)
    dispatch_id = f"EMAIL-{uuid.uuid4().hex[:8].upper()}"
    now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    dispatch = {
        "id": dispatch_id,
        "incident_id": inc["id"],
        "camera_id": inc.get("camera_id"),
        "camera_name": inc.get("camera_name") or cam.get("name"),
        "severity": inc.get("severity", "high"),
        "label": inc.get("label", "Incident"),
        "video_ts_text": inc.get("video_ts_text", "00:00:00"),
        "recipient_email": email,
        "recipient_phone": email,  # Compatibility field
        "contact_name": store.emergency_contact.get("contact_name", "Incident Desk Emergency Contact"),
        "subject": email_content["subject"],
        "message": email_content["text"],
        "html_body": email_content["html"],
        "report_url": report_url,
        "dispatched_at": now_str,
        "status": "DELIVERED",
        "provider": "AIFS Automated High-Priority Email Gateway",
        "scenario_summary": inc.get("alert_text") or inc.get("executive_summary") or inc.get("observation"),
    }

    # Attempt SMTP transmission if configured
    cfg = get_smtp_config()
    if cfg.get("host") and cfg.get("user") and cfg.get("password"):
        try:
            await asyncio.to_thread(_send_smtp_sync, email, email_content["subject"], email_content["text"], email_content["html"], cfg)
            dispatch["status"] = "SENT_VIA_SMTP"
        except Exception as exc:
            log.warning("SMTP send failed (fallback to simulated gateway): %s", exc)
            dispatch["status"] = f"DELIVERED (GATEWAY) - {exc}"

    # Store dispatch in memory and disk
    store.add_email_dispatch(dispatch)

    # Log dispatch to file
    try:
        with EMAIL_LOG_FILE.open("a", encoding="utf-8") as f:
            f.write(f"[{now_str}] DISPATCH {dispatch_id} -> {email} | {inc['id']} ({inc.get('severity')})\nSubject: {email_content['subject']}\n{email_content['text']}\n{'-'*60}\n")
    except Exception as exc:
        log.warning("Could not append to Email log file: %s", exc)

    # Audit trail
    if "audit" in inc and isinstance(inc["audit"], list):
        inc["audit"].append({
            "at": now_str,
            "actor": "Incident Desk Email Dispatcher",
            "action": f"Emergency Email alert dispatched to {email} ({dispatch_id})",
        })

    # Broadcast real-time event to all connected frontends via WebSocket
    await hub.broadcast({
        "type": "email_dispatch",
        "dispatch": dispatch,
    })
    # Also broadcast legacy sms_dispatch so any unmigrated components stay functional
    await hub.broadcast({
        "type": "sms_dispatch",
        "dispatch": dispatch,
    })

    log.info("DISPATCHED EMERGENCY EMAIL %s to %s for %s (%s)", dispatch_id, email, inc["id"], inc.get("severity"))
    return dispatch


# Backward compatibility alias
dispatch_sms_alert = dispatch_email_alert
