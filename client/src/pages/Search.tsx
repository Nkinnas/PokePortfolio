import { useState } from "react";
import { useLocation } from "wouter";
import SearchBar from "@/components/SearchBar";
import CardSearchResult from "@/components/CardSearchResult";
import EmptyState from "@/components/EmptyState";
import LoadingSpinner from "@/components/LoadingSpinner";
import { queryClient } from "@/lib/queryClient";
import backgroundImage from "@assets/DEA1iygXsAAg7vC_1763675710877.jpg";

interface CardData {
  id: string;
  name: string;
  setName: string;
  cardNumber: string;
  imageUrl: string;
  price: number;
}

export default function Search() {
  const [, setLocation] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<CardData[]>([]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    
    setIsSearching(true);
    
    try {
      const response = await fetch(`/api/cards/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      
      if (response.ok) {
        setSearchResults(data.cards);
        
        data.cards.forEach((card: CardData) => {
          queryClient.setQueryData(
            ['/api/cards', card.id],
            card,
            { updatedAt: Date.now() }
          );
        });
      } else {
        console.error("Search error:", data.error);
        setSearchResults([]);
      }
    } catch (error) {
      console.error("Failed to search cards:", error);
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleCardClick = (cardId: string) => {
    setLocation(`/card/${cardId}`);
  };

  const hasResults = searchResults.length > 0;
  const showCentered = !hasResults && !isSearching;

  return (
    <div className="relative min-h-[calc(100vh-4rem)]">
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: `url(${backgroundImage})` }}
      />
      <div className="absolute inset-0 bg-background/60 backdrop-blur-[2px]" />
      
      <div className="relative container mx-auto px-4 py-8 max-w-7xl min-h-[calc(100vh-4rem)]">
        <div className={showCentered ? "flex flex-col items-center justify-center min-h-[70vh]" : "mb-8"}>
          <h1 className={`font-display font-bold mb-6 ${showCentered ? "text-5xl md:text-6xl text-center" : "text-4xl"}`}>
            Search Pokémon Cards
          </h1>
          <div className={showCentered ? "w-full max-w-3xl" : "w-full"}>
            <SearchBar
              value={searchQuery}
              onChange={setSearchQuery}
              onSearch={handleSearch}
            />
          </div>
          {showCentered && (
            <p className="text-muted-foreground mt-4 text-center text-lg">
              Search by card name, set, or Pokémon
            </p>
          )}
        </div>

        {isSearching && <LoadingSpinner />}

        {!isSearching && searchResults.length === 0 && !showCentered && (
          <EmptyState type="search" />
        )}

        {!isSearching && searchResults.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {searchResults.map((card) => (
              <CardSearchResult
                key={card.id}
                {...card}
                onClick={() => handleCardClick(card.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
