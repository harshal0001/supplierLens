"""Thin Claude wrapper: structured (tool-forced JSON → Pydantic) and plain text."""

import html
import logging
import re
from typing import TypeVar

import anthropic
from pydantic import BaseModel, ValidationError

from app.config import settings
from app.errors import ProviderError

log = logging.getLogger("supplierlens.llm")
T = TypeVar("T", bound=BaseModel)

_client: anthropic.Anthropic | None = None


def client() -> anthropic.Anthropic:
    global _client
    if _client is None:
        if not settings.anthropic_api_key:
            raise ProviderError("ANTHROPIC_API_KEY is not set")
        _client = anthropic.Anthropic(api_key=settings.anthropic_api_key, timeout=60, max_retries=2)
    return _client


def _create(**kw):
    try:
        msg = client().messages.create(**kw)
    except anthropic.APIError as e:
        raise ProviderError(f"LLM request failed: {getattr(e, 'message', e)}"[:300]) from e
    u = msg.usage
    log.info("llm model=%s in=%s out=%s", kw.get("model"), u.input_tokens, u.output_tokens)
    return msg


def structured(system: str, user: str, schema: type[T], *, model: str | None = None, max_tokens: int = 4096) -> T:
    tool = {"name": "submit", "description": f"Submit the {schema.__name__}.",
            "input_schema": schema.model_json_schema()}
    # Forced tool_choice is not supported by every model, so instruct + auto, and retry if it answers in text.
    system = f"{system}\n\nRespond ONLY by calling the `submit` tool exactly once."
    messages = [{"role": "user", "content": user}]
    for attempt in range(2):
        msg = _create(model=model or settings.llm_model, max_tokens=max_tokens, system=system, messages=messages,
                      tools=[tool], tool_choice={"type": "auto"})
        block = next((b for b in msg.content if b.type == "tool_use"), None)
        try:
            if block is None:
                raise ValueError("no tool call")
            return schema.model_validate(block.input)
        except (ValidationError, ValueError) as e:
            if attempt == 1:
                raise ProviderError(f"LLM returned invalid {schema.__name__}") from e
            messages.append({"role": "assistant", "content": msg.content})
            messages.append({"role": "user", "content": [{"type": "tool_result", "tool_use_id": block.id,
                                                          "is_error": True, "content": f"Invalid, fix and resubmit: {e}"}]}
                            if block else "Call the `submit` tool now with your answer.")
    raise AssertionError("unreachable")


def text(system: str, user: str, *, model: str | None = None, max_tokens: int = 1024) -> str:
    msg = _create(model=model or settings.llm_model, max_tokens=max_tokens, system=system,
                  messages=[{"role": "user", "content": user}])
    return "".join(b.text for b in msg.content if b.type == "text").strip()


_TAG = re.compile(r"<\s*/?\s*untrusted_document", re.IGNORECASE)


def fence(content: str) -> str:
    """Neutralise our delimiter inside untrusted text so it can't close <untrusted_document> early."""
    return _TAG.sub("[tag removed]", content or "")


def attr(value: str) -> str:
    """Untrusted value safe for an XML-ish attribute inside the prompt."""
    return html.escape(fence(value), quote=True)
