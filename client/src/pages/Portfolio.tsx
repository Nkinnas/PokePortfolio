import { useState } from "react";
import { useLocation } from "wouter";
import PortfolioSummary from "@/components/PortfolioSummary";
import PortfolioCardItem from "@/components/PortfolioCardItem";
import PortfolioValueChart from "@/components/PortfolioValueChart";
import EmptyState from "@/components/EmptyState";
import { usePortfolio } from "@/lib/PortfolioContext";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { safeParsePrice } from "@/lib/priceUtils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type SortOption = 
  | "total-value-desc"
  | "total-value-asc"
  | "profit-loss-desc"
  | "profit-loss-asc"
  | "name-asc"
  | "quantity-desc";

export default function Portfolio() {
  const [, setLocation] = useLocation();
  const [sortBy, setSortBy] = useState<SortOption>("total-value-desc");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { portfolioCards, isLoading, updateQuantity, updatePurchasePrice, removeCard, refreshPrices } = usePortfolio();
  const { toast } = useToast();

  const totalValue = portfolioCards.reduce(
    (sum, card) => sum + card.quantity * safeParsePrice(card.currentPrice),
    0
  );

  const totalCost = portfolioCards.reduce(
    (sum, card) => sum + card.quantity * safeParsePrice(card.purchasePrice),
    0
  );

  const getSortedCards = () => {
    const cards = [...portfolioCards];
    
    switch (sortBy) {
      case "total-value-desc":
        return cards.sort((a, b) => 
          (b.quantity * safeParsePrice(b.currentPrice)) - (a.quantity * safeParsePrice(a.currentPrice))
        );
      case "total-value-asc":
        return cards.sort((a, b) => 
          (a.quantity * safeParsePrice(a.currentPrice)) - (b.quantity * safeParsePrice(b.currentPrice))
        );
      case "profit-loss-desc":
        return cards.sort((a, b) => {
          const profitA = (safeParsePrice(a.currentPrice) - safeParsePrice(a.purchasePrice)) * a.quantity;
          const profitB = (safeParsePrice(b.currentPrice) - safeParsePrice(b.purchasePrice)) * b.quantity;
          return profitB - profitA;
        });
      case "profit-loss-asc":
        return cards.sort((a, b) => {
          const profitA = (safeParsePrice(a.currentPrice) - safeParsePrice(a.purchasePrice)) * a.quantity;
          const profitB = (safeParsePrice(b.currentPrice) - safeParsePrice(b.purchasePrice)) * b.quantity;
          return profitA - profitB;
        });
      case "name-asc":
        return cards.sort((a, b) => a.cardName.localeCompare(b.cardName));
      case "quantity-desc":
        return cards.sort((a, b) => b.quantity - a.quantity);
      default:
        return cards;
    }
  };

  const sortedCards = getSortedCards();
  
  const handleRefreshPrices = async () => {
    setIsRefreshing(true);
    try {
      await refreshPrices();
      toast({
        title: "Prices Updated",
        description: "All card prices have been refreshed successfully.",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Some prices could not be updated. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };
  
  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <h1 className="text-4xl font-display font-bold mb-8">
          My Portfolio
        </h1>
        <p>Loading your portfolio...</p>
      </div>
    );
  }

  if (portfolioCards.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <h1 className="text-4xl font-display font-bold mb-8">
          My Portfolio
        </h1>
        <EmptyState type="portfolio" onAction={() => setLocation("/")} />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h1 className="text-4xl font-display font-bold">
          My Portfolio
        </h1>
        <Button
          onClick={handleRefreshPrices}
          disabled={isRefreshing}
          className="bg-yellow-400 hover:bg-yellow-500 text-black w-full sm:w-auto sm:px-8"
          data-testid="button-refresh-prices"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'Refreshing...' : 'Refresh Prices'}
        </Button>
      </div>

      <div className="mb-8">
        <PortfolioSummary totalValue={totalValue} totalCost={totalCost} />
      </div>

      <div className="mb-8">
        <PortfolioValueChart currentValue={totalValue} />
      </div>

      <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="text-2xl font-display font-semibold">
            Your Cards ({portfolioCards.length})
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">Sort by:</span>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
              <SelectTrigger className="w-[200px]" data-testid="select-sort-by">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="total-value-desc">Total Value (High to Low)</SelectItem>
                <SelectItem value="total-value-asc">Total Value (Low to High)</SelectItem>
                <SelectItem value="profit-loss-desc">Profit/Loss (High to Low)</SelectItem>
                <SelectItem value="profit-loss-asc">Profit/Loss (Low to High)</SelectItem>
                <SelectItem value="name-asc">Card Name (A-Z)</SelectItem>
                <SelectItem value="quantity-desc">Quantity (High to Low)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        {sortedCards.map((card) => (
          <PortfolioCardItem
            key={card.id}
            id={card.id}
            name={card.cardName}
            setName={card.setName}
            imageUrl={card.imageUrl}
            quantity={card.quantity}
            purchasePrice={card.purchasePrice}
            currentPrice={card.currentPrice}
            lastUpdated={card.lastUpdated}
            onQuantityChange={(newQty) => updateQuantity(card.id, newQty)}
            onPurchasePriceChange={(newPrice) => updatePurchasePrice(card.id, newPrice)}
            onRemove={() => removeCard(card.id)}
            onClick={() => setLocation(`/card/${card.cardId}`)}
          />
        ))}
      </div>
    </div>
  );
}
