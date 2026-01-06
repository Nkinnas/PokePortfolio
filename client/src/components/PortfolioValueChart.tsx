import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ValueDataPoint {
  date: string;
  value: number;
}

interface PortfolioValueChartProps {
  currentValue: number;
}

type TimeRange = "7d" | "30d" | "90d" | "all";

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

export default function PortfolioValueChart({ currentValue }: PortfolioValueChartProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>("30d");
  
  // Fetch real portfolio value history
  const { data: valueHistory = [], isPending } = useQuery<ValueDataPoint[]>({
    queryKey: [timeRange === "all" ? '/api/portfolio-value-history?days=all' : '/api/portfolio-value-history'],
  });
  
  // Show loading only while fetching and before we have any result (success or error)
  if (isPending) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Portfolio Value History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <p className="text-muted-foreground">Loading value history...</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const days = timeRange === "7d" ? 7 : timeRange === "30d" ? 30 : 90;
  
  // Filter data based on selected time range
  const data = timeRange === "all" ? valueHistory : valueHistory.slice(-days);
  
  // Show message if no data
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Portfolio Value History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-center justify-center">
            <p className="text-muted-foreground">No value history available yet. Click "Refresh Prices" to start tracking!</p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const values = data.map((d) => d.value);
  const lowestValue = Math.min(...values);
  const highestValue = Math.max(...values);
  const oldestValue = data[0]?.value || currentValue;
  const valueChange = currentValue - oldestValue;
  const percentChange = ((valueChange / oldestValue) * 100).toFixed(2);
  const isPositive = valueChange >= 0;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="font-display">Portfolio Value History</CardTitle>
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
            <Button
              variant={timeRange === "all" ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange("all")}
              data-testid="button-all"
              style={{ 
                transform: 'skewX(-15deg)',
                overflow: 'hidden'
              }}
            >
              <span style={{ transform: 'skewX(15deg)', display: 'inline-block' }}>All</span>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => formatDateShort(value)}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `$${value.toFixed(0)}`}
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
                dataKey="value"
                stroke="hsl(var(--primary))"
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Lowest ({timeRange})</p>
            <p className="text-xl font-semibold font-mono" data-testid="text-lowest-value">
              ${lowestValue.toFixed(2)}
            </p>
          </div>
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">Highest ({timeRange})</p>
            <p className="text-xl font-semibold font-mono" data-testid="text-highest-value">
              ${highestValue.toFixed(2)}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
