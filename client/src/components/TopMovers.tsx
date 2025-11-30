import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { safeParsePrice } from "@/lib/priceUtils";

interface PortfolioCard {
  id: string;
  cardName: string;
  setName: string;
  imageUrl: string;
  quantity: number;
  purchasePrice: string;
  currentPrice: string;
}

interface TopMoversProps {
  portfolioCards: PortfolioCard[];
  onCardClick: (cardId: string) => void;
}

export default function TopMovers({ portfolioCards, onCardClick }: TopMoversProps) {
  const cardsWithChange = portfolioCards.map(card => {
    const currentPrice = safeParsePrice(card.currentPrice);
    const purchasePrice = safeParsePrice(card.purchasePrice);
    const profitLoss = currentPrice - purchasePrice;
    const percentChange = purchasePrice > 0 ? ((profitLoss / purchasePrice) * 100) : 0;
    return { ...card, percentChange, profitLoss };
  });

  const topGainers = [...cardsWithChange]
    .filter(card => card.percentChange > 0)
    .sort((a, b) => b.percentChange - a.percentChange)
    .slice(0, 3);

  const topLosers = [...cardsWithChange]
    .filter(card => card.percentChange < 0)
    .sort((a, b) => a.percentChange - b.percentChange)
    .slice(0, 3);

  const MoverItem = ({ card, isGainer }: { card: typeof cardsWithChange[0], isGainer: boolean }) => (
    <div
      className="flex items-center gap-3 p-3 rounded-md hover-elevate active-elevate-2 cursor-pointer transition-all"
      onClick={() => onCardClick(card.id)}
    >
      <div className="w-12 h-16 flex-shrink-0 rounded overflow-hidden bg-muted">
        <img
          src={card.imageUrl}
          alt={card.cardName}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm line-clamp-1">{card.cardName}</p>
        <p className="text-xs text-muted-foreground line-clamp-1">{card.setName}</p>
      </div>
      <div className="text-right">
        <div className="flex items-center gap-1 justify-end">
          {isGainer ? (
            <TrendingUp className="h-4 w-4 text-green-600" />
          ) : (
            <TrendingDown className="h-4 w-4 text-red-600" />
          )}
          <p
            className={`font-semibold font-mono text-sm ${
              isGainer ? "text-green-600" : "text-red-600"
            }`}
          >
            {isGainer ? "+" : ""}{card.percentChange.toFixed(1)}%
          </p>
        </div>
        <p className={`text-xs font-mono ${isGainer ? "text-green-600" : "text-red-600"}`}>
          {isGainer ? "+" : ""}${card.profitLoss.toFixed(2)}
        </p>
      </div>
    </div>
  );

  if (portfolioCards.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {topGainers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2 text-green-600">
              <TrendingUp className="h-5 w-5" />
              Top Gainers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topGainers.map((card) => (
              <MoverItem key={card.id} card={card} isGainer={true} />
            ))}
            {topGainers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No gainers yet
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {topLosers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="font-display flex items-center gap-2 text-red-600">
              <TrendingDown className="h-5 w-5" />
              Top Losers
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topLosers.map((card) => (
              <MoverItem key={card.id} card={card} isGainer={false} />
            ))}
            {topLosers.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No losers yet
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
