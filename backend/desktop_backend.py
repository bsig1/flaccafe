from __future__ import annotations

import os

import uvicorn

from backend.app.main import app


def main() -> None:
    os.environ.setdefault("LOCAL_AUTODJ_PACKAGED", "1")
    port = int(os.environ.get("LOCAL_AUTODJ_PORT", "8765"))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="warning", access_log=False)


if __name__ == "__main__":
    main()
