import time
from collections import defaultdict, deque

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app import schemas as s
from app.db import get_db
from app.errors import AppError
from app.services import assistant

router = APIRouter(prefix="/api")

_hits: dict[str, deque] = defaultdict(deque)


def rate_limit(request: Request, limit: int = 20, window: float = 60.0) -> None:
    """shortcut: per-process sliding window keyed by client IP; use Redis when running >1 instance."""
    now = time.monotonic()
    q = _hits[request.client.host if request.client else "?"]
    while q and now - q[0] > window:
        q.popleft()
    if len(q) >= limit:
        raise AppError(429, "Too many requests, wait a minute")
    q.append(now)


@router.post("/assistant/query", response_model=s.AssistantAnswer, dependencies=[Depends(rate_limit)])
def query(body: s.AssistantQuery, db: Session = Depends(get_db)):
    return assistant.answer(db, body)
