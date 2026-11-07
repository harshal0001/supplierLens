from types import SimpleNamespace as NS

import pytest

from app.api import voice
from app.errors import ProviderError


@pytest.fixture
def calls(monkeypatch):
    seen = []

    def fake_post(path, **kw):
        seen.append((path, kw))
        if path == "/v1/speech-to-text":
            return NS(json=lambda: {"text": "  Which supplier is riskiest?  ", "language_code": "en"})
        return NS(content=b"ID3fake-mp3")

    monkeypatch.setattr(voice, "_post", fake_post)
    monkeypatch.setattr(voice.settings, "elevenlabs_voice_id", "voice123")
    return seen


def test_transcribe(client, calls):
    r = client.post("/api/voice/transcribe", files={"audio": ("q.webm", b"\x1aE\xdf\xa3", "audio/webm;codecs=opus")},
                    data={"language": "de"})
    assert r.status_code == 200 and r.json() == {"text": "Which supplier is riskiest?"}
    path, kw = calls[0]
    assert kw["data"]["language_code"] == "de" and kw["files"]["file"][2] == "audio/webm"


@pytest.mark.parametrize("data,mime,status", [(b"x" * (10 * 1024 * 1024 + 1), "audio/webm", 413),
                                              (b"hello", "text/plain", 415), (b"", "audio/webm", 400)])
def test_transcribe_rejects(client, calls, data, mime, status):
    assert client.post("/api/voice/transcribe", files={"audio": ("a", data, mime)}).status_code == status
    assert calls == []  # nothing sent to the provider


def test_speak(client, calls):
    r = client.post("/api/voice/speak", json={"text": "Hello"})
    assert r.status_code == 200 and r.headers["content-type"] == "audio/mpeg" and r.content == b"ID3fake-mp3"
    path, kw = calls[0]
    assert path == "/v1/text-to-speech/voice123" and kw["json"]["text"] == "Hello"
    assert client.post("/api/voice/speak", json={"text": ""}).status_code == 422


def test_provider_error_is_502(client, monkeypatch):
    def boom(path, **kw):
        raise ProviderError("Voice service error (500)")

    monkeypatch.setattr(voice, "_post", boom)
    r = client.post("/api/voice/speak", json={"text": "Hello"})
    assert r.status_code == 502 and r.json()["error"]["code"] == "provider_error"


def test_retries_once_then_fails(monkeypatch):
    attempts = []

    def fake_httpx_post(url, **kw):
        attempts.append(url)
        return NS(status_code=503, text="busy")

    monkeypatch.setattr(voice.settings, "elevenlabs_api_key", "k")
    monkeypatch.setattr(voice.httpx, "post", fake_httpx_post)
    with pytest.raises(ProviderError):
        voice._post("/v1/speech-to-text")
    assert len(attempts) == 2


def test_validation_message_has_no_pydantic_prefix(client):
    msg = client.post("/api/suppliers", json={"name": "X", "country": "Germany"}).json()["error"]["message"]
    assert msg == "country: country must be a 2-letter ISO code"
