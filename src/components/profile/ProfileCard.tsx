"use client";

import { useAuthStore } from "@/stores/authStore";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { ShieldCheck, Mail, User, Calendar, Wallet, Bell, Lock } from "lucide-react";

export function ProfileCard() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold text-primary">Profile</h1>

      {/* Personal Information */}
      <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold">Personal Information</h2>
          <Badge
            variant="secondary"
            className="bg-primary/10 text-primary flex items-center gap-1"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            {user?.isVerified ? "Verified" : "Pending"}
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-start gap-3">
            <User className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Full Name</p>
              <p className="text-sm font-medium">{user?.fullName ?? "-"}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium">{user?.email ?? "-"}</p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Calendar className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">Member Since</p>
              <p className="text-sm font-medium">
                {user?.createdAt ? formatDate(user.createdAt) : "-"}
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3">
            <Wallet className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div>
              <p className="text-xs text-muted-foreground">KYC Level</p>
              <p className="text-sm font-medium">Level 2 — Enhanced</p>
            </div>
          </div>
        </div>
      </div>

      {/* Security */}
      <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Lock className="h-4 w-4" />
          Security
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Two-Factor Authentication</p>
            <p className="text-sm font-medium text-green-600">Enabled (Authenticator App)</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last Login</p>
            <p className="text-sm font-medium">Today at 10:30 AM</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Password</p>
            <p className="text-sm font-medium">Last changed 30 days ago</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Login Notifications</p>
            <p className="text-sm font-medium">Email alerts enabled</p>
          </div>
        </div>
      </div>

      {/* Preferences */}
      <div className="rounded-2xl border border-border bg-white p-5 shadow-sm">
        <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
          <Bell className="h-4 w-4" />
          Preferences
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Email Notifications</p>
            <p className="text-sm font-medium">Transaction alerts, promotions</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Default Network</p>
            <p className="text-sm font-medium">Base</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Currency Display</p>
            <p className="text-sm font-medium">USD ($)</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Language</p>
            <p className="text-sm font-medium">English</p>
          </div>
        </div>
      </div>
    </div>
  );
}
