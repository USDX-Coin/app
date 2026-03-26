"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { toast } from "sonner";

export function AddRecipientDialog() {
  const [open, setOpen] = useState(false);
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountHolder, setAccountHolder] = useState("");

  function handleSave() {
    if (!bankName || !accountNumber || !accountHolder) {
      toast.error("Please fill all fields");
      return;
    }
    toast.success(`Recipient "${accountHolder}" added`);
    setBankName("");
    setAccountNumber("");
    setAccountHolder("");
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="w-full mt-2 gap-1.5">
          <Plus className="h-4 w-4" />
          Add New Recipient
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-sm bg-white">
        <DialogHeader>
          <DialogTitle>Add New Recipient</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="bankName">Bank Name</Label>
            <Input
              id="bankName"
              placeholder="e.g. Chase, Bank of America"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="accountNumber">Account Number</Label>
            <Input
              id="accountNumber"
              placeholder="Enter account number"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="accountHolder">Account Holder</Label>
            <Input
              id="accountHolder"
              placeholder="Enter account holder name"
              value={accountHolder}
              onChange={(e) => setAccountHolder(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <Button
            onClick={handleSave}
            className="w-full bg-gradient-to-r from-primary to-primary-600 hover:from-primary-600 hover:to-primary-700"
          >
            Save Recipient
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
