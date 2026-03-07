import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search, ChevronDown, ChevronRight } from "lucide-react";
import LoadingSpinner from "@/components/LoadingSpinner";
import { apiRequest } from "@/lib/queryClient";
import backgroundImage from "@assets/DEA1iygXsAAg7vC_1763675710877.jpg";

interface Expansion {
  id: string;
  name: string;
  series: string;
  total: number;
  printed_total: number;
  release_date: string;
  logo: string;
  symbol: string;
}

interface ExpansionsResponse {
  expansions: Expansion[];
  page: number;
  pageSize: number;
  totalCount: number;
}

async function fetchAllExpansions(): Promise<Expansion[]> {
  const first = await apiRequest('GET', '/api/expansions?page=1&pageSize=100');
  const firstData: ExpansionsResponse = await first.json();
  const all = [...firstData.expansions];
  const totalPages = Math.ceil(firstData.totalCount / 100);

  for (let page = 2; page <= totalPages; page++) {
    const res = await apiRequest('GET', `/api/expansions?page=${page}&pageSize=100`);
    const data: ExpansionsResponse = await res.json();
    all.push(...data.expansions);
  }

  return all;
}

export default function Sets() {
  const [, setLocation] = useLocation();
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const { data: expansions = [], isLoading } = useQuery<Expansion[]>({
    queryKey: ['/api/expansions/all'],
    queryFn: fetchAllExpansions,
    staleTime: 7 * 24 * 60 * 60 * 1000,
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return expansions;
    const q = search.trim().toLowerCase();
    return expansions.filter(e =>
      e.name.toLowerCase().startsWith(q) ||
      e.series.toLowerCase().startsWith(q) ||
      e.name.toLowerCase().includes(q)
    );
  }, [expansions, search]);

  // Group by series, preserving order (newest first since API returns -release_date)
  const grouped = useMemo(() => {
    const map = new Map<string, Expansion[]>();
    for (const exp of filtered) {
      const group = map.get(exp.series);
      if (group) group.push(exp);
      else map.set(exp.series, [exp]);
    }
    return Array.from(map.entries());
  }, [filtered]);

  const toggleSeries = (series: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(series)) next.delete(series);
      else next.add(series);
      return next;
    });
  };

  return (
    <div className="relative min-h-[calc(100vh-4rem)]">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      />
      <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px]" />

      <div className="relative container mx-auto px-4 py-8 max-w-7xl">
        <h1 className="text-4xl font-display font-bold mb-4">Browse Sets</h1>

        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {isLoading && <LoadingSpinner />}

        {!isLoading && (
          <>
            {filtered.length === 0 && search.trim() && (
              <p className="text-muted-foreground text-center py-8">No sets matching "{search}"</p>
            )}

            <div className="space-y-6">
              {grouped.map(([series, sets]) => (
                <div key={series}>
                  <button
                    onClick={() => toggleSeries(series)}
                    className="flex items-center gap-2 mb-3 hover:opacity-80 transition-opacity"
                  >
                    {collapsed.has(series) ? (
                      <ChevronRight className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                    )}
                    <h2 className="text-2xl font-display font-bold">{series}</h2>
                    <span className="text-sm text-muted-foreground">({sets.length} sets)</span>
                  </button>

                  {!collapsed.has(series) && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                      {sets.map((expansion) => (
                        <Card
                          key={expansion.id}
                          className="cursor-pointer hover-elevate active-elevate-2 transition-all duration-200 overflow-hidden"
                          onClick={() => setLocation(`/sets/${expansion.id}`)}
                        >
                          <CardContent className="p-4 flex flex-col items-center text-center">
                            <div className="h-20 flex items-center justify-center mb-3">
                              <img
                                src={expansion.logo}
                                alt={expansion.name}
                                className="max-h-full max-w-full object-contain"
                                loading="lazy"
                              />
                            </div>
                            <h3 className="font-semibold text-sm line-clamp-2 mb-1">{expansion.name}</h3>
                            <p className="text-xs text-muted-foreground mt-1">{expansion.total} cards</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
