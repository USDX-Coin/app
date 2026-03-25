"use client";

import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

export default function ProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center p-12 text-center max-w-2xl mx-auto">
      <AlertCircle className="h-12 w-12 text-destructive mb-4" />
      <h2 className="text-lg font-semibold mb-2">Failed to load profile</h2>
      <p className="text-sm text-muted-foreground mb-6 max-w-md">
        {error.message || "Could not load your profile information."}
      </p>
      <Button onClick={reset}>Try Again</Button>
    </div>
  );
}
