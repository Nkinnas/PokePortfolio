import { storage } from "./storage";
import { getCardById, getCardPrice } from "./pokemontcg";
import * as cron from "node-cron";

let scheduledTask: cron.ScheduledTask | null = null;
let isRunning = false; // Mutex to prevent concurrent executions

const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 7 * 60 * 1000; // 7 minutes

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function recordPricesWithRetry(attempt = 1): Promise<boolean> {
  // Prevent concurrent executions
  if (isRunning) {
    console.log("[Price Tracker] Update already in progress, skipping...");
    return false;
  }

  isRunning = true;
  
  try {
    console.log(`[Price Tracker] Starting price update (attempt ${attempt}/${MAX_RETRIES})...`);
    
    // Get all unique card IDs across all users
    const uniqueCardIds = await storage.getAllUniqueCardIds();
    
    if (uniqueCardIds.length === 0) {
      console.log("[Price Tracker] No cards to track");
      return true; // Not an error, just nothing to do
    }
    
    console.log(`[Price Tracker] Updating prices for ${uniqueCardIds.length} unique cards...`);
    
    // Fetch and store prices for each unique card
    const failedCards: string[] = [];
    const priceMap = new Map<string, number>(); // cardId -> latest price
    
    for (const cardId of uniqueCardIds) {
      try {
        // Fetch current price from API
        const result = await getCardById(cardId);
        const currentPrice = getCardPrice(result.data);
        
        
        // Record price history (shared across all users)
        await storage.recordCardPrice(cardId, currentPrice.toFixed(2));
        
        // Store in map for portfolio calculations
        priceMap.set(cardId, currentPrice);
        
        console.log(`[Price Tracker] ✓ ${cardId}: $${currentPrice.toFixed(2)}`);
        
        // Small delay to avoid rate limiting
        await delay(100);
      } catch (error) {
        console.error(`[Price Tracker] ✗ Failed to update ${cardId}:`, error instanceof Error ? error.message : error);
        failedCards.push(cardId);
      }
    }
    
    // If ANY cards failed, throw error to trigger retry
    if (failedCards.length > 0) {
      throw new Error(`Failed to update ${failedCards.length} card(s): ${failedCards.join(', ')}`);
    }
    
    // Now update portfolio cards and values for each user
    console.log("[Price Tracker] Updating portfolio cards and values for all users...");
    const users = await storage.getAllUsersWithPortfolios();
    
    for (const user of users) {
      try {
        // Get this user's portfolio cards
        const portfolioCards = await storage.getAllPortfolioCards(user.id);
        
        // Prepare batch updates for currentPrice
        const priceUpdates: Array<{ id: string; userId: string; currentPrice: string }> = [];
        let totalValue = 0;
        
        for (const card of portfolioCards) {
          const latestPrice = priceMap.get(card.cardId);
          if (latestPrice !== undefined) {
            // Queue the price update
            priceUpdates.push({
              id: card.id,
              userId: user.id,
              currentPrice: latestPrice.toFixed(2)
            });
            
            // Add to total portfolio value
            totalValue += latestPrice * card.quantity;
          }
        }
        
        // Batch update all portfolio card prices for this user
        if (priceUpdates.length > 0) {
          await storage.batchUpdatePortfolioCardPrices(priceUpdates);
        }
        
        // Record portfolio value history for this user
        await storage.recordPortfolioValue(user.id, totalValue.toFixed(2));
        console.log(`[Price Tracker] ✓ User ${user.username}: $${totalValue.toFixed(2)}`);
      } catch (error) {
        console.error(`[Price Tracker] ✗ Failed to update portfolio for user ${user.username}:`, error instanceof Error ? error.message : error);
      }
    }
    
    console.log(`[Price Tracker] Price update completed successfully`);
    return true;
  } catch (error) {
    console.error(`[Price Tracker] Attempt ${attempt} failed:`, error instanceof Error ? error.message : error);
    
    // If we haven't exceeded max retries, try again after delay
    if (attempt < MAX_RETRIES) {
      console.log(`[Price Tracker] Retrying in 7 minutes...`);
      await delay(RETRY_DELAY_MS);
      return recordPricesWithRetry(attempt + 1);
    }
    
    // All retries exhausted
    console.error(`[Price Tracker] All ${MAX_RETRIES} attempts failed. Price update aborted.`);
    return false;
  } finally {
    isRunning = false;
  }
}

export function startPriceTracking() {
  // Schedule twice daily: 8:00 AM and 8:00 PM Central Time (America/Chicago)
  // Cron format: minute hour day month weekday
  // '0 8,13,20 * * *' = At minute 0 of hour 8 13 20 (8am, 1pm, and 8pm)
  scheduledTask = cron.schedule('0 8,13,20 * * *', () => {
    const now = new Date().toLocaleString('en-US', { 
      timeZone: 'America/Chicago',
      dateStyle: 'short',
      timeStyle: 'short'
    });
    console.log(`[Price Tracker] Scheduled update triggered at ${now} Central`);
    recordPricesWithRetry();
  }, {
    timezone: 'America/Chicago'
  });
  
  console.log("[Price Tracker] Automatic price tracking enabled");
  console.log("[Price Tracker] Schedule: 8:00 AM and 8:00 PM Central Time");
  console.log("[Price Tracker] Retry policy: Up to 3 attempts with 5-minute delays");
}

export function stopPriceTracking() {
  if (scheduledTask) {
    scheduledTask.stop();
    scheduledTask = null;
    console.log("[Price Tracker] Automatic price tracking disabled");
  }
}

// Export for manual triggering
export async function triggerManualUpdate(): Promise<boolean> {
  console.log("[Price Tracker] Manual update triggered");
  return recordPricesWithRetry();
}
