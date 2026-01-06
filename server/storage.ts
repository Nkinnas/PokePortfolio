import { type User, type InsertUser, type Card, type InsertCard, type PortfolioCard, type InsertPortfolioCard, type CardPriceHistory, type InsertCardPriceHistory, type PortfolioValueHistory, type InsertPortfolioValueHistory } from "@shared/schema";
import { db } from "../db";
import { cards, portfolioCards, users as usersTable, cardPriceHistory, portfolioValueHistory } from "@shared/schema";
import { eq, desc, gte, inArray, sql } from "drizzle-orm";
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

// modify the interface with any CRUD methods
// you might need

export type PortfolioCardWithLastUpdated = PortfolioCard & {
  lastUpdated: Date | null;
};

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Card cache operations
  getCachedCard(id: string): Promise<Card | undefined>;
  getCachedCardsByIds(ids: string[]): Promise<Card[]>;
  cacheCard(card: InsertCard): Promise<Card>;
  updateCachedCard(id: string, updates: Partial<InsertCard>): Promise<Card | undefined>;
  
  // Portfolio operations
  getAllPortfolioCards(userId: string): Promise<PortfolioCardWithLastUpdated[]>;
  getPortfolioCard(id: string): Promise<PortfolioCard | undefined>;
  createPortfolioCard(card: InsertPortfolioCard): Promise<PortfolioCard>;
  updatePortfolioCard(id: string, userId: string, updates: Partial<InsertPortfolioCard>): Promise<PortfolioCard | undefined>;
  deletePortfolioCard(id: string, userId: string): Promise<boolean>;
  
  // Price history operations
  recordCardPrice(cardId: string, price: string): Promise<CardPriceHistory>;
  getCardPriceHistory(cardId: string, daysBack?: number): Promise<CardPriceHistory[]>;
  
  // Portfolio value history operations
  recordPortfolioValue(userId: string, totalValue: string): Promise<PortfolioValueHistory>;
  getPortfolioValueHistory(userId: string, daysBack?: number): Promise<PortfolioValueHistory[]>;
  
  // Helper methods for automatic price tracking
  getAllUniqueCardIds(): Promise<string[]>;
  getAllUsersWithPortfolios(): Promise<User[]>;
  batchUpdatePortfolioCardPrices(updates: Array<{ id: string; userId: string; currentPrice: string }>): Promise<void>;
}

