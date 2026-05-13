# Architecture

## System Overview

```mermaid
flowchart LR
    User([User Browser])

    subgraph Client["Client — React + Vite"]
        Pages["Pages<br/>Search · Sets · CardDetail · Portfolio"]
        RQ["React Query<br/>cache: 7d sets / 5m charts"]
        Ctx["Contexts<br/>Auth · Portfolio"]
    end

    subgraph Server["Server — Express + tsx"]
        Routes["routes.ts<br/>REST endpoints"]
        Auth["Passport<br/>session auth"]
        MemCache["In-memory cache<br/>14-day TTL"]
        Scrydex["pokemontcg.ts<br/>Scrydex client"]
        Cron["priceTracker.ts<br/>daily cron @ 1pm CT"]
        Storage["storage.ts<br/>Drizzle ORM"]
    end

    subgraph DB["PostgreSQL — Neon"]
        Users[(users)]
        Cards[(cards<br/>permanent cache)]
        Portfolio[(portfolio_cards)]
        CardHist[(card_price_history)]
        PortHist[(portfolio_value_history)]
        Sessions[(sessions)]
    end

    ScrydexAPI([Scrydex API])

    User <--> Pages
    Pages <--> RQ
    Pages <--> Ctx
    RQ <-->|fetch| Routes
    Ctx <--> Routes
    Routes --> Auth
    Routes --> MemCache
    Routes --> Scrydex
    Routes --> Storage
    Cron --> Scrydex
    Cron --> Storage
    Scrydex -.->|miss| ScrydexAPI
    Storage <--> DB
    Auth <--> Sessions
```

## Read Path — Viewing a Card

```mermaid
sequenceDiagram
    participant U as User
    participant C as Client (React Query)
    participant S as Server
    participant M as Mem Cache
    participant DB as Postgres
    participant API as Scrydex

    U->>C: open CardDetail
    C->>S: GET /api/cards/:id
    S->>M: lookup
    alt cache hit
        M-->>S: card
    else miss
        S->>API: GET /cards/:id (1 credit)
        API-->>S: card
        S->>M: store (14d TTL)
        S->>DB: upsert into cards
    end
    S-->>C: card payload
    C-->>U: render

    Note over U,API: Price history (first view only)
    C->>S: GET /api/cards/:id/price-history
    S->>DB: SELECT card_price_history
    alt history empty
        S->>API: GET /cards/:id/price_history (3 credits)
        API-->>S: ~28 days of prices
        S->>DB: bulk INSERT
    end
    S->>DB: SELECT card_price_history
    DB-->>S: rows
    S-->>C: chart data
```

## Write Path — Daily Price Cron

```mermaid
sequenceDiagram
    participant Cron as node-cron (1pm CT)
    participant PT as priceTracker
    participant Scrydex as pokemontcg.ts
    participant API as Scrydex API
    participant DB as Postgres

    Cron->>PT: tick
    PT->>DB: SELECT all card IDs from cards
    DB-->>PT: id list (every viewed card)

    loop chunks of 100
        PT->>Scrydex: getCardsByIds(chunk)
        Scrydex->>API: search ?q=id:A OR id:B ... (1 credit / 100)
        API-->>Scrydex: cards
        Scrydex-->>PT: priceMap
    end

    PT->>DB: DELETE today's rows (UTC)
    PT->>DB: INSERT card_price_history
    PT->>DB: recompute portfolio_value_history per user

    Note over PT: 3 retries · 2 min apart on failure
```

## Caching Layers

```mermaid
flowchart TD
    Req[Request for card data] --> L1{React Query<br/>client cache}
    L1 -->|hit| Done([Render])
    L1 -->|miss| L2{Server in-memory<br/>14-day TTL}
    L2 -->|hit| Resp1[Return JSON] --> L1
    L2 -->|miss| L3{DB cards table<br/>permanent}
    L3 -->|hit| Resp2[Return + warm mem] --> L2
    L3 -->|miss| API[Scrydex API<br/>1 credit]
    API --> Resp3[Persist all 3 layers] --> L3
```

| Layer | Where | TTL | Purpose |
| --- | --- | --- | --- |
| React Query | Browser | 7d sets / 5m charts | Avoid network on tab switch |
| In-memory `apiCache` | Express | 14 days | Avoid DB hit for set browsing |
| `cards` table | Postgres | Permanent | Avoid Scrydex on cold start |

## Data Model

```mermaid
erDiagram
    users ||--o{ portfolio_cards : owns
    users ||--o{ portfolio_value_history : tracks
    cards ||--o{ portfolio_cards : referenced_by
    cards ||--o{ card_price_history : has

    users {
        text id PK
        text username
        text password_hash
    }
    cards {
        text id PK
        text name
        text image_url
        numeric current_price
        timestamp last_updated
    }
    portfolio_cards {
        text user_id FK
        text card_id FK
        int quantity
    }
    card_price_history {
        text card_id FK
        numeric price
        timestamp recorded_at
    }
    portfolio_value_history {
        text user_id FK
        numeric total_value
        timestamp recorded_at
    }
```

## Key Design Decisions

- **Track every viewed card, not just portfolio cards.** Means switching a card in/out of the portfolio doesn't lose history, and new portfolio adds already have a chart.
- **Batch by 100, not one-by-one.** `getCardsByIds()` collapses 100 cards into a single Scrydex query (`id:A OR id:B ...`) — 1 credit instead of 100.
- **On-demand backfill, daily growth.** First viewer pays 3 credits to seed ~28 days; the cron extends it forever.
- **All timestamps UTC.** The cron's `America/Chicago` timezone only controls *when* it fires, not how dates are compared. (`date-fns-tz` had a midnight-boundary bug — removed.)
- **Shared schema.** `shared/schema.ts` exports Drizzle tables *and* Zod validators, consumed by both client and server — no type drift.
