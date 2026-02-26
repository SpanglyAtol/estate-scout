# Estate Scout

Find estate sales and auctions across every platform in one search. AI-powered price checking for antiques and collectibles.

## Quick Start

### 1. Install prerequisites (one-time)

- **Docker Desktop**: https://docs.docker.com/desktop/install/windows-install/ (restart after install)
- Node.js 22 and Python 3.13 are already installed

### 2. Start the database and cache

```bash
cd estate-scout
docker compose up db redis -d
# Wait ~30 seconds, then verify:
docker compose ps
```

### 3. Set up the Python backend

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
source .venv/Scripts/activate  # Git Bash on Windows

# Install dependencies
pip install fastapi uvicorn[standard] sqlalchemy[asyncio] asyncpg alembic \
    pydantic-settings "redis[hiredis]" httpx beautifulsoup4 lxml \
    pgvector openai python-jose[cryptography] passlib[bcrypt] \
    python-multipart aiofiles

# Copy and configure environment
cp ../.env.example .env
# Edit .env if needed (DATABASE_URL is pre-configured for Docker)

# Run database migrations
DATABASE_URL="postgresql+asyncpg://estate_scout:devpassword@localhost:5432/estate_scout" \
  alembic upgrade head

# Start the API server
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

### 4. Run the web app

```bash
cd apps/web
cp .env.local.example .env.local
npm run dev
```

Web app: http://localhost:3000

### 5. Run the mobile app

```bash
cd apps/mobile
npx expo start
# Scan QR code with Expo Go app on your phone
```

### 6. Run a scraper (dry run first)

```bash
cd backend
source .venv/Scripts/activate

# Dry run: prints scraped listings without saving
python -m scrapers.run --target liveauctioneers --state WA --dry-run

# Real run: saves to DB
DATABASE_URL="postgresql+asyncpg://estate_scout:devpassword@localhost:5432/estate_scout" \
  python -m scrapers.run --target liveauctioneers --state WA --max-pages 3
```

## Project Structure

```
estate-scout/
├── docker-compose.yml        # PostgreSQL + pgvector + Redis
├── packages/
│   └── shared-types/         # TypeScript types for web + mobile
├── apps/
│   ├── web/                  # Next.js 14 web app
│   └── mobile/               # Expo React Native mobile app
└── backend/
    ├── app/                  # FastAPI application
    │   ├── models/           # SQLAlchemy ORM models
    │   ├── routers/          # API route handlers
    │   └── services/         # Business logic
    └── scrapers/             # Platform scrapers
        └── sources/          # LiveAuctioneers, EstateSales.NET, etc.
```

## Revenue Model

- **Free tier**: Basic search, 5 saved searches, 5 AI price checks/month, Google/Amazon ads
- **Pro ($19/mo)**: Unlimited searches, 50 AI checks, historical data, no ads
- **Premium ($79/mo)**: API access, market analytics, unlimited AI checks
- **Sponsored listings**: Estate sale companies pay to feature at top of relevant searches

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Web | Next.js 14, Tailwind CSS |
| Mobile | Expo (React Native) |
| Backend | FastAPI (Python) |
| Database | PostgreSQL 16 + pgvector |
| Cache | Redis 7 |
| AI | OpenAI text-embedding-3-small + GPT-4o-mini |
| Scrapers | httpx + BeautifulSoup4 |

## Adding an OpenAI API Key

The app works without an API key — valuation returns comparable sales with a template response.
To enable AI-powered narrative synthesis:

1. Add `OPENAI_API_KEY=your-key` to `backend/.env`
2. Restart the backend
3. Check `GET /health/ai` — should show `"ai_enabled": true`
