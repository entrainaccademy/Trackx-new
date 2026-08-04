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
  const [dbUser, setDbUser] = React.useState<any>(null);
  const [checkingDbUser, setCheckingDbUser] = React.useState(true);

  React.useEffect(() => {
    let isCancelled = false;

    const verifySession = async () => {
      // 1. If Clerk user is present, use Clerk session
      if (user) {
        setCheckingDbUser(false);
        return;
      }

      // 2. Check for cookie / localStorage email for credential login
      try {
        let savedEmail: string | null = null;
        if (typeof window !== "undefined") {
          savedEmail = localStorage.getItem("trackx_user_email");
          if (!savedEmail) {
            const match = document.cookie.match(/trackx_user_email=([^;]+)/);
            if (match && match[1]) {
              savedEmail = decodeURIComponent(match[1]).trim();
            }
          }
        }

        if (savedEmail) {
          const res = await fetch(`/api/users/current?identifier=${encodeURIComponent(savedEmail)}`);
          if (res.ok) {
            const data = await res.json();
            if (data?.success && data?.user && !isCancelled) {
              setDbUser(data.user);
            }
          }
        }
      } catch (err) {
        console.warn("Error verifying cookie session in TeamLeaderLayout:", err);
      } finally {
        if (!isCancelled) setCheckingDbUser(false);
      }
    };

    if (isUserLoaded && !isRoleLoading) {
      verifySession();
    }

    return () => {
      isCancelled = true;
    };
  }, [user, isUserLoaded, isRoleLoading]);

  const isLoading = !isUserLoaded || isRoleLoading || checkingDbUser;

  // Determine effective admin status
  const dbRoleLower = String(dbUser?.role || "").toLowerCase();
  const isDbAdmin = dbRoleLower === "teamleader" || dbRoleLower === "ceo" || dbRoleLower === "admin" || dbRoleLower === "owner";
  const effectiveIsAdmin = Boolean(user ? isAdmin : isDbAdmin);
  const effectiveAppRole = user ? appRole : (isDbAdmin ? "teamleader" : (dbRoleLower === "jl" ? "jl" : "sales"));
  const hasUserSession = Boolean(user || dbUser);

  React.useEffect(() => {
    if (isLoading) return;

    if (!hasUserSession) {
      router.replace("/login");
    } else if (!effectiveIsAdmin) {
      if (effectiveAppRole === "jl") {
        router.replace("/junior-leader");
      } else {
        router.replace("/team-member");
      }
    }
  }, [isLoading, hasUserSession, effectiveIsAdmin, effectiveAppRole, router]);

  // Wait for session and role verification
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
  if (!hasUserSession) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        Redirecting to login...
      </div>
    );
  }

  // User is not an admin (teamleader / CEO) - redirect to dashboard
  if (!effectiveIsAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-600">
        Redirecting to your dashboard...
      </div>
    );
  }

  // Create user object for components that need it
  const userInfo = {
    name: user?.fullName || user?.firstName || dbUser?.name || "Team Leader",
    code: user?.emailAddresses[0]?.emailAddress || dbUser?.code || dbUser?.email || "",
    email: user?.emailAddresses[0]?.emailAddress || dbUser?.email || "",
    role: "teamleader",
    organizationName: organizationName || organization?.name || dbUser?.tenantSubdomain || "Organization",
    organizationSlug: organizationSlug || organization?.slug || dbUser?.tenantSubdomain || undefined,
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
