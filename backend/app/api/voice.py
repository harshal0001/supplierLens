"""Voice proxy (CONTRACT §4): ElevenLabs Speech-to-Text and Text-to-Speech. The API key never reaches the browser."""

import logging
from typing import Annotated

import httpx
from fastapi import APIRouter, Depends, File, Form, UploadFile
from fastapi.responses import Response
from pydantic import BaseModel, StringConstraints

from app.api.assistant import rate_limit
from app.config import settings
from app.errors import AppError, ProviderError

log = logging.getLogger("supplierlens.voice")
router = APIRouter(prefix="/api/voice", dependencies=[Depends(rate_limit)])

BASE = "https://api.elevenlabs.io"
MAX_AUDIO = 10 * 1024 * 1024
AUDIO_TYPES = {"audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav", "audio/x-wav", "audio/wave",
               "audio/aac", "audio/x-m4a", "video/webm", "video/mp4"}  # MediaRecorder sometimes labels audio as video/*


def _post(path: str, **kw) -> httpx.Response:
    if not settings.elevenlabs_api_key:
        raise ProviderError("ELEVENLABS_API_KEY is not set")
    for attempt in range(2):
        try:
            r = httpx.post(f"{BASE}{path}", headers={"xi-api-key": settings.elevenlabs_api_key}, timeout=60, **kw)
        except httpx.HTTPError as e:
            if attempt == 1:
                raise ProviderError(f"Voice service unreachable: {e.__class__.__name__}") from e
            continue
        if r.status_code < 400:
            return r
        if r.status_code in (429, 500, 502, 503, 504) and attempt == 0:
            continue
        log.warning("elevenlabs %s -> %s: %s", path, r.status_code, r.text[:300])
        raise ProviderError(f"Voice service error ({r.status_code})")
    raise AssertionError("unreachable")


@router.post("/transcribe")
def transcribe(audio: UploadFile = File(...), language: str | None = Form(None)):
    mime = (audio.content_type or "").split(";")[0].strip().lower()
    if mime not in AUDIO_TYPES:
        raise AppError(415, f"Unsupported audio type '{mime or 'unknown'}'")
    data = audio.file.read(MAX_AUDIO + 1)
    if len(data) > MAX_AUDIO:
        raise AppError(413, "Recording is larger than 10 MB")
    if not data:
        raise AppError(400, "Empty recording")
    form = {"model_id": settings.elevenlabs_stt_model}
    if language in ("de", "en"):
        form["language_code"] = language
    r = _post("/v1/speech-to-text", data=form, files={"file": (audio.filename or "audio", data, mime)})
    return {"text": (r.json().get("text") or "").strip()}


class SpeakBody(BaseModel):
    text: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=2000)]  # blank → 422, no paid call


@router.post("/speak", response_class=Response, responses={200: {"content": {"audio/mpeg": {}}}})
def speak(body: SpeakBody):
    if not settings.elevenlabs_voice_id:
        raise ProviderError("ELEVENLABS_VOICE_ID is not set")
    # shortcut: whole mp3 in one response (~1-3 s for a 120-word answer); switch to /stream if latency matters
    r = _post(f"/v1/text-to-speech/{settings.elevenlabs_voice_id}", params={"output_format": "mp3_44100_128"},
              json={"text": body.text, "model_id": settings.elevenlabs_tts_model})
    return Response(content=r.content, media_type="audio/mpeg")
