import { storage } from "./storage";
import { getCardById, getCardPrice } from "./pokemontcg";
import * as cron from "node-cron";

let scheduledTask: cron.ScheduledTask | null = null;
let isRunning = false; // Mutex to prevent concurrent executions

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 4 * 60 * 1000; // 7 minutes

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Runs ONE full price update attempt.
 * Throws on failure so retry logic can handle it.
 */
async function recordPricesOnce(): Promise<void> {
  console.log("[Price Tracker] Fetching all unique card IDs...");

  const uniqueCardIds = await storage.getAllUniqueCardIds();

  if (uniqueCardIds.length === 0) {
    console.log("[Price Tracker] No cards to track");
    return;
  }

  console.log(`[Price Tracker] Updating prices for ${uniqueCardIds.length} unique cards...`);

  const failedCards: string[] = [];
  const priceMap = new Map<string, number>();

  for (const cardId of uniqueCardIds) {
    try {
      const result = await getCardById(cardId);
      const currentPrice = getCardPrice(result.data);

      await storage.recordCardPrice(cardId, currentPrice.toFixed(2));
      priceMap.set(cardId, currentPrice);

      console.log(`[Price Tracker] ✓ ${cardId}: $${currentPrice.toFixed(2)}`);

      await delay(100);
    } catch (error) {
      console.error(
        `[Price Tracker] ✗ Failed to update ${cardId}:`,
        error instanceof Error ? error.message : error
      );
      failedCards.push(cardId);
    }
  }

  if (failedCards.length > 0) {
    throw new Error(`Failed to update ${failedCards.length} card(s): ${failedCards.join(", ")}`);
  }

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
 * Public entry point with mutex + retry handling
 */
async function recordPricesWithRetry(): Promise<boolean> {
  if (isRunning) {
    console.log("[Price Tracker] Update already in progress, skipping...");
    return false;
  }

  isRunning = true;

  try {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        console.log(`[Price Tracker] Starting attempt ${attempt}/${MAX_RETRIES}`);
        await recordPricesOnce();
        console.log("[Price Tracker] Price update completed successfully");
        return true;
      } catch (error) {
        console.error(
          `[Price Tracker] Attempt ${attempt} failed:`,
          error instanceof Error ? error.message : error
        );

        if (attempt < MAX_RETRIES) {
          console.log("[Price Tracker] Retrying in 7 minutes...");
          await delay(RETRY_DELAY_MS);
        }
      }
    }

    console.error(`[Price Tracker] All ${MAX_RETRIES} attempts failed. Price update aborted.`);
    return false;
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
  console.log("[Price Tracker] Retry policy: Up to 5 attempts with 7-minute delays");
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
