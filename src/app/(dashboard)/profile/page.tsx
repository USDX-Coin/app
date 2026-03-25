"use client";

import { useAuthStore } from "@/stores/authStore";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck } from "lucide-react";

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-primary mb-6">Profile</h1>

      <div className="rounded-2xl border border-border bg-white p-6 space-y-6">
        {/* Verification Badge */}
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Profile</h2>
          <Badge
            variant="secondary"
            className="bg-primary/10 text-primary flex items-center gap-1"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {user?.isVerified
              ? "Your Account Is Verified"
              : "Verification Pending"}
          </Badge>
        </div>

        {/* User Info */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-1">
              Full Name
            </h3>
            <p className="text-sm text-muted-foreground">
              {user?.fullName ?? "-"}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-1">
              Email
            </h3>
            <p className="text-sm text-muted-foreground">
              {user?.email ?? "-"}
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-1">
              Member Since
            </h3>
            <p className="text-sm text-muted-foreground">
              {user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString()
                : "-"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
