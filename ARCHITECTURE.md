# Architecture

## Overview

```mermaid
flowchart LR
    Client[React Client] <--> Server[Express Server]
    Server <--> DB[(Postgres)]
    Server <--> API[Scrydex API]
    Cron[Daily Cron] --> Server
```

- **Client** — React + Vite, talks to the server over REST
- **Server** — Express, handles auth, 3-tier cache, proxies the Scrydex API
- **Postgres** — stores users, portfolios, and price history
- **Scrydex** — external Pokémon TCG data + prices
- **Cron** — runs daily at 1 PM CT to record prices

## Price Flow

```mermaid
flowchart TD
    A[User views card] --> B{Price history<br/>in DB?}
    B -->|yes| C[Return chart]
    B -->|no| D[Backfill 28 days<br/>from Scrydex]
    D --> C
    E[Daily cron] --> F[Add today's price<br/>for every cached card]
```

First view seeds the history; the cron grows it forever.