export class DbStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(usersTable).values(insertUser).returning();
    return user;
  }

  async getCachedCard(id: string): Promise<Card | undefined> {
    const [card] = await db.select().from(cards).where(eq(cards.id, id));
    return card;
  }

  async getCachedCardsByIds(ids: string[]): Promise<Card[]> {
    if (ids.length === 0) return [];
    return await db.select().from(cards).where(inArray(cards.id, ids));
  }

  async cacheCard(card: InsertCard): Promise<Card> {
    const [cached] = await db
      .insert(cards)
      .values({ ...card, lastUpdated: new Date() })
      .onConflictDoUpdate({
        target: cards.id,
        set: { ...card, lastUpdated: new Date() }
      })
      .returning();
    return cached;
  }

  async updateCachedCard(id: string, updates: Partial<InsertCard>): Promise<Card | undefined> {
    const [updated] = await db
      .update(cards)
      .set({ ...updates, lastUpdated: new Date() })
      .where(eq(cards.id, id))
      .returning();
    return updated;
  }

  async getAllPortfolioCards(userId: string) {
    const results = await db
      .select({
        id: portfolioCards.id,
        userId: portfolioCards.userId,
        cardId: portfolioCards.cardId,
        cardName: portfolioCards.cardName,
        setName: portfolioCards.setName,
        cardNumber: portfolioCards.cardNumber,
        imageUrl: portfolioCards.imageUrl,
        quantity: portfolioCards.quantity,
        purchasePrice: portfolioCards.purchasePrice,
        currentPrice: portfolioCards.currentPrice,
        lastUpdated: cards.lastUpdated,
      })
      .from(portfolioCards)
      .leftJoin(cards, eq(portfolioCards.cardId, cards.id))
      .where(eq(portfolioCards.userId, userId));
    
    return results;
  }

  async getPortfolioCard(id: string): Promise<PortfolioCard | undefined> {
    const [card] = await db.select().from(portfolioCards).where(eq(portfolioCards.id, id));
    return card;
  }

  async createPortfolioCard(card: InsertPortfolioCard): Promise<PortfolioCard> {
    const [newCard] = await db.insert(portfolioCards).values(card).returning();
    return newCard;
  }

  async updatePortfolioCard(id: string, userId: string, updates: Partial<InsertPortfolioCard>): Promise<PortfolioCard | undefined> {
    const [updated] = await db
      .update(portfolioCards)
      .set(updates)
      .where(sql`${portfolioCards.id} = ${id} AND ${portfolioCards.userId} = ${userId}`)
      .returning();
    return updated;
  }

  async deletePortfolioCard(id: string, userId: string): Promise<boolean> {
    await db.delete(portfolioCards).where(sql`${portfolioCards.id} = ${id} AND ${portfolioCards.userId} = ${userId}`);
    return true;
  }

  async recordCardPrice(cardId: string, price: string): Promise<CardPriceHistory> {
    // Get today's date at midnight (Central Time)
    const timezone = 'America/Chicago';
    const nowInCentral = toZonedTime(new Date(), timezone);
    const todayInCentral = new Date(nowInCentral.getFullYear(), nowInCentral.getMonth(), nowInCentral.getDate());
    const tomorrowInCentral = new Date(todayInCentral);
    tomorrowInCentral.setDate(tomorrowInCentral.getDate() + 1);
    
    // Convert Central time boundaries to UTC for database query
    const today = fromZonedTime(todayInCentral, timezone);
    const tomorrow = fromZonedTime(tomorrowInCentral, timezone);
    
    // Delete any existing records for this card from today (Central time)
    await db
      .delete(cardPriceHistory)
      .where(
        sql`${cardPriceHistory.cardId} = ${cardId} 
            AND ${cardPriceHistory.recordedAt} >= ${today} 
            AND ${cardPriceHistory.recordedAt} < ${tomorrow}`
      );
    
    // Insert the new record
    const [record] = await db.insert(cardPriceHistory).values({ cardId, price }).returning();
    return record;
  }

  async getCardPriceHistory(cardId: string, daysBack: number = 180): Promise<CardPriceHistory[]> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    
    return await db
      .select()
      .from(cardPriceHistory)
      .where(eq(cardPriceHistory.cardId, cardId))
      .orderBy(desc(cardPriceHistory.recordedAt));
  }

  async recordPortfolioValue(userId: string, totalValue: string): Promise<PortfolioValueHistory> {
    // Get today's date at midnight (Central Time)
    const timezone = 'America/Chicago';
    const nowInCentral = toZonedTime(new Date(), timezone);
    const todayInCentral = new Date(nowInCentral.getFullYear(), nowInCentral.getMonth(), nowInCentral.getDate());
    const tomorrowInCentral = new Date(todayInCentral);
    tomorrowInCentral.setDate(tomorrowInCentral.getDate() + 1);
    
    // Convert Central time boundaries to UTC for database query
    const today = fromZonedTime(todayInCentral, timezone);
    const tomorrow = fromZonedTime(tomorrowInCentral, timezone);
    
    // Delete any existing records from today (Central time) for this user
    await db
      .delete(portfolioValueHistory)
      .where(
        sql`${portfolioValueHistory.userId} = ${userId}
            AND ${portfolioValueHistory.recordedAt} >= ${today} 
            AND ${portfolioValueHistory.recordedAt} < ${tomorrow}`
      );
    
    // Insert the new record
    const [record] = await db.insert(portfolioValueHistory).values({ userId, totalValue }).returning();
    return record;
  }

  async getPortfolioValueHistory(userId: string, daysBack: number = 90): Promise<PortfolioValueHistory[]> {
    if (!daysBack || daysBack <= 0) {
      return await db
        .select()
        .from(portfolioValueHistory)
        .where(sql`${portfolioValueHistory.userId} = ${userId}`)
        .orderBy(desc(portfolioValueHistory.recordedAt));
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysBack);
    
    return await db
      .select()
      .from(portfolioValueHistory)
      .where(sql`${portfolioValueHistory.userId} = ${userId} AND ${portfolioValueHistory.recordedAt} >= ${cutoffDate}`)
      .orderBy(desc(portfolioValueHistory.recordedAt));
  }

  async getAllUniqueCardIds(): Promise<string[]> {
    const results = await db
      .selectDistinct({ cardId: portfolioCards.cardId })
      .from(portfolioCards);
    
    return results.map(r => r.cardId);
  }

  async getAllUsersWithPortfolios(): Promise<User[]> {
    const results = await db
      .selectDistinct({ userId: portfolioCards.userId })
      .from(portfolioCards);
    
    const userIds = results.map(r => r.userId).filter((id): id is string => id !== null);
    if (userIds.length === 0) return [];
    
    return await db
      .select()
      .from(usersTable)
      .where(inArray(usersTable.id, userIds));
  }

  async batchUpdatePortfolioCardPrices(updates: Array<{ id: string; userId: string; currentPrice: string }>): Promise<void> {
    // Update currentPrice for each portfolio card in a batch
    // Using Promise.all for parallel updates
    await Promise.all(
      updates.map(update =>
        db
          .update(portfolioCards)
          .set({ currentPrice: update.currentPrice })
          .where(sql`${portfolioCards.id} = ${update.id} AND ${portfolioCards.userId} = ${update.userId}`)
      )
    );
  }
}

export const storage = new DbStorage();
