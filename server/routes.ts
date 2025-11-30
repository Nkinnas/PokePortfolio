import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { searchCards, getCardById, getCardPrice } from "./pokemontcg";
import { insertPortfolioCardSchema, insertUserSchema } from "@shared/schema";
import { fromZodError } from "zod-validation-error";
import { toZonedTime } from 'date-fns-tz';
import session from "express-session";
import bcrypt from "bcryptjs";
import { db } from "../db";
import { portfolioCards, portfolioValueHistory } from "@shared/schema";
import { sql } from "drizzle-orm";

// Extend Express session type
declare module 'express-session' {
  interface SessionData {
    userId: string;
    username: string;
  }
}

// Authentication middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.userId) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Configure session middleware
  app.use(
    session({
      secret: process.env.SESSION_SECRET || "pokemon-portfolio-secret-key-change-in-production",
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: false,
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
      },
    })
  );

  // Auth routes
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const validation = insertUserSchema.safeParse(req.body);
      if (!validation.success) {
        const readableError = fromZodError(validation.error);
        return res.status(400).json({ error: readableError.message });
      }

      const { username, password } = validation.data;

      // Check if username already exists
      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        return res.status(400).json({ error: "Username already exists" });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create user
      const user = await storage.createUser({
        username,
        password: hashedPassword,
      });

      // CRITICAL: Assign all existing unowned data to this first user
      // This ensures the user's existing portfolio data gets transferred to their account
      await db.execute(sql`
        UPDATE portfolio_cards 
        SET user_id = ${user.id} 
        WHERE user_id IS NULL
      `);
      
      await db.execute(sql`
        UPDATE portfolio_value_history 
        SET user_id = ${user.id} 
        WHERE user_id IS NULL
      `);

      // Create session
      req.session.userId = user.id;
      req.session.username = user.username;

      res.json({ 
        id: user.id, 
        username: user.username 
      });
    } catch (error) {
      console.error("Error during signup:", error);
      res.status(500).json({ error: "Failed to create account" });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const validation = insertUserSchema.safeParse(req.body);
      if (!validation.success) {
        const readableError = fromZodError(validation.error);
        return res.status(400).json({ error: readableError.message });
      }

      const { username, password } = validation.data;

      // Find user
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      // Verify password
      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        return res.status(401).json({ error: "Invalid username or password" });
      }

      // Regenerate session for security
      req.session.regenerate((err) => {
        if (err) {
          console.error("Session regeneration error:", err);
          return res.status(500).json({ error: "Login failed" });
        }

        req.session.userId = user.id;
        req.session.username = user.username;

        res.json({ 
          id: user.id, 
          username: user.username 
        });
      });
    } catch (error) {
      console.error("Error during login:", error);
      res.status(500).json({ error: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Error during logout:", err);
        return res.status(500).json({ error: "Logout failed" });
      }
      res.clearCookie("connect.sid");
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.session || !req.session.userId) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    res.json({
      id: req.session.userId,
      username: req.session.username,
    });
  });

  // Search Pokemon cards
  app.get("/api/cards/search", async (req, res) => {
    try {
      const query = req.query.q as string;
      const page = parseInt(req.query.page as string) || 1;
      const pageSize = parseInt(req.query.pageSize as string) || 20;

      if (!query) {
        return res.status(400).json({ error: "Query parameter 'q' is required" });
      }

      const result = await searchCards(query, page, pageSize);
      const cardIds = result.data.map(card => card.id);
      
      const cachedCards = await storage.getCachedCardsByIds(cardIds);
      const cachedCardMap = new Map(cachedCards.map(c => [c.id, c]));
      
      const cards = await Promise.all(
        result.data.map(async (card) => {
          const cached = cachedCardMap.get(card.id);
          
          if (cached) {
            return {
              id: cached.id,
              name: cached.name,
              setName: cached.setName,
              cardNumber: cached.cardNumber,
              imageUrl: cached.imageUrl,
              price: parseFloat(cached.price),
              lastUpdated: cached.lastUpdated.toISOString(),
            };
          }
          
          const price = getCardPrice(card);
          await storage.cacheCard({
            id: card.id,
            name: card.name,
            setName: card.set.name,
            cardNumber: card.number,
            imageUrl: card.images.large,
            price: price.toFixed(2),
          });
          
          return {
            id: card.id,
            name: card.name,
            setName: card.set.name,
            cardNumber: card.number,
            imageUrl: card.images.large,
            price,
            lastUpdated: new Date().toISOString(),
          };
        })
      );

      res.json({
        cards,
        page: result.page,
        pageSize: result.pageSize,
        totalCount: result.totalCount,
      });
    } catch (error) {
      console.error("Error searching cards:", error);
      res.status(500).json({ error: "Failed to search cards" });
    }
  });

  // Get card by ID
  app.get("/api/cards/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const cached = await storage.getCachedCard(id);
      
      if (cached) {
        return res.json({
          id: cached.id,
          name: cached.name,
          setName: cached.setName,
          cardNumber: cached.cardNumber,
          imageUrl: cached.imageUrl,
          price: parseFloat(cached.price),
          lastUpdated: cached.lastUpdated.toISOString(),
        });
      }
      
      const result = await getCardById(id);
      const price = getCardPrice(result.data);
      
      await storage.cacheCard({
        id: result.data.id,
        name: result.data.name,
        setName: result.data.set.name,
        cardNumber: result.data.number,
        imageUrl: result.data.images.large,
        price: price.toFixed(2),
      });
      
      const card = {
        id: result.data.id,
        name: result.data.name,
        setName: result.data.set.name,
        cardNumber: result.data.number,
        imageUrl: result.data.images.large,
        price,
        lastUpdated: new Date().toISOString(),
      };

      res.json(card);
    } catch (error) {
      console.error("Error fetching card:", error);
      res.status(500).json({ error: "Failed to fetch card" });
    }
  });

  // Refresh card price from API
  app.post("/api/cards/:id/refresh", async (req, res) => {
    try {
      const { id } = req.params;
      const result = await getCardById(id);
      const price = getCardPrice(result.data);
      
      await storage.cacheCard({
        id: result.data.id,
        name: result.data.name,
        setName: result.data.set.name,
        cardNumber: result.data.number,
        imageUrl: result.data.images.large,
        price: price.toFixed(2),
      });
      
      // Also record in price history (will overwrite today's entry if exists)
      await storage.recordCardPrice(result.data.id, price.toFixed(2));
      
      const card = {
        id: result.data.id,
        name: result.data.name,
        setName: result.data.set.name,
        cardNumber: result.data.number,
        imageUrl: result.data.images.large,
        price,
        lastUpdated: new Date().toISOString(),
      };

      res.json(card);
    } catch (error) {
      console.error("Error refreshing card:", error);
      res.status(500).json({ error: "Failed to refresh card" });
    }
  });

  // Portfolio routes (protected)
  app.get("/api/portfolio", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const cards = await storage.getAllPortfolioCards(userId);
      res.json(cards);
    } catch (error) {
      console.error("Error fetching portfolio:", error);
      res.status(500).json({ error: "Failed to fetch portfolio" });
    }
  });

  app.post("/api/portfolio", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const validation = insertPortfolioCardSchema.safeParse(req.body);
      if (!validation.success) {
        const readableError = fromZodError(validation.error);
        return res.status(400).json({ error: readableError.message });
      }
      
      const card = await storage.createPortfolioCard({ ...validation.data, userId });
      res.json(card);
    } catch (error) {
      console.error("Error creating portfolio card:", error);
      res.status(500).json({ error: "Failed to create portfolio card" });
    }
  });

  app.patch("/api/portfolio/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId!;
      
      const validation = insertPortfolioCardSchema.partial().safeParse(req.body);
      if (!validation.success) {
        const readableError = fromZodError(validation.error);
        return res.status(400).json({ error: readableError.message });
      }
      
      // Strip any userId from client data to prevent ownership manipulation
      const { userId: _, ...safeData } = validation.data as any;
      const updated = await storage.updatePortfolioCard(id, userId, safeData);
      if (!updated) {
        return res.status(404).json({ error: "Card not found" });
      }
      res.json(updated);
    } catch (error) {
      console.error("Error updating portfolio card:", error);
      res.status(500).json({ error: "Failed to update portfolio card" });
    }
  });

  app.delete("/api/portfolio/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.session.userId!;
      await storage.deletePortfolioCard(id, userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting portfolio card:", error);
      res.status(500).json({ error: "Failed to delete portfolio card" });
    }
  });

  // Price history routes
  app.get("/api/price-history/:cardId", async (req, res) => {
    try {
      const { cardId } = req.params;
      const daysBack = parseInt(req.query.days as string) || 180;
      
      const history = await storage.getCardPriceHistory(cardId, daysBack);
      
      // Transform to frontend format - convert UTC to Central timezone
      const timezone = 'America/Chicago';
      const formattedHistory = history.map(record => {
        const utcDate = new Date(record.recordedAt);
        const centralDate = toZonedTime(utcDate, timezone);
        const year = centralDate.getFullYear();
        const month = String(centralDate.getMonth() + 1).padStart(2, '0');
        const day = String(centralDate.getDate()).padStart(2, '0');
        
        return {
          date: `${year}-${month}-${day}`,
          price: parseFloat(record.price),
        };
      }).reverse(); // Reverse to show oldest first
      
      res.json(formattedHistory);
    } catch (error) {
      console.error("Error fetching price history:", error);
      res.status(500).json({ error: "Failed to fetch price history" });
    }
  });

  app.post("/api/portfolio-value/record", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      // Accept total value from client (calculated from fresh prices) or calculate from DB
      const { totalValue: providedValue } = req.body;
      
      let totalValue: number;
      
      if (providedValue !== undefined && providedValue !== null) {
        // Use the value provided by client (already calculated from fresh prices)
        totalValue = parseFloat(providedValue.toString());
      } else {
        // Fallback: calculate from database (for backwards compatibility)
        const portfolioCards = await storage.getAllPortfolioCards(userId);
        
        if (portfolioCards.length === 0) {
          return res.json({ totalValue: 0, message: "No cards in portfolio" });
        }
        
        totalValue = portfolioCards.reduce((sum, card) => {
          const currentPrice = parseFloat(card.currentPrice);
          return sum + (card.quantity * currentPrice);
        }, 0);
      }
      
      // Record in history (will overwrite today's entry if exists)
      await storage.recordPortfolioValue(userId, totalValue.toFixed(2));
      
      res.json({ totalValue: parseFloat(totalValue.toFixed(2)) });
    } catch (error) {
      console.error("Error recording portfolio value:", error);
      res.status(500).json({ error: "Failed to record portfolio value" });
    }
  });

  app.get("/api/portfolio-value-history", requireAuth, async (req, res) => {
    try {
      const userId = req.session.userId!;
      const daysBack = parseInt(req.query.days as string) || 90;
      
      const history = await storage.getPortfolioValueHistory(userId, daysBack);
      
      // Transform to frontend format - convert UTC to Central timezone
      const timezone = 'America/Chicago';
      const formattedHistory = history.map(record => {
        const utcDate = new Date(record.recordedAt);
        const centralDate = toZonedTime(utcDate, timezone);
        const year = centralDate.getFullYear();
        const month = String(centralDate.getMonth() + 1).padStart(2, '0');
        const day = String(centralDate.getDate()).padStart(2, '0');
        
        return {
          date: `${year}-${month}-${day}`,
          value: parseFloat(record.totalValue),
        };
      }).reverse(); // Reverse to show oldest first
      
      res.json(formattedHistory);
    } catch (error) {
      console.error("Error fetching portfolio value history:", error);
      res.status(500).json({ error: "Failed to fetch portfolio value history" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
