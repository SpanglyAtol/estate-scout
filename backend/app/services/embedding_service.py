import hashlib
import logging

from app.config import settings

logger = logging.getLogger(__name__)


class EmbeddingService:
    """
    OpenAI embeddings with graceful degradation.
    If no API key is configured, embed_text returns None and the
    valuation service falls back to full-text search.
    """

    def __init__(self):
        self._client = None
        if settings.openai_api_key:
            try:
                from openai import AsyncOpenAI

                self._client = AsyncOpenAI(api_key=settings.openai_api_key)
                logger.info("OpenAI embedding client initialized")
            except ImportError:
                logger.warning("openai package not installed; AI features disabled")

    @property
    def is_available(self) -> bool:
        return self._client is not None

    @staticmethod
    def text_hash(text: str) -> str:
        return hashlib.sha256(text.lower().strip().encode()).hexdigest()

    async def embed_text(self, text: str) -> list[float] | None:
        """Returns embedding vector or None if unavailable."""
        if not self._client:
            return None
        try:
            response = await self._client.embeddings.create(
                model=settings.openai_embedding_model,
                input=text[:8191],  # token limit guard
            )
            return response.data[0].embedding
        except Exception as e:
            logger.error(f"Embedding request failed: {e}")
            return None

    async def embed_batch(self, texts: list[str]) -> list[list[float] | None]:
        if not self._client:
            return [None] * len(texts)
        try:
            response = await self._client.embeddings.create(
                model=settings.openai_embedding_model,
                input=[t[:8191] for t in texts],
            )
            return [item.embedding for item in sorted(response.data, key=lambda x: x.index)]
        except Exception as e:
            logger.error(f"Batch embedding request failed: {e}")
            return [None] * len(texts)
