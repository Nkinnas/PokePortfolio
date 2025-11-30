import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface CardSearchResultProps {
  id: string;
  name: string;
  setName: string;
  imageUrl: string;
  price: number;
  onClick: () => void;
}

export default function CardSearchResult({
  name,
  setName,
  imageUrl,
  price,
  onClick,
}: CardSearchResultProps) {
  return (
    <Card
      className="cursor-pointer hover-elevate active-elevate-2 transition-all duration-200 overflow-hidden"
      onClick={onClick}
      data-testid={`card-result-${name.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <CardContent className="p-4">
        <div className="aspect-[3/4] relative mb-3 rounded-md overflow-hidden bg-muted">
          <img
            src={imageUrl}
            alt={`${name} from ${setName}`}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        </div>
        <div className="space-y-2">
          <h3 className="font-semibold text-base line-clamp-1" data-testid="text-card-name">
            {name}
          </h3>
          <p className="text-sm text-muted-foreground line-clamp-1">{setName}</p>
          <div className="flex items-center justify-between">
            <div className="bg-primary/10 text-primary px-3 py-1 rounded-md font-mono font-semibold text-sm">
              ${price.toFixed(2)}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
