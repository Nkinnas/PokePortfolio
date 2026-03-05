import { storage } from "./storage";
import { getCardById, getCardPrice } from "./pokemontcg";
import * as cron from "node-cron";

let scheduledTask: cron.ScheduledTask | null = null;
let isRunning = false; // Mutex to prevent concurrent executions

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2 * 60 * 1000; // 2 minutes between retries
const API_DELAY_MS = 500; // 500ms between individual API calls

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetches prices for a list of card IDs, returning a map of successful results
 * and a list of failed IDs.
 */
async function fetchPrices(cardIds: string[]): Promise<{ priceMap: Map<string, number>; failedIds: string[] }> {
  const priceMap = new Map<string, number>();
  const failedIds: string[] = [];

  for (const cardId of cardIds) {
    try {
      const result = await getCardById(cardId);
      const currentPrice = getCardPrice(result.data);

      await storage.recordCardPrice(cardId, currentPrice.toFixed(2));
      await storage.updateCachedCard(cardId, { price: currentPrice.toFixed(2) });
      priceMap.set(cardId, currentPrice);

      console.log(`[Price Tracker] ✓ ${cardId}: $${currentPrice.toFixed(2)}`);

      await delay(API_DELAY_MS);
    } catch (error) {
      console.error(
        `[Price Tracker] ✗ Failed to update ${cardId}:`,
        error instanceof Error ? error.message : error
      );
      failedIds.push(cardId);
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
  // Runs at 8:00 AM, 1:00 PM, and 8:00 PM Central
  scheduledTask = cron.schedule(
    "0 8,13,20 * * *",
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
  console.log("[Price Tracker] Schedule: 8:00 AM, 1:00 PM, 8:00 PM Central");
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
