import { Card, CardContent } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

interface PortfolioSummaryProps {
  totalValue: number;
  totalCost: number;
}

export default function PortfolioSummary({
  totalValue,
  totalCost,
}: PortfolioSummaryProps) {
  const profitLoss = totalValue - totalCost;
  const percentChange = totalCost > 0 ? (profitLoss / totalCost) * 100 : 0;
  const isPositive = profitLoss >= 0;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div
        style={{
          transform: "skewX(-15deg)",
          overflow: "hidden",
        }}
        className="min-h-full"
      >
        <Card className="h-full bg-muted text-muted-foreground">
          <CardContent className="pt-6 px-6 pb-6">
            <div className="space-y-2 text-center" style={{ transform: "skewX(15deg)" }}>
              <p className="text-sm">Portfolio Value</p>
              <p
                className="text-3xl font-bold font-mono break-words text-black"
                data-testid="text-total-value"
              >
                ${totalValue.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div
        style={{
          transform: "skewX(-15deg)",
          overflow: "hidden",
        }}
        className="min-h-full"
      >
        <Card className="h-full bg-muted text-muted-foreground">
          <CardContent className="pt-6 px-6 pb-6">
            <div className="space-y-2 text-center" style={{ transform: "skewX(15deg)" }}>
              <p className="text-sm">Amount Invested</p>
              <p
                className="text-3xl font-bold font-mono break-words text-black"
                data-testid="text-cost-basis"
              >
                ${totalCost.toFixed(2)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div
        style={{
          transform: "skewX(-15deg)",
          overflow: "hidden",
        }}
        className="min-h-full"
      >
        <Card className="h-full bg-muted text-muted-foreground">
          <CardContent className="pt-6 px-6 pb-6">
            <div className="space-y-2 text-center" style={{ transform: "skewX(15deg)" }}>
              <p className="text-sm">Profit/Loss</p>
              <div className="flex items-center gap-2 flex-wrap justify-center">
                {isPositive ? (
                  <TrendingUp className="h-6 w-6 text-green-600 flex-shrink-0" />
                ) : (
                  <TrendingDown className="h-6 w-6 text-red-600 flex-shrink-0" />
                )}
                <div className="min-w-0">
                  <p
                    className={`text-3xl font-bold font-mono break-words text-center ${
                      isPositive ? "text-green-600" : "text-red-600"
                    }`}
                    data-testid="text-profit-loss"
                  >
                    {isPositive ? "+" : ""}${Math.abs(profitLoss).toFixed(2)}
                  </p>
                  <p
                    className={`text-sm font-semibold text-center ${
                      isPositive ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {isPositive ? "+" : ""}
                    {percentChange.toFixed(2)}%
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
