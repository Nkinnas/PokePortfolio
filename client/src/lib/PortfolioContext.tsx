import { createContext, useContext, ReactNode, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";

interface PortfolioCard {
  id: string;
  cardId: string;
  cardName: string;
  setName: string;
  cardNumber?: string | null;
  imageUrl: string;
  quantity: number;
  purchasePrice: string;
  currentPrice: string;
  lastUpdated?: string | Date | null;
}

type AddCardInput = Omit<PortfolioCard, "id" | "purchasePrice" | "currentPrice"> & {
  purchasePrice: number;
  currentPrice: number;
};

interface PortfolioContextType {
  portfolioCards: PortfolioCard[];
  isLoading: boolean;
  addCard: (card: AddCardInput) => Promise<void>;
  updateQuantity: (id: string, quantity: number) => Promise<void>;
  updatePurchasePrice: (id: string, purchasePrice: number) => Promise<void>;
  removeCard: (id: string) => Promise<void>;
  refreshPrices: () => Promise<void>;
}

const PortfolioContext = createContext<PortfolioContextType | undefined>(undefined);

export function PortfolioProvider({ children }: { children: ReactNode }) {
  const { data: portfolioCards = [], isLoading } = useQuery<PortfolioCard[]>({
    queryKey: ['/api/portfolio'],
    staleTime: 24 * 60 * 60 * 1000,
  });

  type CreateCardPayload = Omit<PortfolioCard, "id" | "purchasePrice" | "currentPrice"> & {
    purchasePrice: number | string;
    currentPrice: number | string;
  };
  
  type UpdateCardPayload = {
    quantity?: number;
    purchasePrice?: number | string;
    currentPrice?: number | string;
    cardNumber?: string | null;
  };

  const addMutation = useMutation({
    mutationFn: async (card: CreateCardPayload) => {
      return await apiRequest('POST', '/api/portfolio', card);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string, data: UpdateCardPayload }) => {
      return await apiRequest('PATCH', `/api/portfolio/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return await apiRequest('DELETE', `/api/portfolio/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/portfolio'] });
    },
  });

  const addCard = async (card: AddCardInput) => {
    await addMutation.mutateAsync({
      ...card,
      purchasePrice: card.purchasePrice,
      currentPrice: card.currentPrice,
    });
  };

  const updateQuantity = async (id: string, quantity: number) => {
    await updateMutation.mutateAsync({ id, data: { quantity } });
  };

  const updatePurchasePrice = async (id: string, purchasePrice: number) => {
    await updateMutation.mutateAsync({ id, data: { purchasePrice } });
  };

  const removeCard = async (id: string) => {
    await deleteMutation.mutateAsync(id);
  };

  const refreshPrices = async () => {
    if (!portfolioCards.length) return;

    const now = Date.now();
    const BATCH_SIZE = 3;
    const BATCH_DELAY_MS = 500;

    const priceUpdates: ({ id: string; price: number | null } | null)[] = [];

    // Process cards in small batches to avoid rate limiting
    for (let i = 0; i < portfolioCards.length; i += BATCH_SIZE) {
      const batch = portfolioCards.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.all(
        batch.map(async (card) => {
          try {
            const response = await apiRequest('POST', `/api/cards/${card.cardId}/refresh`);
            const data = await response.json();
            queryClient.setQueryData(['/api/cards', card.cardId], data, { updatedAt: now });
            const price = Number(data.price);
            return { id: card.id, price: isNaN(price) ? null : price };
          } catch (error) {
            console.error(`Failed to refresh price for ${card.cardName}:`, error);
            return null;
          }
        })
      );
      priceUpdates.push(...batchResults);

      // Delay between batches (skip after the last batch)
      if (i + BATCH_SIZE < portfolioCards.length) {
        await new Promise(r => setTimeout(r, BATCH_DELAY_MS));
      }
    }

    const validUpdates = priceUpdates.filter((u): u is { id: string; price: number } =>
      u !== null && u.price !== null && u.price !== undefined && !isNaN(u.price)
    );

    if (validUpdates.length === 0) {
      throw new Error('Failed to refresh any card prices.');
    }

    // Update portfolio card prices in batches too
    for (let i = 0; i < validUpdates.length; i += BATCH_SIZE) {
      const batch = validUpdates.slice(i, i + BATCH_SIZE);
      await Promise.all(
        batch.map(update =>
          apiRequest('PATCH', `/api/portfolio/${update.id}`, { currentPrice: update.price })
        )
      );
    }
    queryClient.invalidateQueries({ queryKey: ['/api/portfolio'] });

    // Calculate total portfolio value using fresh prices where available,
    // falling back to existing prices for cards that failed to refresh
    const updatedPriceMap = new Map(validUpdates.map(u => [u.id, u.price]));
    const totalValue = portfolioCards.reduce((sum, card) => {
      const price = updatedPriceMap.get(card.id) ?? parseFloat(card.currentPrice);
      return sum + card.quantity * price;
    }, 0);

    // Record total portfolio value in history using fresh prices
    await apiRequest('POST', '/api/portfolio-value/record', { totalValue });
    queryClient.invalidateQueries({ queryKey: ['/api/portfolio-value-history'] });

    if (typeof window !== 'undefined') {
      localStorage.setItem('portfolio_last_price_refresh', now.toString());
    }

    // Throw for partial failure so the UI can show an appropriate message
    if (validUpdates.length < portfolioCards.length) {
      const failed = portfolioCards.length - validUpdates.length;
      throw new Error(`${failed} card(s) failed to refresh, but ${validUpdates.length} succeeded. Portfolio value was still recorded.`);
    }
  };

  // Automatic price refresh disabled - prices only update when user clicks "Refresh Prices" button
  // useEffect(() => {
  //   if (typeof window === 'undefined') return;
  //   
  //   const lastRefresh = parseInt(localStorage.getItem('portfolio_last_price_refresh') || '0', 10);
  //   const now = Date.now();
  //   const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;
  //   
  //   if (portfolioCards.length > 0 && (now - lastRefresh) > TWENTY_FOUR_HOURS) {
  //     refreshPrices();
  //   }
  // }, [portfolioCards.length]);

  return (
    <PortfolioContext.Provider value={{ portfolioCards, isLoading, addCard, updateQuantity, updatePurchasePrice, removeCard, refreshPrices }}>
      {children}
    </PortfolioContext.Provider>
  );
}

export function usePortfolio() {
  const context = useContext(PortfolioContext);
  if (context === undefined) {
    throw new Error("usePortfolio must be used within a PortfolioProvider");
  }
  return context;
}
