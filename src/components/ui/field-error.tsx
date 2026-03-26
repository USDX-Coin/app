import { AlertCircle } from "lucide-react";

export function FieldError({ message }: { message?: string | null }) {
  return (
    <div className="min-h-[20px] mt-1">
      {message && (
        <p className="text-xs text-destructive flex items-center gap-1.5 animate-fade-in">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {message}
        </p>
      )}
    </div>
  );
}
