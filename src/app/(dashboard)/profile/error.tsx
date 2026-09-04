"use client";

import { useEffect } from "react";
import { RouteErrorState } from "@/components/shared/RouteErrorState";

export default function ProfileError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // The raw message belongs in the console, never on the screen — see RouteErrorState.
  useEffect(() => {
    console.error(error);
  }, [error]);

  return <RouteErrorState titleKey="route.profile.title" descKey="route.profile.desc" reset={reset} />;
}
