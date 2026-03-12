from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Core
    environment: str = "development"
    secret_key: str = "dev-secret-change-in-prod-32chars!!"
    log_level: str = "INFO"

    # Database
    database_url: str = (
        "postgresql+asyncpg://estate_scout:devpassword@localhost:5432/estate_scout"
    )

    # Redis
    redis_url: str = "redis://localhost:6379/0"

    # AI - optional; app gracefully degrades without these
    openai_api_key: str = ""
    openai_embedding_model: str = "text-embedding-3-small"
    openai_chat_model: str = "gpt-4o-mini"
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-opus-4-6"  # Opus 4.6 with adaptive thinking

    # Scraping
    proxy_urls: str = ""  # comma-separated: http://user:pass@host:port,...
    scraper_user_agent: str = (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    )
    requests_per_second_default: float = 0.5

    # Business rules
    free_tier_valuation_limit: int = 5
    pro_tier_valuation_limit: int = 50

    # Payments (optional)
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_pro_price_id: str = ""   # e.g. price_1Abc123...
    web_url: str = "http://localhost:3000"  # used for Stripe redirect URLs

    # Email (optional) — configure either Resend or SendGrid
    resend_api_key: str = ""        # preferred: https://resend.com
    sendgrid_api_key: str = ""      # fallback: https://sendgrid.com
    from_email: str = "noreply@estatescout.app"

    # Admin (optional — leave blank to disable admin endpoints)
    admin_secret_key: str = ""

    # CORS
    cors_origins: list[str] = [
        "http://localhost:3000",
        "http://localhost:8081",
        "http://127.0.0.1:3000",
    ]

    @property
    def proxy_url_list(self) -> list[str]:
        return [u.strip() for u in self.proxy_urls.split(",") if u.strip()]

    @property
    def ai_enabled(self) -> bool:
        return bool(self.openai_api_key) or bool(self.anthropic_api_key)

    @property
    def claude_enabled(self) -> bool:
        return bool(self.anthropic_api_key)


settings = Settings()
