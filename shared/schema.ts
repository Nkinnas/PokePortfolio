import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const cards = pgTable("cards", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  setName: text("set_name").notNull(),
  cardNumber: text("card_number"),
  imageUrl: text("image_url").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  lastUpdated: timestamp("last_updated").notNull().defaultNow(),
});

export const portfolioCards = pgTable("portfolio_cards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  cardId: text("card_id").notNull(),
  cardName: text("card_name").notNull(),
  setName: text("set_name").notNull(),
  cardNumber: text("card_number"),
  imageUrl: text("image_url").notNull(),
  quantity: integer("quantity").notNull(),
  purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }).notNull(),
  currentPrice: decimal("current_price", { precision: 10, scale: 2 }).notNull(),
});

export const cardPriceHistory = pgTable("card_price_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  cardId: text("card_id").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
});

export const portfolioValueHistory = pgTable("portfolio_value_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }),
  totalValue: decimal("total_value", { precision: 10, scale: 2 }).notNull(),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
});

export const insertCardSchema = createInsertSchema(cards).omit({
  lastUpdated: true,
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

const numericStringSchema = z.string()
  .regex(/^-?\d+(\.\d+)?$/, "Must be a valid number")
  .transform((val) => parseFloat(val).toFixed(2));

export const insertPortfolioCardSchema = createInsertSchema(portfolioCards).omit({
  id: true,
  userId: true,  // userId is set by backend, not client
}).extend({
  quantity: z.number().int().positive(),
  purchasePrice: z.union([
    numericStringSchema,
    z.number().transform(n => n.toFixed(2))
  ]),
  currentPrice: z.union([
    numericStringSchema,
    z.number().transform(n => n.toFixed(2))
  ]),
  cardNumber: z.string().optional().nullable(),
});

export const insertCardPriceHistorySchema = createInsertSchema(cardPriceHistory).omit({
  id: true,
  recordedAt: true,
});

export const insertPortfolioValueHistorySchema = createInsertSchema(portfolioValueHistory).omit({
  id: true,
  recordedAt: true,
});

export type Card = typeof cards.$inferSelect;
export type InsertCard = z.infer<typeof insertCardSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type PortfolioCard = typeof portfolioCards.$inferSelect;
export type InsertPortfolioCard = z.infer<typeof insertPortfolioCardSchema>;
export type CardPriceHistory = typeof cardPriceHistory.$inferSelect;
export type InsertCardPriceHistory = z.infer<typeof insertCardPriceHistorySchema>;
export type PortfolioValueHistory = typeof portfolioValueHistory.$inferSelect;
export type InsertPortfolioValueHistory = z.infer<typeof insertPortfolioValueHistorySchema>;
