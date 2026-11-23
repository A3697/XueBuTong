"""Host lifecycle protection shared by enhanced and native Star modes.

Only an explicit displaced-session notice trips this guard. No undocumented
numeric status codes, ordinary login expiry, captcha or network failures are
interpreted as another-device login. No response contents leave this module.
"""
from __future__ import annotations

import json
import re
import threading
from urllib.parse import urlsplit

DOMAINS = {
    "chaoxing": ("chaoxing.com", "chaoxing.com.cn", "xuexitong.com"),
    "zhihuishu": ("zhihuishu.com",),
    "zjy": ("zjy2.icve.com.cn", "zjy.icve.com.cn"),
    "icve": ("icve.com.cn",),
    "icourse": ("icourse163.org",),
}
PATTERNS = [
    r"^(?:(?:系统|安全|温馨)?(?:提示|通知)[：:，, ]*)?(?:(?:尊敬的)?用户[，,:： ]*)?(?:您好[，,:： ]*)?(?:(?:您|你)(?:的)?|当前|此|本)?(?:账号|帐号|账户).{0,12}(?:(?:已|已经)(?:在|于)(?:另一|其他|其它|别的).{0,12}(?:设备|终端|电脑|客户端|地点).{0,8}(?:登录|登陆)|(?:已|已经)?被(?:挤|踢|顶)(?:掉|出)?下线)",
    r"^(?:您|你)(?:的账号|的帐号|的账户)?(?:已|已经)在(?:其他|其它|另一|别的).{0,8}(?:设备|终端|电脑|客户端)(?:上)?(?:登录|登陆)",
    r"^(?:当前|您|你)(?:的)?(?:登录|登陆|会话).{0,8}(?:已|已经)?被(?:其他|其它|另一|别的).{0,12}(?:登录|登陆|会话)(?:替换|终止|结束)",
    r"^(?:(?:notice|warning)\s*:\s*)?(?:your|this|the current) (?:account|session) (?:has been |was |is )(?:logged (?:in|on) (?:on|from) (?:an? )?(?:another|different|other) device|(?:replaced|terminated) (?:by|due to) another (?:login|session))",
]


def platform_of(url):
    try:
        host = (urlsplit(url).hostname or "").lower()
        return next((platform for platform, domains in DOMAINS.items()
                     if any(host == domain or host.endswith("." + domain)
                            for domain in domains)), None)
    except (TypeError, ValueError):
        return None


def displacement_message(value):
    if not isinstance(value, str) or len(value) > 500:
        return False
    text = " ".join(value.split())
    if re.search(r"[?？]|(?:如何|假如|如果|例如|示例|可能|防止|避免|若|(?:^|[，。；,;])当(?!前)).{0,35}(?:登录|登陆|下线)", text):
        return False
    return any(re.search(pattern, text, re.I) for pattern in PATTERNS)


def response_message(body, status=200):
    if isinstance(body, str):
        return body if status >= 400 and displacement_message(body) else None
    if not isinstance(body, dict):
        return None
    failed = (status >= 400 or any(body.get(key) is False for key in ("success", "result", "status", "ok"))
              or body.get("error") is True or isinstance(body.get("error"), str)
              or ("code" in body and body["code"] not in (0, 200, "0", "200", "SUCCESS", "success")))
    if not failed:
        return None
    values = [body.get(key) for key in ("message", "msg", "errorMessage", "error_description", "error")]
    for key in ("error", "data"):
        if isinstance(body.get(key), dict):
            values.extend(body[key].get(field) for field in ("message", "msg"))
    return next((value for value in values if displacement_message(value)), None)


class SessionDisplacedError(RuntimeError):
    def __init__(self):
        super().__init__("账号在其他设备登录，当前任务已停止；多次操作会导致账号风控。")


class SessionGuard:
    def __init__(self, emit, session_class, engine=None):
        self.emit = emit
        self.session_class = session_class
        self.original_send = session_class.send
        self._signal = None
        self._lock = threading.Lock()

        def guarded_send(session, request, **kwargs):
            url = getattr(request, "url", "")
            self.raise_if_displaced(url)
            response = self.original_send(session, request, **kwargs)
            if not kwargs.get("stream"):
                self.inspect_response(response)
            self.raise_if_displaced(url)
            return response

        self.wrapper = guarded_send
        session_class.send = guarded_send
        self.engine = engine
        self.original_payload = getattr(engine, "_session_payload", None)
        self.original_payload_in_instance = bool(engine and "_session_payload" in vars(engine))
        if callable(self.original_payload):
            def payload():
                result = self.original_payload()
                signal = self.snapshot()
                return dict(result, session_guard=signal) if signal and isinstance(result, dict) else result
            self.payload_wrapper = payload
            engine._session_payload = payload

    def snapshot(self):
        with self._lock:
            return dict(self._signal) if self._signal else None

    def raise_if_displaced(self, url):
        if self._signal and platform_of(url):
            raise SessionDisplacedError()

    def inspect_response(self, response):
        url = getattr(response, "url", "")
        platform = platform_of(url)
        if not platform or self._signal:
            return
        headers = getattr(response, "headers", {})
        content_type = headers.get("content-type", "").lower()
        if "json" not in content_type and not content_type.startswith("text/plain"):
            return
        try:
            if int(headers.get("content-length", 0)) > 65536:
                return
            raw = response.content
            if len(raw) > 65536:
                return
            text = response.text
            try:
                body = json.loads(text)
            except (ValueError, TypeError):
                body = text
            if not response_message(body, response.status_code):
                return
        except (ValueError, TypeError, AttributeError):
            return
        with self._lock:
            if self._signal:
                return
            self._signal = {"reason": "concurrent-login", "platform": platform, "source": "response"}
            signal = dict(self._signal)
        # Set the guard before delivery, including when the UI is reconnecting.
        try:
            self.emit({"type": "integration.session-displaced", "payload": signal})
        except Exception:
            # The polling session snapshot remains available to the host UI.
            pass
        raise SessionDisplacedError()

    def dispose(self):
        if self.session_class.send is self.wrapper:
            self.session_class.send = self.original_send
        if self.engine is not None and getattr(self.engine, "_session_payload", None) is getattr(self, "payload_wrapper", None):
            if self.original_payload_in_instance:
                self.engine._session_payload = self.original_payload
            else:
                del self.engine._session_payload


def install(emit, session_class=None, engine=None):
    if session_class is None:
        from requests import Session
        session_class = Session
    return SessionGuard(emit, session_class, engine)
