-- Run automatically on first container start (docker-entrypoint-initdb.d)
-- Enables required PostgreSQL extensions

CREATE EXTENSION IF NOT EXISTS vector;      -- pgvector: AI similarity search
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- fast LIKE/ILIKE and fuzzy search
CREATE EXTENSION IF NOT EXISTS unaccent;    -- normalize accented characters
