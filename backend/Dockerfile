FROM python:3.11-slim AS base
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

RUN pip install uv

COPY pyproject.toml .
RUN uv pip install --system -r pyproject.toml 2>/dev/null || pip install -e .

FROM base AS development
# Dev: source mounted as volume, hot-reload via uvicorn --reload
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

FROM base AS production
COPY . .
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
