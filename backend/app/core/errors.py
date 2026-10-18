"""Consistent API error envelope.

Every error the API returns looks like:
    {"error": {"code": "not_found", "message": "...", "details": {...}}}
"""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

logger = logging.getLogger("facerecall.errors")


class ApiError(Exception):
    """Raised by services for expected, user-facing failures."""

    def __init__(
        self,
        status_code: int,
        code: str,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details or {}


def error_body(code: str, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    return {"error": {"code": code, "message": message, "details": details or {}}}


def install_error_handlers(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def _api_error(_: Request, exc: ApiError) -> JSONResponse:
        return JSONResponse(
            status_code=exc.status_code,
            content=error_body(exc.code, exc.message, exc.details),
        )

    @app.exception_handler(RequestValidationError)
    async def _validation_error(_: Request, exc: RequestValidationError) -> JSONResponse:
        fields = []
        for error in exc.errors():
            location = ".".join(str(part) for part in error.get("loc", ()) if part != "body")
            fields.append({"field": location or "body", "message": error.get("msg", "Invalid value")})
        return JSONResponse(
            status_code=422,
            content=error_body(
                "validation_error",
                "Some fields need attention.",
                {"fields": fields},
            ),
        )

    @app.exception_handler(StarletteHTTPException)
    async def _http_error(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        messages = {
            401: "Authentication required.",
            403: "You do not have access to this resource.",
            404: "The requested resource was not found.",
            405: "That method is not supported here.",
            413: "That file is too large.",
            415: "Unsupported file type.",
            429: "Too many requests. Please wait a moment.",
        }
        code = {
            401: "unauthorized",
            403: "forbidden",
            404: "not_found",
            405: "method_not_allowed",
            413: "file_too_large",
            415: "unsupported_media_type",
            429: "rate_limited",
        }.get(exc.status_code, "http_error")
        message = messages.get(exc.status_code, str(exc.detail) or "Request failed.")
        return JSONResponse(status_code=exc.status_code, content=error_body(code, message))

    @app.exception_handler(Exception)
    async def _unhandled(_: Request, exc: Exception) -> JSONResponse:
        # Never echo internals (paths, stack frames, biometric values) to clients.
        logger.exception("Unhandled error: %s", type(exc).__name__)
        return JSONResponse(
            status_code=500,
            content=error_body(
                "internal_error",
                "Something went wrong on the server. Please try again.",
            ),
        )
