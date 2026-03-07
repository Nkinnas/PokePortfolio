import { storage } from "./storage";
import { getCardsByIds, getCardPrice } from "./pokemontcg";
import * as cron from "node-cron";

let scheduledTask: cron.ScheduledTask | null = null;
let isRunning = false; // Mutex to prevent concurrent executions

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2 * 60 * 1000; // 2 minutes between retries

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetches prices for a list of card IDs in batches (up to 100 per API call).
 * Returns a map of successful results and a list of failed IDs.
 */
async function fetchPrices(cardIds: string[]): Promise<{ priceMap: Map<string, number>; failedIds: string[] }> {
  const priceMap = new Map<string, number>();
  const failedIds: string[] = [];
  const batchSize = 100;

  for (let i = 0; i < cardIds.length; i += batchSize) {
    const batch = cardIds.slice(i, i + batchSize);

    try {
      console.log(`[Price Tracker] Fetching batch of ${batch.length} cards (${Math.floor(i / batchSize) + 1}/${Math.ceil(cardIds.length / batchSize)})...`);
      const cards = await getCardsByIds(batch);

      // Process returned cards
      const returnedIds = new Set<string>();
      for (const card of cards) {
        const currentPrice = getCardPrice(card);
        await storage.recordCardPrice(card.id, currentPrice.toFixed(2));
        await storage.updateCachedCard(card.id, { price: currentPrice.toFixed(2) });
        priceMap.set(card.id, currentPrice);
        returnedIds.add(card.id);
        console.log(`[Price Tracker] ✓ ${card.id}: $${currentPrice.toFixed(2)}`);
      }

      // Any cards in the batch that weren't returned are failures
      for (const cardId of batch) {
        if (!returnedIds.has(cardId)) {
          console.warn(`[Price Tracker] ✗ ${cardId}: not returned in batch response`);
          failedIds.push(cardId);
        }
      }
    } catch (error) {
      console.error(
        `[Price Tracker] ✗ Batch failed:`,
        error instanceof Error ? error.message : error
      );
      failedIds.push(...batch);
    }
  }

  return { priceMap, failedIds };
}

/**
 * Updates portfolio values for all users using the collected price map.
 */
async function updatePortfolioValues(priceMap: Map<string, number>): Promise<void> {
  console.log("[Price Tracker] Updating portfolio values...");

  const users = await storage.getAllUsersWithPortfolios();

  for (const user of users) {
    try {
      const portfolioCards = await storage.getAllPortfolioCards(user.id);

      const priceUpdates: Array<{ id: string; userId: string; currentPrice: string }> = [];
      let totalValue = 0;

      for (const card of portfolioCards) {
        const latestPrice = priceMap.get(card.cardId);
        if (latestPrice !== undefined) {
          priceUpdates.push({
            id: card.id,
            userId: user.id,
            currentPrice: latestPrice.toFixed(2)
          });
          totalValue += latestPrice * card.quantity;
        } else {
          // Use existing price for cards we couldn't refresh
          totalValue += parseFloat(card.currentPrice) * card.quantity;
        }
      }

      if (priceUpdates.length > 0) {
        await storage.batchUpdatePortfolioCardPrices(priceUpdates);
      }

      await storage.recordPortfolioValue(user.id, totalValue.toFixed(2));
      console.log(`[Price Tracker] ✓ User ${user.username}: $${totalValue.toFixed(2)}`);
    } catch (error) {
      console.error(
        `[Price Tracker] ✗ Failed to update portfolio for user ${user.username}:`,
        error instanceof Error ? error.message : error
      );
    }
  }
}

/**
 * Public entry point with mutex + retry handling.
 * Retries only failed cards instead of the entire batch.
 */
async function recordPricesWithRetry(): Promise<boolean> {
  if (isRunning) {
    console.log("[Price Tracker] Update already in progress, skipping...");
    return false;
  }

  isRunning = true;

  try {
    console.log("[Price Tracker] Fetching all unique card IDs...");
    const uniqueCardIds = await storage.getAllUniqueCardIds();

    if (uniqueCardIds.length === 0) {
      console.log("[Price Tracker] No cards to track");
      return true;
    }

    console.log(`[Price Tracker] Updating prices for ${uniqueCardIds.length} unique cards...`);

    const allPrices = new Map<string, number>();
    let remaining = [...uniqueCardIds];

    for (let attempt = 1; attempt <= MAX_RETRIES && remaining.length > 0; attempt++) {
      if (attempt > 1) {
        console.log(`[Price Tracker] Retry attempt ${attempt}/${MAX_RETRIES} for ${remaining.length} failed card(s)...`);
        await delay(RETRY_DELAY_MS);
      }

      const { priceMap, failedIds } = await fetchPrices(remaining);

      // Merge successful results
      priceMap.forEach((price, id) => {
        allPrices.set(id, price);
      });

      remaining = failedIds;
    }

    if (remaining.length > 0) {
      console.warn(`[Price Tracker] ${remaining.length} card(s) failed after ${MAX_RETRIES} attempts: ${remaining.join(", ")}`);
    }

    const succeeded = allPrices.size;
    console.log(`[Price Tracker] Successfully updated ${succeeded}/${uniqueCardIds.length} cards`);

    if (succeeded > 0) {
      await updatePortfolioValues(allPrices);
    }

    console.log("[Price Tracker] Price update completed");
    return remaining.length === 0;
  } finally {
    isRunning = false;
  }
}

export function startPriceTracking() {
  // Runs at 1:00 PM Central daily
  scheduledTask = cron.schedule(
    "0 13 * * *",
    () => {
      const now = new Date().toLocaleString("en-US", {
        timeZone: "America/Chicago",
        dateStyle: "short",
        timeStyle: "short"
      });

      console.log(`[Price Tracker] Scheduled update triggered at ${now} Central`);
      recordPricesWithRetry();
    },
    { timezone: "America/Chicago" }
  );

  console.log("[Price Tracker] Automatic price tracking enabled");
  console.log("[Price Tracker] Schedule: 1:00 PM Central daily");
  console.log("[Price Tracker] Retry policy: Up to 3 attempts with 2-minute delays (failed cards only)");
}

export function stopPriceTracking() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log("[Price Tracker] Automatic price tracking disabled");
  }
}

export async function triggerManualUpdate(): Promise<boolean> {
  console.log("[Price Tracker] Manual update triggered");
  return recordPricesWithRetry();
}
