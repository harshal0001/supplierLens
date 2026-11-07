import logging

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

log = logging.getLogger("supplierlens")

_CODES = {400: "bad_request", 404: "not_found", 405: "method_not_allowed", 409: "conflict",
          413: "payload_too_large", 415: "unsupported_media_type", 422: "validation_error",
          429: "rate_limited", 502: "provider_error"}


class AppError(Exception):
    def __init__(self, status: int, message: str, code: str | None = None):
        self.status, self.message, self.code = status, message, code or _CODES.get(status, "error")


class ProviderError(AppError):
    def __init__(self, message: str):
        super().__init__(502, message, "provider_error")


def _resp(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse({"error": {"code": code, "message": message}}, status_code=status)


def install(app: FastAPI) -> None:
    @app.exception_handler(AppError)
    async def _app(_: Request, e: AppError):
        return _resp(e.status, e.code, e.message)

    @app.exception_handler(StarletteHTTPException)
    async def _http(_: Request, e: StarletteHTTPException):
        return _resp(e.status_code, _CODES.get(e.status_code, "error"), str(e.detail))

    @app.exception_handler(RequestValidationError)
    async def _val(_: Request, e: RequestValidationError):
        msg = "; ".join(f"{'.'.join(str(p) for p in err['loc'][1:])}: {err['msg']}" for err in e.errors())
        return _resp(422, "validation_error", msg or "invalid request")

    @app.exception_handler(Exception)
    async def _any(_: Request, e: Exception):
        log.exception("unhandled error")
        return _resp(500, "internal", "Internal server error")
