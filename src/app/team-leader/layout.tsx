"use client";

import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUser, useOrganization } from "@clerk/nextjs";
import { useClerkRole } from "@/lib/clerkRoles";
import Sidebar from "@/components/tl/Sidebar";

export default function TeamLeaderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isLoaded: isUserLoaded } = useUser();
  const { organization, isLoaded: isOrgLoaded } = useOrganization();
  const { isAdmin, isLoading: isRoleLoading, appRole, organizationSlug, organizationName } = useClerkRole();

  const isLoading = !isUserLoaded || isRoleLoading;

  React.useEffect(() => {
    if (isLoading) return;

    if (!user) {
      router.replace("/login");
    } else if (!isAdmin) {
      if (appRole === "jl") {
        router.replace("/junior-leader");
      } else {
        router.replace("/team-member");
      }
    }
  }, [isLoading, user, isAdmin, appRole, router]);

  // Wait for Clerk and Role verification to load
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Not logged in - redirect to login
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        Redirecting to login...
      </div>
    );
  }

  // User is not an admin (teamleader / CEO) - redirect to dashboard
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        Redirecting to your dashboard...
      </div>
    );
  }

  // Create user object for components that need it
  const userInfo = {
    name: user.fullName || user.firstName || "Team Leader",
    code: user.emailAddresses[0]?.emailAddress || "",
    email: user.emailAddresses[0]?.emailAddress || "",
    role: "teamleader",
    organizationName: organizationName || organization?.name || "Organization",
    organizationSlug: organizationSlug || organization?.slug || undefined,
  };

  return (
    <div className="h-screen bg-slate-50 text-slate-900 overflow-hidden">
      <div className="flex h-full">
        <Sidebar user={userInfo} />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
