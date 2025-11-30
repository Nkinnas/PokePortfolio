import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, TrendingDown, Plus, Minus, Trash2 } from "lucide-react";
import EditPurchasePriceDialog from "./EditPurchasePriceDialog";
import { safeParsePrice } from "@/lib/priceUtils";
import { formatDistanceToNow } from "date-fns";

interface PortfolioCardItemProps {
  id: string;
  name: string;
  setName: string;
  imageUrl: string;
  quantity: number;
  purchasePrice: string | number;
  currentPrice: string | number;
  lastUpdated?: string | Date | null;
  onQuantityChange: (newQuantity: number) => void;
  onPurchasePriceChange: (newPrice: number) => void;
  onRemove: () => void;
  onClick: () => void;
}

export default function PortfolioCardItem({
  name,
  setName,
  imageUrl,
  quantity,
  purchasePrice,
  currentPrice,
  lastUpdated,
  onQuantityChange,
  onPurchasePriceChange,
  onRemove,
  onClick,
}: PortfolioCardItemProps) {
  const purchasePriceNum = safeParsePrice(purchasePrice);
  const currentPriceNum = safeParsePrice(currentPrice);
  
  const totalCost = quantity * purchasePriceNum;
  const totalValue = quantity * currentPriceNum;
  const profitLoss = totalValue - totalCost;
  const percentChange = totalCost > 0 ? ((profitLoss / totalCost) * 100) : 0;
  const isPositive = profitLoss >= 0;

  return (
    <Card className="hover-elevate active-elevate-2 transition-all">
      <CardContent className="p-4">
        <div className="flex gap-4">
          <div
            className="w-24 h-32 flex-shrink-0 rounded-md overflow-hidden bg-muted cursor-pointer flex items-center justify-center"
            onClick={onClick}
          >
            <img
              src={imageUrl}
              alt={`${name} from ${setName}`}
              className="w-full h-full object-contain"
              loading="lazy"
            />
          </div>

          <div className="flex-1 min-w-0 space-y-3">
            <div>
              <div className="flex items-start justify-between gap-2 mb-1">
                <h3
                  className="font-semibold text-lg cursor-pointer hover:text-primary line-clamp-1"
                  onClick={onClick}
                  data-testid="text-card-name"
                >
                  {name}
                </h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onRemove}
                  className="flex-shrink-0"
                  data-testid="button-remove"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">{setName}</p>
              <div className="flex items-center gap-2 mt-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onQuantityChange(quantity - 1)}
                  disabled={quantity <= 1}
                  data-testid="button-decrease-quantity"
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <Badge className="bg-secondary text-secondary-foreground px-3">
                  Qty: {quantity}
                </Badge>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => onQuantityChange(quantity + 1)}
                  data-testid="button-increase-quantity"
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="group">
                <p className="text-xs text-muted-foreground mb-1">Purchase Price</p>
                <div className="flex items-center gap-1">
                  <p className="font-semibold font-mono">${purchasePriceNum.toFixed(2)}</p>
                  <EditPurchasePriceDialog
                    cardName={name}
                    currentPurchasePrice={purchasePriceNum}
                    onUpdate={onPurchasePriceChange}
                  />
                </div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Current Price</p>
                <p className="font-semibold font-mono">${currentPriceNum.toFixed(2)}</p>
                {lastUpdated && (
                  <p className="text-xs text-muted-foreground mt-1" data-testid="text-last-updated">
                    Updated {formatDistanceToNow(new Date(lastUpdated), { addSuffix: true })}
                  </p>
                )}
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Total Value</p>
                <p className="font-semibold font-mono" data-testid="text-total-value">
                  ${totalValue.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Gain/Loss</p>
                <div className="flex items-center gap-1">
                  {isPositive ? (
                    <TrendingUp className="h-3 w-3 text-green-600" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-600" />
                  )}
                  <p
                    className={`font-semibold font-mono text-sm ${
                      isPositive ? "text-green-600" : "text-red-600"
                    }`}
                    data-testid="text-gain-loss"
                  >
                    {isPositive ? "+" : ""}${Math.abs(profitLoss).toFixed(2)}
                  </p>
                  <p
                    className={`text-xs ${
                      isPositive ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    ({isPositive ? "+" : ""}{percentChange.toFixed(1)}%)
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
