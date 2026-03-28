"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface AddRecipientDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddRecipientDialog({ open, onOpenChange }: AddRecipientDialogProps) {
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
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
