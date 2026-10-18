"""Minimal shared dependencies: optional bearer token and rate limiting."""

from __future__ import annotations

import time
from collections import defaultdict, deque

from fastapi import Header, Request

from app.core.config import get_settings
from app.core.errors import ApiError


async def require_token(authorization: str | None = Header(default=None)) -> None:
    """No-op for the local single-user prototype.

    When `FACERECALL_API_TOKEN` is set (e.g. the app is reachable from other
    machines) every API call must present it. This is a shared secret, not a
    multi-user account system -- see docs/threat-model.md.
    """
    expected = get_settings().api_token.strip()
    if not expected:
        return
    if not authorization or not authorization.lower().startswith("bearer "):
        raise ApiError(401, "unauthorized", "Authentication required.")
    if authorization.split(" ", 1)[1].strip() != expected:
        raise ApiError(401, "unauthorized", "Invalid API token.")


class RateLimiter:
    """In-memory fixed-window limiter, enabled only when configured.

    Deliberately simple: it protects a single local process, not a cluster.
    """

    def __init__(self, limit_per_minute: int) -> None:
        self.limit = limit_per_minute
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = time.monotonic()
        window = self._hits[key]
        while window and now - window[0] > 60:
            window.popleft()
        if len(window) >= self.limit:
            raise ApiError(429, "rate_limited", "Too many requests. Please wait a moment.")
        window.append(now)


_limiter = RateLimiter(get_settings().rate_limit_per_minute)


async def rate_limit_recognition(request: Request) -> None:
    settings = get_settings()
    if not settings.enable_rate_limit:
        return
    client = request.client.host if request.client else "unknown"
    _limiter.check(f"recognition:{client}")
