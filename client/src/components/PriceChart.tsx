import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";

interface PriceDataPoint {
  date: string;
  price: number;
}

interface PriceChartProps {
  cardId: string;
  currentPrice: number;
}

type TimeRange = "7d" | "30d" | "90d";

// Format date string (YYYY-MM-DD) without timezone conversion
function formatDateShort(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${monthNames[parseInt(month) - 1]} ${parseInt(day)}`;
}

function formatDateLong(dateStr: string): string {
  const [year, month, day] = dateStr.split('-');
  return `${parseInt(month)}/${parseInt(day)}/${year}`;
}

export default function PriceChart({ cardId, currentPrice }: PriceChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  
  // Fetch real price history
  const { data: priceHistory = [], isPending } = useQuery<PriceDataPoint[]>({
    queryKey: ['/api/price-history', cardId],
  });
  
  const getFilteredData = () => {
    const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
    return priceHistory.slice(-days);
  };

  const filteredData = getFilteredData();
  
  // Show loading while fetching
  if (isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Price History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <p className="text-muted-foreground">Loading price history...</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  // Show message if no data
  if (filteredData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Price History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <p className="text-muted-foreground">No price history available yet. Check back later!</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const prices = filteredData.map((d) => d.price);
  const lowestPrice = Math.min(...prices);
  const highestPrice = Math.max(...prices);
  const oldestPrice = filteredData[0]?.price || currentPrice;
  const priceChange = currentPrice - oldestPrice;
  const percentChange = ((priceChange / oldestPrice) * 100).toFixed(2);
  const isPositive = priceChange >= 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="font-display">Price History</CardTitle>
          <div className="flex gap-2">
            <Button
              variant={timeRange === "7d" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange("7d")}
              data-testid="button-7d"
              style={{ 
                transform: 'skewX(-15deg)',
                overflow: 'hidden'
              }}
            >
              <span style={{ transform: 'skewX(15deg)', display: 'inline-block' }}>7d</span>
            </Button>
            <Button
              variant={timeRange === "30d" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange("30d")}
              data-testid="button-30d"
              style={{ 
                transform: 'skewX(-15deg)',
                overflow: 'hidden'
              }}
            >
              <span style={{ transform: 'skewX(15deg)', display: 'inline-block' }}>30d</span>
            </Button>
            <Button
              variant={timeRange === "90d" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange("90d")}
              data-testid="button-90d"
              style={{ 
                transform: 'skewX(-15deg)',
                overflow: 'hidden'
              }}
            >
              <span style={{ transform: 'skewX(15deg)', display: 'inline-block' }}>90d</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={filteredData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => formatDateShort(value)}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `$${value}`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const value = payload[0].value;
                    const price = typeof value === 'number' ? value : 0;
                    return (
                      <div className="bg-popover border border-popover-border rounded-md p-3 shadow-lg">
                        <p className="text-sm font-medium">
                          ${price.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDateLong(payload[0].payload.date)}
                        </p>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="hsl(var(--primary))"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1 text-center">
            <p className="text-sm text-muted-foreground">Lowest</p>
            <p className="text-xl font-semibold font-mono" data-testid="text-lowest-price">
              ${lowestPrice.toFixed(2)}
            </p>
          </div>
          <div className="space-y-1 text-center">
            <p className="text-sm text-muted-foreground">Highest</p>
            <p className="text-xl font-semibold font-mono" data-testid="text-highest-price">
              ${highestPrice.toFixed(2)}
            </p>
          </div>
          <div className="space-y-1 text-center">
            <p className="text-sm text-muted-foreground">Change ({timeRange})</p>
            <div className="flex items-center justify-center gap-2">
              {isPositive ? (
                <TrendingUp className="h-5 w-5 text-green-600" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-600" />
              )}
              <p
                className={`text-xl font-semibold font-mono ${
                  isPositive ? "text-green-600" : "text-red-600"
                }`}
                data-testid="text-price-change"
              >
                {isPositive ? "+" : ""}{percentChange}%
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
