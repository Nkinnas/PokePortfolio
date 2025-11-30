import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Pencil } from "lucide-react";

interface EditPurchasePriceDialogProps {
  cardName: string;
  currentPurchasePrice: number;
  onUpdate: (newPrice: number) => void;
}

export default function EditPurchasePriceDialog({
  cardName,
  currentPurchasePrice,
  onUpdate,
}: EditPurchasePriceDialogProps) {
  const [open, setOpen] = useState(false);
  const [purchasePrice, setPurchasePrice] = useState(currentPurchasePrice.toFixed(2));

  const handleUpdate = () => {
    const price = parseFloat(purchasePrice);
    
    if (price >= 0) {
      onUpdate(price);
      setOpen(false);
    }
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setPurchasePrice(currentPurchasePrice.toFixed(2));
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          data-testid="button-edit-price"
        >
          <Pencil className="h-3 w-3" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Edit Purchase Price</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Update the purchase price for <span className="font-semibold">{cardName}</span>
          </p>
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
                data-testid="input-edit-purchase-price"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleUpdate();
                  }
                }}
              />
            </div>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => setOpen(false)} className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleUpdate} className="flex-1" data-testid="button-confirm-edit">
            Update Price
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
