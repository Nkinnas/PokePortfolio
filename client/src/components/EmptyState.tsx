import { Search, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  type: "search" | "portfolio";
  onAction?: () => void;
}

export default function EmptyState({ type, onAction }: EmptyStateProps) {
  if (type === "search") {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
        <div className="rounded-full bg-muted p-6 mb-4">
          <Search className="h-12 w-12 text-muted-foreground" />
        </div>
        <h3 className="text-xl font-semibold mb-2">Search for Pokémon Cards</h3>
        <p className="text-muted-foreground max-w-md">
          Enter a card name, set, or Pokémon to find cards and view their current market prices
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-muted p-6 mb-4">
        <Wallet className="h-12 w-12 text-muted-foreground" />
      </div>
      <h3 className="text-xl font-semibold mb-2">Your Collection is Empty</h3>
      <p className="text-muted-foreground max-w-md mb-6">
        Start building your portfolio by searching for cards and adding them to your collection
      </p>
      {onAction && (
        <Button onClick={onAction} data-testid="button-start-searching">
          Start Searching
        </Button>
      )}
    </div>
  );
}
