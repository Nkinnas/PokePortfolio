# PokePortfolio

A Pokémon TCG card portfolio tracker with price history, set browsing, and daily price updates powered by the Scrydex API.

## Features

- Browse Pokémon TCG sets and individual cards
- Track owned cards and quantities in a personal portfolio
- View ~28-day rolling price history per card (charted with Recharts)
- Portfolio total value tracked over time
- Daily automated price updates for every viewed card
- User authentication with session-based login

## Tech Stack

- **Frontend** — React 18 + TypeScript, Vite, TanStack React Query, Wouter, Tailwind CSS + shadcn/ui
- **Backend** — Express.js + TypeScript (tsx), Drizzle ORM, Passport (local strategy)
- **Database** — PostgreSQL (Neon serverless)
- **Data source** — [Scrydex API](https://api.scrydex.com/pokemon/v1)

## Getting Started

### Prerequisites

- Node.js 20+
- A PostgreSQL database (Neon recommended)
- A Scrydex API key and Team ID

### Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file in the project root:
   ```env
   DATABASE_URL=postgres://...
   SCRYDEX_API_KEY=your_api_key
   SCRYDEX_TEAM_ID=your_team_id
   SESSION_SECRET=some_long_random_string
   ```

3. Push the schema to your database:
   ```bash
   npm run db:push
   ```

4. Start the dev server (runs on port 5000):
   ```bash
   npm run dev
   ```

## Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server on port 5000 |
| `npm run build` | Build client and server for production |
| `npm run start` | Run the production build |
| `npm run check` | Type-check with `tsc` |
| `npm run db:push` | Push the Drizzle schema to the database |

## Project Structure

```
client/src/
  pages/         Home/Search, Sets, SetDetail, CardDetail, Portfolio
  components/    Reusable UI components
  lib/           AuthContext, PortfolioContext, query client
server/
  routes.ts      Express API routes
  pokemontcg.ts  Scrydex API client, price extraction, backfill
  priceTracker.ts  Daily cron job (1 PM Central)
  storage.ts     Drizzle DB operations
shared/
  schema.ts      DB schema + Zod validation
```

## How Price Tracking Works

- **On first view** of a card's price history, the server backfills ~28 days of daily prices from Scrydex's `/cards/{id}/price_history` endpoint (3 API credits).
- **Daily cron** runs at 1 PM America/Chicago and records today's price for every card anyone has ever viewed (batched 100 at a time, 1 credit per batch).
- **Portfolio totals** are recomputed on every add/remove/quantity change and on each daily run.
- Card price history is deleted when the last user removes a card from their portfolio (only if no one else owns it).

## Caching

- **Server in-memory** — 14-day TTL for expansion lists and expansion card lists
- **Database** — `cards` table permanently caches name, image, and latest price per card
- **Client** — React Query caches sets/expansions for 7 days, price charts for 5 minutes

## Notes

- All timestamps are stored and compared in UTC. The cron's `America/Chicago` timezone only controls *when* it fires.
- The package uses `"type": "module"`, so CommonJS scripts must use `.cjs`.
