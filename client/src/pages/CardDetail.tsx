import { useRoute } from "wouter";
import { ArrowLeft, Plus, Minus, Trash2, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import PriceChart from "@/components/PriceChart";
import AddToPortfolioDialog from "@/components/AddToPortfolioDialog";
import EditPurchasePriceDialog from "@/components/EditPurchasePriceDialog";
import LoadingSpinner from "@/components/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";
import { usePortfolio } from "@/lib/PortfolioContext";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { safeParsePrice } from "@/lib/priceUtils";
import { formatDistanceToNow } from "date-fns";

interface CardData {
  id: string;
  name: string;
  setName: string;
  cardNumber: string;
  imageUrl: string;
  price: number;
  lastUpdated?: string;
}

export default function CardDetail() {
  const [, params] = useRoute("/card/:id");
  const { toast } = useToast();
  const { portfolioCards, addCard, updateQuantity, updatePurchasePrice, removeCard } = usePortfolio();
  const cardId = params?.id || "";
  
  // Check if this card is already in the portfolio
  const portfolioCard = portfolioCards.find(card => card.cardId === cardId);

  const { data: cardData, isLoading } = useQuery<CardData>({
    queryKey: ['/api/cards', cardId],
    enabled: !!cardId,
    staleTime: 24 * 60 * 60 * 1000,
  });

  const refreshMutation = useMutation({
    mutationFn: async (cardId: string) => {
      const res = await apiRequest('POST', `/api/cards/${cardId}/refresh`);
      return await res.json() as CardData;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['/api/cards', cardId], data);
      toast({
        title: "Price Refreshed",
        description: "Card price has been updated from the latest market data",
      });
    },
    onError: () => {
      toast({
        title: "Refresh Failed",
        description: "Failed to refresh card price. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <LoadingSpinner />
      </div>
    );
  }

  if (!cardData) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <p>Card not found</p>
      </div>
    );
  }

  const handleAddToPortfolio = (quantity: number, purchasePrice: number) => {
    console.log("Adding to portfolio:", { quantity, purchasePrice });
    
    addCard({
      cardId: cardData.id,
      cardName: cardData.name,
      setName: cardData.setName,
      cardNumber: cardData.cardNumber,
      imageUrl: cardData.imageUrl,
      quantity,
      purchasePrice,
      currentPrice: cardData.price,
    });
    
    toast({
      title: "Added to Portfolio",
      description: `${quantity}x ${cardData.name} added to your collection`,
    });
  };

  const handleQuantityChange = async (newQuantity: number) => {
    if (!portfolioCard || newQuantity < 1) return;
    
    try {
      await updateQuantity(portfolioCard.id, newQuantity);
      // Explicitly refetch to ensure UI is in sync
      await queryClient.invalidateQueries({ queryKey: ['/api/portfolio'] });
      
      toast({
        title: "Quantity Updated",
        description: `Updated to ${newQuantity} card${newQuantity > 1 ? 's' : ''}`,
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update quantity. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handlePurchasePriceChange = async (newPrice: number) => {
    if (!portfolioCard) return;
    
    try {
      await updatePurchasePrice(portfolioCard.id, newPrice);
      // Explicitly refetch to ensure UI is in sync
      await queryClient.invalidateQueries({ queryKey: ['/api/portfolio'] });
      
      toast({
        title: "Purchase Price Updated",
        description: `Updated to $${newPrice.toFixed(2)}`,
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Failed to update purchase price. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleRemove = async () => {
    if (!portfolioCard) return;
    
    try {
      await removeCard(portfolioCard.id);
      // Explicitly refetch to ensure UI is in sync
      await queryClient.invalidateQueries({ queryKey: ['/api/portfolio'] });
      
      toast({
        title: "Removed from Portfolio",
        description: `${cardData.name} has been removed from your collection`,
        variant: "destructive",
      });
    } catch (error) {
      toast({
        title: "Remove Failed",
        description: "Failed to remove card. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <Link href="/">
        <Button variant="ghost" className="mb-6 gap-2" data-testid="button-back">
          <ArrowLeft className="h-4 w-4" />
          Back to Search
        </Button>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div>
          <Card>
            <CardContent className="p-6">
              <img
                src={cardData.imageUrl}
                alt={`${cardData.name} from ${cardData.setName}`}
                className="w-full max-w-md mx-auto rounded-lg shadow-lg"
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <div>
            <h1 className="text-4xl font-display font-bold mb-2" data-testid="text-card-name">
              {cardData.name}
            </h1>
            <p className="text-lg text-muted-foreground">
              {cardData.setName} • #{cardData.cardNumber}
            </p>
          </div>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Current Market Price</p>
                  <p className="text-5xl font-bold font-mono" data-testid="text-current-price">
                    ${cardData.price.toFixed(2)}
                  </p>
                  {cardData.lastUpdated && (
                    <p className="text-xs text-muted-foreground mt-2" data-testid="text-last-updated">
                      Updated {formatDistanceToNow(new Date(cardData.lastUpdated), { addSuffix: true })}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => refreshMutation.mutate(cardId)}
                  disabled={refreshMutation.isPending}
                  data-testid="button-refresh-price"
                  title="Refresh price from API"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
                </Button>
              </div>
              
              {portfolioCard ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleQuantityChange(portfolioCard.quantity - 1)}
                      disabled={portfolioCard.quantity <= 1}
                      data-testid="button-decrease-quantity"
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Badge className="bg-secondary text-secondary-foreground px-4 py-2 text-base">
                      Quantity: {portfolioCard.quantity}
                    </Badge>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => handleQuantityChange(portfolioCard.quantity + 1)}
                      data-testid="button-increase-quantity"
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Purchase Price</p>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold font-mono text-lg">
                          ${safeParsePrice(portfolioCard.purchasePrice).toFixed(2)}
                        </p>
                        <EditPurchasePriceDialog
                          cardName={cardData.name}
                          currentPurchasePrice={safeParsePrice(portfolioCard.purchasePrice)}
                          onUpdate={handlePurchasePriceChange}
                        />
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground mb-1">Total Value</p>
                      <p className="font-semibold font-mono text-lg" data-testid="text-total-value">
                        ${(portfolioCard.quantity * cardData.price).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="pt-4 border-t">
                    <p className="text-xs text-muted-foreground mb-2">Gain/Loss</p>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const purchasePriceNum = safeParsePrice(portfolioCard.purchasePrice);
                        const currentPriceNum = cardData.price;
                        const totalCost = portfolioCard.quantity * purchasePriceNum;
                        const totalValue = portfolioCard.quantity * currentPriceNum;
                        const profitLoss = totalValue - totalCost;
                        const percentChange = totalCost > 0 ? ((profitLoss / totalCost) * 100) : 0;
                        const isPositive = profitLoss >= 0;
                        
                        return (
                          <>
                            {isPositive ? (
                              <TrendingUp className="h-5 w-5 text-green-600" />
                            ) : (
                              <TrendingDown className="h-5 w-5 text-red-600" />
                            )}
                            <p
                              className={`font-bold font-mono text-2xl ${
                                isPositive ? "text-green-600" : "text-red-600"
                              }`}
                              data-testid="text-gain-loss"
                            >
                              {isPositive ? "+" : ""}${Math.abs(profitLoss).toFixed(2)}
                            </p>
                            <p
                              className={`text-lg ${
                                isPositive ? "text-green-600" : "text-red-600"
                              }`}
                            >
                              ({isPositive ? "+" : ""}{percentChange.toFixed(1)}%)
                            </p>
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  <Button
                    variant="destructive"
                    className="w-full gap-2"
                    onClick={handleRemove}
                    data-testid="button-remove-from-portfolio"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove from Portfolio
                  </Button>
                </div>
              ) : (
                <AddToPortfolioDialog
                  cardName={cardData.name}
                  currentPrice={cardData.price}
                  onAdd={handleAddToPortfolio}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <PriceChart cardId={cardData.id} currentPrice={cardData.price} />
    </div>
  );
}
