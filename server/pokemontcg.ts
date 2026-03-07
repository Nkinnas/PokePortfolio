import axios from 'axios';
import { db } from '../db';
import { cardPriceHistory } from '@shared/schema';
import { sql } from 'drizzle-orm';

const SCRYDEX_API_BASE = 'https://api.scrydex.com/pokemon/v1';
const API_KEY = process.env.SCRYDEX_API_KEY;
const TEAM_ID = process.env.SCRYDEX_TEAM_ID;

const apiClient = axios.create({
  baseURL: SCRYDEX_API_BASE,
  headers: {
    ...(API_KEY ? { 'X-Api-Key': API_KEY } : {}),
    ...(TEAM_ID ? { 'X-Team-ID': TEAM_ID } : {}),
  },
});

interface ScrydexVariantPrice {
  condition: string;
  type: string;
  low: number;
  market: number;
  currency: string;
  is_perfect?: boolean;
  is_signed?: boolean;
  is_error?: boolean;
  trends?: Record<string, { price_change: number; percent_change: number }>;
}

interface ScrydexVariant {
  name: string;
  images?: Array<{
    type: string;
    small: string;
    medium: string;
    large: string;
  }>;
  prices?: ScrydexVariantPrice[];
}

export interface PokemonCard {
  id: string;
  name: string;
  images: Array<{
    type: string;
    small: string;
    medium: string;
    large: string;
  }>;
  expansion: {
    name: string;
    id: string;
  };
  number: string;
  variants?: ScrydexVariant[];
}

export interface SearchCardsResponse {
  data: PokemonCard[];
  page: number;
  page_size: number;
  count: number;
  total_count: number;
}

export interface GetCardResponse {
  data: PokemonCard;
}

export interface Expansion {
  id: string;
  name: string;
  series: string;
  total: number;
  printed_total: number;
  release_date: string;
  logo: string;
  symbol: string;
}

export interface ExpansionsResponse {
  data: Expansion[];
  page: number;
  page_size: number;
  count: number;
  total_count: number;
}

// Server-side cache: expansions list and expansion card lists
const apiCache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

function getCached<T>(key: string): T | null {
  const entry = apiCache.get(key);
  if (entry && Date.now() < entry.expiresAt) return entry.data as T;
  if (entry) apiCache.delete(key);
  return null;
}

