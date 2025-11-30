import axios from 'axios';

const POKEMON_TCG_API_BASE = 'https://api.pokemontcg.io/v2';
const API_KEY = process.env.POKEMONTCG_API_KEY;

const apiClient = axios.create({
  baseURL: POKEMON_TCG_API_BASE,
  headers: API_KEY ? { 'X-Api-Key': API_KEY } : {},
});

export interface PokemonCard {
  id: string;
  name: string;
  images: {
    small: string;
    large: string;
  };
  set: {
    name: string;
    id: string;
  };
  number: string;
  tcgplayer?: {
    prices?: {
      holofoil?: { market?: number };
      reverseHolofoil?: { market?: number };
      normal?: { market?: number };
      '1stEditionHolofoil'?: { market?: number };
      unlimitedHolofoil?: { market?: number };
    };
  };
}

export interface SearchCardsResponse {
  data: PokemonCard[];
  page: number;
  pageSize: number;
  count: number;
  totalCount: number;
}

export interface GetCardResponse {
  data: PokemonCard;
}

export async function searchCards(query: string, page: number = 1, pageSize: number = 20): Promise<SearchCardsResponse> {
  try {
    const trimmed = query.trim();
    let searchQuery: string;

    // Check if it's a card number with set total (e.g., "009/068")
    const fullCardNumberMatch = trimmed.match(/^(\d+)\/(\d+)$/);
    if (fullCardNumberMatch) {
      const number = parseInt(fullCardNumberMatch[1], 10); // Remove leading zeros
      const setTotal = parseInt(fullCardNumberMatch[2], 10); // Remove leading zeros
      // Search by both number AND set total for precise matching
      searchQuery = `number:${number} set.printedTotal:${setTotal}`;
    } else {
      // Check if it's just a card number (e.g., "010")
      const cardNumberMatch = trimmed.match(/^(\d+)$/);
      if (cardNumberMatch) {
        const number = parseInt(cardNumberMatch[1], 10); // Remove leading zeros
        searchQuery = `number:${number}`;
      } else {
        // Check if it's a promotional/alphanumeric card number (e.g., "SWSH285", "SM234", "XY123")
        const promoCardMatch = trimmed.match(/^[A-Z]+\d+$/i);
        if (promoCardMatch) {
          // Search by card number for promotional cards
          searchQuery = `number:${trimmed}`;
        } else {
          // Search by name - wrap in quotes if it contains spaces or special chars
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
        pageSize,
        orderBy: '-set.releaseDate',
      },
    });
    return response.data;
  } catch (error) {
    console.error('Error searching cards:', error);
    throw error;
  }
}

export async function getCardById(cardId: string): Promise<GetCardResponse> {
  try {
    const response = await apiClient.get<GetCardResponse>(`/cards/${cardId}`);
    return response.data;
  } catch (error) {
    console.error('Error fetching card:', error);
    throw error;
  }
}

export function getCardPrice(card: PokemonCard): number {
  if (!card.tcgplayer?.prices) {
    return 0;
  }

  const prices = card.tcgplayer.prices;
  
  // Priority order: holofoil > 1stEditionHolofoil > unlimitedHolofoil > reverseHolofoil > normal
  const priceOptions = [
    prices.holofoil?.market,
    prices['1stEditionHolofoil']?.market,
    prices.unlimitedHolofoil?.market,
    prices.reverseHolofoil?.market,
    prices.normal?.market,
  ];

  const validPrice = priceOptions.find(price => price !== undefined && price > 0);
  return validPrice || 0;
}
