# Code Walkthrough

---

# Part 1 — The 3-tier cache

---

## 1. L2 — In-memory `apiCache` on the server

**File:** `server/pokemontcg.ts`
**Lines:** 90–102 (the cache), 104–124 (a consumer)

```ts
// pokemontcg.ts:90
const apiCache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function getCached<T>(key: string): T | null {
  const entry = apiCache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data as T;
  if (entry) apiCache.delete(key);
  return null;
}

// pokemontcg.ts:104 — every expansion request goes through this
export async function getExpansions(...) {
  const cached = getCached<ExpansionsResponse>(cacheKey);
  if (cached) return cached;
  // ... only on miss do we call Scrydex
}
```

---

## 2. L3 — Postgres `cards` table

**File:** `server/routes.ts:352–367` — the read
**File:** `server/storage.ts:62–65` — the lookup

```ts
// routes.ts:352
app.get("/api/cards/:id", async (req, res) => {
  const cached = await storage.getCachedCard(id);
  if (cached) {
    return res.json({ ...cached, price: parseFloat(cached.price), ... });
  }
  // miss → fall through to Scrydex
});

// storage.ts:62
async getCachedCard(id: string): Promise<Card | undefined> {
  const [card] = await db.select().from(cards).where(eq(cards.id, id));
  return card;
}
```

---

## 3. Full miss — Scrydex call + writeback

**File:** `server/routes.ts:352–396`
**Key lines:** 369 (the API call), 373–380 (the writeback)

```ts
// routes.ts:369 — only reached on full miss
const result = await getCardById(id);
const price = getCardPrice(result.data);
const imageUrl = getCardImageUrl(result.data);

// routes.ts:373 — write back to the DB cache
await storage.cacheCard({
  id: result.data.id,
  name: result.data.name,
  setName: result.data.expansion.name,
  cardNumber: result.data.number,
  imageUrl,
  price: price.toFixed(2),
});

res.json(card); // React Query caches this client-side automatically
```

---

# Part 2 — The daily price cron

---

## 1. The cron registration

**File:** `server/priceTracker.ts`
**Lines:** 166–186 (key lines: 168–181)

```ts
scheduledTask = cron.schedule(
  "0 13 * * *",
  () => { ... recordPricesWithRetry(); },
  { timezone: "America/Chicago" }
);
```

---

## 2. The card-ID query

**File:** `server/priceTracker.ts:120` — the call
**File:** `server/storage.ts:199–204` — the SQL

```ts
// priceTracker.ts:120
const uniqueCardIds = await storage.getAllCachedCardIds();

// storage.ts:199
async getAllCachedCardIds(): Promise<string[]> {
  const results = await db
    .select({ id: cards.id })
    .from(cards);
  return results.map(r => r.id);
}
```

---

## 3. The batching loop

**File:** `server/priceTracker.ts:19–59` — the loop
**File:** `server/pokemontcg.ts:204–229` — the query construction

```ts
// priceTracker.ts:24
for (let i = 0; i < cardIds.length; i += batchSize) {
  const batch = cardIds.slice(i, i + batchSize);
  const cards = await getCardsByIds(batch);
  ...
}

// pokemontcg.ts:210
const query = batch.map(id => `id:${id}`).join(' OR ');
```

---

# Part 3 — The frontend: price chart component

---

## 1. The data fetch

**File:** `client/src/components/PriceChart.tsx`
**Lines:** 36–40

```ts
// PriceChart.tsx:36
const { data: priceHistory = [], isPending } = useQuery<PriceDataPoint[]>({
  queryKey: ['/api/price-history', cardId],
  staleTime: 5 * 60 * 1000, // Refetch after 5 minutes (allows backfill to complete)
  refetchOnMount: true,
});
```

---

## 2. The render path

**File:** `client/src/components/PriceChart.tsx`
**Lines:** 21–30 (date formatter), 52–82 (states), 150–192 (chart)

```tsx
// PriceChart.tsx:21 — format dates as plain strings, no timezone math
function formatDateShort(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', ...];
  return `${monthNames[parseInt(month) - 1]} ${parseInt(day)}`;
}

// PriceChart.tsx:53 — loading state
if (isPending) return <Card>...Loading price history...</Card>;

// PriceChart.tsx:69 — empty state (covers the "brand new card, no history yet" case)
if (filteredData.length === 0) {
  return <Card>...No price history available yet. Check back later!</Card>;
}

// PriceChart.tsx:150 — Recharts wired up
<ResponsiveContainer width="100%" height="100%">
  <LineChart data={filteredData}>
    <Line type="monotone" dataKey="price" stroke="hsl(var(--primary))" />
  </LineChart>
</ResponsiveContainer>
```
