from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime
from pathlib import Path
from typing import Any

from pydantic import BaseModel


class ActionError(Exception):
    """Application error returned through the Rust-owned desktop API."""

    def __init__(self, status_code: int, detail: Any = None):
        super().__init__(str(detail))
        self.status_code = status_code
        self.detail = detail


@dataclass
class ActionParam:
    default: Any = ...
    ge: float | None = None
    le: float | None = None
    min_length: int | None = None
    max_length: int | None = None

    @property
    def required(self) -> bool:
        return self.default is ...


def Param(default: Any = ..., **kwargs: Any) -> ActionParam:
    return ActionParam(
        default=default,
        ge=kwargs.get("ge"),
        le=kwargs.get("le"),
        min_length=kwargs.get("min_length"),
        max_length=kwargs.get("max_length"),
    )


@dataclass
class WorkerContext:
    metadata_only: bool = False


class Response:
    def __init__(
        self,
        content: str | bytes | None = b"",
        status_code: int = 200,
        media_type: str | None = None,
        headers: dict[str, str] | None = None,
    ):
        self.status_code = status_code
        self.media_type = media_type or "text/plain"
        self.headers = {str(key).lower(): str(value) for key, value in (headers or {}).items()}
        if media_type:
            self.headers.setdefault("content-type", media_type)
        if content is None:
            self.body = b""
        elif isinstance(content, bytes):
            self.body = content
        else:
            self.body = content.encode("utf-8")
        self.omit_content_length = False


class FileResponse(Response):
    def __init__(
        self,
        path: str | Path,
        media_type: str | None = None,
        headers: dict[str, str] | None = None,
        filename: str | None = None,
        status_code: int = 200,
    ):
        self.path = str(path)
        self.filename = filename
        super().__init__(Path(path).read_bytes(), status_code=status_code, media_type=media_type, headers=headers)


class StreamingResponse(Response):
    def __init__(
        self,
        content: Any,
        media_type: str | None = None,
        headers: dict[str, str] | None = None,
        status_code: int = 200,
    ):
        chunks: list[bytes] = []
        for chunk in content:
            if isinstance(chunk, bytes):
                chunks.append(chunk)
            else:
                chunks.append(str(chunk).encode("utf-8"))
        super().__init__(b"".join(chunks), status_code=status_code, media_type=media_type, headers=headers)
        self.omit_content_length = True


def to_jsonable(value: Any) -> Any:
    if isinstance(value, BaseModel):
        return value.model_dump(mode="json")
    if isinstance(value, dict):
        return {str(key): to_jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [to_jsonable(item) for item in value]
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, BaseException):
        return str(value)
    return value
