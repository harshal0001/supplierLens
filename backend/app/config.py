from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent


class Settings(BaseSettings):
    # Root .env first, backend/.env overrides it.
    model_config = SettingsConfigDict(
        env_file=(REPO_DIR / ".env", BACKEND_DIR / ".env"), extra="ignore"
    )

    anthropic_api_key: str = ""
    llm_model: str = "claude-sonnet-5-5"
    llm_model_fast: str = "claude-haiku-5-5"
    exa_api_key: str = ""
    elevenlabs_api_key: str = ""
    elevenlabs_voice_id: str = ""
    elevenlabs_tts_model: str = "eleven_multilingual_v2"
    elevenlabs_stt_model: str = "scribe_v2"
    cors_origins: str = "http://localhost:3000"
    max_upload_mb: int = 20
    data_dir: Path = BACKEND_DIR / "data"

    @property
    def upload_dir(self) -> Path:
        return self.data_dir / "uploads"

    @property
    def database_url(self) -> str:
        return f"sqlite:///{self.data_dir / 'app.db'}"


settings = Settings()
