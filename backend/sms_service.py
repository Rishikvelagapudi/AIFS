"""Backward compatibility shim: forwards all calls to email_service."""
from email_service import (  # noqa: F401
    build_email_content,
    dispatch_email_alert,
    dispatch_sms_alert,
)


def build_sms_message(inc: dict, cam: dict, report_url: str) -> str:
    return build_email_content(inc, cam, report_url)["text"]
