import { Construction } from "lucide-react";

export function ComingSoon({
  title,
  description = "This page is coming soon.",
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="flex h-full flex-col">
      <h1 className="text-xl font-medium tracking-tight text-foreground">{title}</h1>
      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Construction className="size-6" />
        </div>
        <p className="text-base font-medium text-foreground">Coming soon</p>
        <p className="max-w-xs text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
