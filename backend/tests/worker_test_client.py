from __future__ import annotations

import base64
import json
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import parse_qs, unquote, urlencode, urlsplit, urlunsplit

from backend.app.worker import dispatch
from backend.app.worker_types import to_jsonable


ROOT = Path(__file__).resolve().parents[2]
ROUTES_PATH = ROOT / "src-tauri" / "src" / "python_worker" / "routes.rs"
ROUTE_RE = re.compile(
    r'PythonRoute\s*\{\s*method:\s*"(?P<method>[^"]+)",\s*'
    r'template:\s*"(?P<template>[^"]+)",\s*'
    r'action:\s*"(?P<action>[^"]+)",\s*\}',
    re.S,
)


@dataclass(frozen=True)
class WorkerRoute:
    method: str
    template: str
    action: str

    def match(self, method: str, path: str) -> dict[str, Any] | None:
        if self.method != method:
            return None
        template_parts = [part for part in self.template.strip("/").split("/") if part]
        path_parts = [part for part in path.strip("/").split("/") if part]
        if len(template_parts) != len(path_parts):
            return None
        params: dict[str, Any] = {}
        for template_part, path_part in zip(template_parts, path_parts):
            if template_part.startswith("{") and template_part.endswith("}"):
                params[template_part[1:-1]] = unquote(path_part)
            elif template_part != path_part:
                return None
        return params


class ClientResponse:
    def __init__(
        self,
        status_code: int,
        body: Any,
        headers: dict[str, str] | None = None,
        reason: str = "",
        add_content_length: bool = True,
    ):
        self.status_code = status_code
        self.reason_phrase = reason or _reason_phrase(status_code)
        self.headers = {str(key).lower(): str(value) for key, value in (headers or {}).items()}
        if isinstance(body, bytes):
            self.content = body
        elif isinstance(body, str):
            self.content = body.encode("utf-8")
        else:
            self.content = json.dumps(to_jsonable(body), ensure_ascii=False).encode("utf-8")
            self.headers.setdefault("content-type", "application/json")
        if add_content_length:
            self.headers.setdefault("content-length", str(len(self.content)))

    @property
    def text(self) -> str:
        return self.content.decode("utf-8", errors="replace")

    def json(self) -> Any:
        return json.loads(self.content.decode("utf-8"))


class TestClient:
    """Tiny test client that uses Rust's Python worker route table as source of truth."""

    def __init__(self, raise_server_exceptions: bool = True):
        self.raise_server_exceptions = raise_server_exceptions
        self.routes = _load_routes()

    def __enter__(self) -> "TestClient":
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()

    def close(self) -> None:
        return None

    def request(
        self,
        method: str,
        url: str,
        json: Any = None,
        headers: dict[str, str] | None = None,
        params: dict[str, Any] | None = None,
        **_: Any,
    ) -> ClientResponse:
        del headers
        method = method.upper()
        url = _merge_params(url, params)
        parsed = urlsplit(url)
        path = _normalize_path(parsed.path or "/")
        query = _query_params(parsed.query)

        for route in self.routes:
            path_params = route.match(method, path)
            if path_params is None:
                continue
            action_params = {**path_params, **query}
            try:
                envelope = dispatch(
                    {
                        "action": route.action,
                        "params": action_params,
                        "body": json,
                        "metadata_only": method == "HEAD",
                    }
                )
            except Exception:
                if self.raise_server_exceptions:
                    raise
                return ClientResponse(500, {"detail": "Internal Server Error"})
            return _response_from_envelope(envelope, metadata_only=method == "HEAD")

        return ClientResponse(404, {"detail": "Not Found"})

    def get(self, url: str, **kwargs: Any) -> ClientResponse:
        return self.request("GET", url, **kwargs)

    def post(self, url: str, **kwargs: Any) -> ClientResponse:
        return self.request("POST", url, **kwargs)

    def patch(self, url: str, **kwargs: Any) -> ClientResponse:
        return self.request("PATCH", url, **kwargs)

    def delete(self, url: str, **kwargs: Any) -> ClientResponse:
        return self.request("DELETE", url, **kwargs)

    def head(self, url: str, **kwargs: Any) -> ClientResponse:
        return self.request("HEAD", url, **kwargs)


def _load_routes() -> list[WorkerRoute]:
    return [
        WorkerRoute(match.group("method"), match.group("template"), match.group("action"))
        for match in ROUTE_RE.finditer(ROUTES_PATH.read_text(encoding="utf-8"))
    ]


def _merge_params(url: str, params: dict[str, Any] | None) -> str:
    if not params:
        return url
    parsed = urlsplit(url)
    pairs: list[tuple[str, Any]] = []
    for key, value in params.items():
        if value is None:
            continue
        if isinstance(value, (list, tuple)):
            pairs.extend((key, item) for item in value)
        else:
            pairs.append((key, value))
    extra = urlencode(pairs, doseq=True)
    query = "&".join(part for part in [parsed.query, extra] if part)
    return urlunsplit((parsed.scheme, parsed.netloc, parsed.path, query, parsed.fragment))


def _normalize_path(path: str) -> str:
    normalized = path if path.startswith("/") else f"/{path}"
    return normalized.rstrip("/") if len(normalized) > 1 else normalized


def _query_params(query: str) -> dict[str, Any]:
    params: dict[str, Any] = {}
    for key, values in parse_qs(query, keep_blank_values=True).items():
        params[key] = values if len(values) > 1 else values[0]
    return params


def _response_from_envelope(envelope: dict[str, Any], metadata_only: bool = False) -> ClientResponse:
    status = int(envelope.get("code") or 500)
    headers = {str(key).lower(): str(value) for key, value in (envelope.get("headers") or {}).items()}
    if envelope.get("is_json", True):
        body = envelope.get("body")
    else:
        encoded = "" if metadata_only else str(envelope.get("body_base64") or "")
        body = base64.b64decode(encoded)
    return ClientResponse(
        status,
        body,
        headers=headers,
        reason=_reason_phrase(status),
        add_content_length=not bool(envelope.get("omit_content_length")),
    )


def _reason_phrase(status_code: int) -> str:
    return {
        200: "OK",
        204: "No Content",
        400: "Bad Request",
        404: "Not Found",
        409: "Conflict",
        422: "Unprocessable Entity",
        500: "Internal Server Error",
        502: "Bad Gateway",
    }.get(status_code, "")
