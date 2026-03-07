import { useRoute, useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import CardSearchResult from "@/components/CardSearchResult";
import LoadingSpinner from "@/components/LoadingSpinner";
import { queryClient } from "@/lib/queryClient";
import { apiRequest } from "@/lib/queryClient";
import backgroundImage from "@assets/DEA1iygXsAAg7vC_1763675710877.jpg";

interface CardData {
  id: string;
  name: string;
  setName: string;
  cardNumber: string;
  imageUrl: string;
  price: number;
}

interface SetCardsResponse {
  cards: CardData[];
  page: number;
  pageSize: number;
  totalCount: number;
}

async function fetchAllCards(setId: string): Promise<{ cards: CardData[]; totalCount: number }> {
  const first = await apiRequest('GET', `/api/expansions/${setId}/cards?page=1&pageSize=100`);
  const firstData: SetCardsResponse = await first.json();
  const allCards = [...firstData.cards];
  const totalPages = Math.ceil(firstData.totalCount / 100);

  for (let page = 2; page <= totalPages; page++) {
    const res = await apiRequest('GET', `/api/expansions/${setId}/cards?page=${page}&pageSize=100`);
    const data: SetCardsResponse = await res.json();
    allCards.push(...data.cards);
  }

  // Sort by price descending (server already does this per page, but we need to re-sort combined)
  allCards.sort((a, b) => b.price - a.price);
  return { cards: allCards, totalCount: firstData.totalCount };
}

export default function SetDetail() {
  const [, params] = useRoute("/sets/:id");
  const [, setLocation] = useLocation();
  const setId = params?.id || "";

  const { data, isLoading } = useQuery({
    queryKey: [`/api/expansions/${setId}/all-cards`],
    queryFn: () => fetchAllCards(setId),
    enabled: !!setId,
    staleTime: 7 * 24 * 60 * 60 * 1000,
  });

  const cards = data?.cards || [];
  const totalCount = data?.totalCount || 0;
  const setName = cards[0]?.setName || setId;

  // Cache card data for detail page navigation
  if (cards.length > 0) {
    cards.forEach((card) => {
      queryClient.setQueryData(['/api/cards', card.id], card, { updatedAt: Date.now() });
    });
  }

  return (
    <div className="relative min-h-[calc(100vh-4rem)]">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      />
      <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px]" />

      <div className="relative container mx-auto px-4 py-8 max-w-7xl">
        <Link href="/sets">
          <Button variant="ghost" className="mb-6 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Sets
          </Button>
        </Link>

        <h1 className="text-4xl font-display font-bold mb-2">{setName}</h1>
        <p className="text-muted-foreground mb-8">{totalCount} cards</p>

        {isLoading && <LoadingSpinner />}

        {!isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {cards.map((card) => (
              <CardSearchResult
                key={card.id}
                {...card}
                onClick={() => setLocation(`/card/${card.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
