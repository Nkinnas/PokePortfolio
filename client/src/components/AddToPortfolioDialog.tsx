import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";

interface AddToPortfolioDialogProps {
  cardName: string;
  currentPrice: number;
  onAdd: (quantity: number, purchasePrice: number) => void;
}

export default function AddToPortfolioDialog({
  cardName,
  currentPrice,
  onAdd,
}: AddToPortfolioDialogProps) {
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState("1");
  const [purchasePrice, setPurchasePrice] = useState(currentPrice.toFixed(2));

  const handleAdd = () => {
    const qty = parseInt(quantity);
    const price = parseFloat(purchasePrice);
    
    if (qty > 0 && price >= 0) {
      onAdd(qty, price);
      setOpen(false);
      setQuantity("1");
      setPurchasePrice(currentPrice.toFixed(2));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="lg" className="gap-2" data-testid="button-add-to-portfolio">
          <Plus className="h-5 w-5" />
          Add to Portfolio
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Add {cardName} to Portfolio</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              data-testid="input-quantity"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="purchasePrice">Purchase Price (per card)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="purchasePrice"
                type="number"
                min="0"
                step="0.01"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                className="pl-7"
                data-testid="input-purchase-price"
              />
            </div>
            <p className="text-sm text-muted-foreground">
              Current market price: ${currentPrice.toFixed(2)}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleAdd} className="flex-1" data-testid="button-confirm-add">
            Add to Portfolio
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