function setCache(key: string, data: any) {
  apiCache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

export async function getExpansions(page: number = 1, pageSize: number = 100): Promise<ExpansionsResponse> {
  const cacheKey = `expansions:${page}:${pageSize}`;
  const cached = getCached<ExpansionsResponse>(cacheKey);
  if (cached) return cached;

  try {
    const response = await apiClient.get<ExpansionsResponse>('/expansions', {
      params: {
        page,
        page_size: pageSize,
        orderBy: '-release_date',
        q: 'language:English',
      },
    });
    setCache(cacheKey, response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching expansions:', error);
    throw error;
  }
}

export async function getExpansionCards(expansionId: string, page: number = 1, pageSize: number = 100): Promise<SearchCardsResponse> {
  const cacheKey = `expansion-cards:${expansionId}:${page}:${pageSize}`;
  const cached = getCached<SearchCardsResponse>(cacheKey);
  if (cached) return cached;

  try {
    const response = await apiClient.get<SearchCardsResponse>(`/expansions/${expansionId}/cards`, {
      params: {
        page,
        page_size: pageSize,
        orderBy: 'number',
        include: 'prices',
      },
    });
    setCache(cacheKey, response.data);
    return response.data;
  } catch (error) {
    console.error('Error fetching expansion cards:', error);
    throw error;
  }
}

export async function searchCards(query: string, page: number = 1, pageSize: number = 20): Promise<SearchCardsResponse> {
  try {
    const trimmed = query.trim();
    let searchQuery: string;

    // Check if it's a card number with set total (e.g., "009/068")
    const fullCardNumberMatch = trimmed.match(/^(\d+)\/(\d+)$/);
    if (fullCardNumberMatch) {
      const number = parseInt(fullCardNumberMatch[1], 10);
      const setTotal = parseInt(fullCardNumberMatch[2], 10);
      searchQuery = `number:${number} expansion.total:${setTotal}`;
    } else {
      // Check if it's just a card number (e.g., "010")
      const cardNumberMatch = trimmed.match(/^(\d+)$/);
      if (cardNumberMatch) {
        const number = parseInt(cardNumberMatch[1], 10);
        searchQuery = `number:${number}`;
      } else {
        // Check if it's a promotional/alphanumeric card number (e.g., "SWSH285", "SM234", "XY123")
        const promoCardMatch = trimmed.match(/^[A-Z]+\d+$/i);
        if (promoCardMatch) {
          searchQuery = `number:${trimmed}`;
        } else {
          const needsQuotes = /[\s"]/.test(trimmed);
          const escapedName = trimmed.replace(/"/g, '\\"');

          if (needsQuotes) {
            searchQuery = `name:"${escapedName}*"`;
          } else {
            searchQuery = `name:${escapedName}*`;
          }
        }
      }
    }

    console.log(`Search input: "${query}" -> Query: "${searchQuery}"`);

    const response = await apiClient.get<SearchCardsResponse>('/cards', {
      params: {
        q: searchQuery,
        page,
        page_size: pageSize,
        include: 'prices',
        orderBy: '-expansion.release_date',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error searching cards:', error);
    throw error;
  }
}

/**
 * Fetches multiple cards by ID in batches of up to 100, using 1 API credit per batch.
 */
export async function getCardsByIds(cardIds: string[]): Promise<PokemonCard[]> {
  const allCards: PokemonCard[] = [];
  const batchSize = 100;

  for (let i = 0; i < cardIds.length; i += batchSize) {
    const batch = cardIds.slice(i, i + batchSize);
    const query = batch.map(id => `id:${id}`).join(' OR ');

    try {
      const response = await apiClient.get<SearchCardsResponse>('/cards', {
        params: {
          q: query,
          page: 1,
          page_size: batchSize,
          include: 'prices',
        },
      });
      allCards.push(...response.data.data);
    } catch (error) {
      console.error(`Error batch-fetching cards (batch starting at ${i}):`, error);
      throw error;
    }
  }

  return allCards;
}

export async function getCardById(cardId: string): Promise<GetCardResponse> {
  try {
    const response = await apiClient.get<GetCardResponse>(`/cards/${cardId}`, {
      params: {
        include: 'prices',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error fetching card:', error);
    throw error;
  }
}

export function getCardPrice(card: PokemonCard): number {
  return getBestRawNmPrice(card)?.market || 0;
}

const VARIANT_PRIORITY = [
  'holofoil',
  'firstEditionHolofoil',
  'firstEditionShadowlessHolofoil',
  'unlimitedHolofoil',
  'unlimitedShadowlessHolofoil',
  'reverseHolofoil',
  'normal',
];

function getBestRawNmPrice(card: PokemonCard): ScrydexVariantPrice | null {
  if (!card.variants || card.variants.length === 0) return null;

  const candidates = new Map<string, ScrydexVariantPrice>();
  for (const variant of card.variants) {
    if (!variant.prices) continue;
    const rawNm = variant.prices.find(p => p.type === 'raw' && p.condition === 'NM' && p.currency === 'USD');
    if (rawNm && rawNm.market > 0) {
      candidates.set(variant.name, rawNm);
    }
  }

  for (const name of VARIANT_PRIORITY) {
    const price = candidates.get(name);
    if (price) return price;
  }

  // Fallback to any
  return candidates.values().next().value || null;
}

/**
 * Fetches real daily price history from Scrydex and inserts into DB.
 * Costs 3 API credits. Only runs for cards with no existing history.
 */
export async function backfillCardPriceHistory(cardId: string): Promise<number> {
  try {
    // Skip if this card already has any price history
    const existingCount = await db.execute(sql`
      SELECT COUNT(*) as cnt FROM card_price_history WHERE card_id = ${cardId}
    `);
    if (parseInt(existingCount.rows[0].cnt as string) > 0) {
      console.log(`[Backfill] ${cardId}: already has price history, skipping`);
      return 0;
    }

    const response = await apiClient.get(`/cards/${cardId}/price_history`, {
      params: { page_size: 100 },
    });

    const days = response.data.data as Array<{ date: string; prices: Array<{
      variant: string; condition: string; type: string; currency: string; market: number; low?: number;
    }> }>;

    if (!days || days.length === 0) {
      console.log(`[Backfill] ${cardId}: no price history available`);
      return 0;
    }

    let inserted = 0;
    for (const day of days) {
      // Find best raw NM USD price for this day using variant priority
      const candidates = new Map<string, number>();
      for (const p of day.prices) {
        if (p.type === 'raw' && p.condition === 'NM' && p.currency === 'USD' && p.market > 0) {
          candidates.set(p.variant, p.market);
        }
      }

      let price: number | null = null;
      for (const name of VARIANT_PRIORITY) {
        if (candidates.has(name)) { price = candidates.get(name)!; break; }
      }
      if (price === null) {
        const first = candidates.values().next().value;
        if (first) price = first;
      }
      if (price === null) continue;

      const recordedAt = new Date(day.date + 'T21:00:00.000Z');
      await db.insert(cardPriceHistory).values({
        cardId,
        price: price.toFixed(2),
        recordedAt,
      });
      inserted++;
    }

    console.log(`[Backfill] ${cardId}: inserted ${inserted} real daily price records (${days.length} days available)`);
    return inserted;
  } catch (error) {
    console.error(`[Backfill] Error backfilling ${cardId}:`, error);
    return 0;
  }
}

/**
 * Gets the card image URL from Scrydex's images array.
 */
export function getCardImageUrl(card: PokemonCard, size: 'small' | 'medium' | 'large' = 'large'): string {
  if (card.images && card.images.length > 0) {
    const frontImage = card.images.find(img => img.type === 'front') || card.images[0];
    return frontImage[size] || frontImage.large || frontImage.medium || frontImage.small;
  }
  return '';
}
