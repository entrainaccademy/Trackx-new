"use client";

import { useOrganization, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";

/**
 * Role mapping between Clerk organization roles and application roles
 * 
 * Clerk Organization Roles → Application Roles:
 * - org:admin → teamleader (Team Leader dashboard)
 * - org:member / salesExecutive → sales (Junior Leader/Salesperson dashboard)
 * 
 * Note: In Clerk, roles are prefixed with "org:" by default
 */

// Clerk role to app role mapping
export const CLERK_TO_APP_ROLE: Record<string, string> = {
  "org:admin": "teamleader",
  "Admin": "teamleader",
  "admin": "teamleader",
  "CEO": "teamleader",
  "ceo": "teamleader",
  "Owner": "teamleader",
  "owner": "teamleader",
  "teamleader": "teamleader",
  "org:member": "sales",
  "member": "sales",
  "org:salesexecutive": "sales",
  "org:salesExecutive": "sales",
  "salesExecutive": "sales",
  "salesexecutive": "sales",
};

// App role to dashboard path mapping
export const ROLE_TO_DASHBOARD: Record<string, string> = {
  teamleader: "/team-leader",
  ceo: "/team-leader",
  admin: "/team-leader",
  owner: "/team-leader",
  jl: "/junior-leader",
  sales: "/team-member",
};

export interface ClerkRoleInfo {
  clerkRole: string | null;      // Raw Clerk organization role
  appRole: string | null;         // Mapped application role (teamleader, jl, sales)
  organizationId: string | null;
  organizationSlug: string | null;
  organizationName: string | null;
  isAdmin: boolean;               // Is user an org admin / teamleader / CEO
  isMember: boolean;              // Is user a regular member (salesperson)
  isLoading: boolean;
  dashboardPath: string;          // Path to redirect to based on role
}

/**
 * Hook to get the current user's Clerk organization role
 * Maps Clerk roles and database roles to application roles
 */
export function useClerkRole(): ClerkRoleInfo {
  const { user, isLoaded: isUserLoaded } = useUser();
  const { organization, membership, isLoaded: isOrgLoaded } = useOrganization();
  const [roleInfo, setRoleInfo] = useState<ClerkRoleInfo>({
    clerkRole: null,
    appRole: null,
    organizationId: null,
    organizationSlug: null,
    organizationName: null,
    isAdmin: false,
    isMember: false,
    isLoading: true,
    dashboardPath: "/onboarding",
  });

  useEffect(() => {
    let isCancelled = false;

    if (!isUserLoaded || !isOrgLoaded) {
      return;
    }

    if (!user) {
      setRoleInfo({
        clerkRole: null,
        appRole: null,
        organizationId: null,
        organizationSlug: null,
        organizationName: null,
        isAdmin: false,
        isMember: false,
        isLoading: false,
        dashboardPath: "/login",
      });
      return;
    }

    const checkRole = async () => {
      // Get role info from Clerk organization membership
      const clerkRole = membership?.role || null;
      let appRole = clerkRole ? (CLERK_TO_APP_ROLE[clerkRole] || "sales") : "sales";
      let isAdmin = clerkRole === "org:admin" || clerkRole === "Admin" || clerkRole === "admin";
      let organizationSlug = organization?.slug || null;
      let organizationName = organization?.name || null;
      let organizationId = organization?.id || null;

      // Also check user's role from the database
      try {
        const userEmail = user.emailAddresses[0]?.emailAddress;
        if (userEmail) {
          const res = await fetch(`/api/users/current?identifier=${encodeURIComponent(userEmail)}`);
          if (res.ok) {
            const data = await res.json();
            if (data?.success && data?.user) {
              const dbRole = String(data.user.role || "").toLowerCase();
              if (dbRole === "teamleader" || dbRole === "ceo" || dbRole === "admin" || dbRole === "owner") {
                isAdmin = true;
                appRole = "teamleader";
              } else if (dbRole === "jl" || dbRole === "juniorleader") {
                appRole = "jl";
              } else {
                appRole = "sales";
              }

              if (!organizationSlug && data.user.tenantSubdomain) {
                organizationSlug = data.user.tenantSubdomain;
                organizationName = data.user.tenantSubdomain;
              }
            }
          }
        }
      } catch (err) {
        console.warn("Error fetching DB user role in useClerkRole:", err);
      }

      if (isCancelled) return;

      const dashboardPath = ROLE_TO_DASHBOARD[appRole] || (isAdmin ? "/team-leader" : "/team-member");

      setRoleInfo({
        clerkRole,
        appRole,
        organizationId,
        organizationSlug,
        organizationName,
        isAdmin,
        isMember: !isAdmin,
        isLoading: false,
        dashboardPath,
      });
    };

    checkRole();

    return () => {
      isCancelled = true;
    };
  }, [user, organization, membership, isUserLoaded, isOrgLoaded]);

  return roleInfo;
}

/**
 * Get dashboard path based on Clerk organization role
 */
export function getDashboardPathFromClerkRole(clerkRole: string | null): string {
  if (!clerkRole) return "/onboarding";
  
  const appRole = CLERK_TO_APP_ROLE[clerkRole] || "sales";
  return ROLE_TO_DASHBOARD[appRole] || "/team-member";
}

/**
 * Check if user has admin (teamleader / CEO) role
 */
export function isAdminRole(clerkRole: string | null): boolean {
  if (!clerkRole) return false;
  const roleLower = clerkRole.toLowerCase();
  return roleLower === "org:admin" || roleLower === "admin" || roleLower === "teamleader" || roleLower === "ceo" || roleLower === "owner";
}

/**
 * Map Clerk role to application role
 */
export function mapClerkRoleToAppRole(clerkRole: string | null): string {
  if (!clerkRole) return "sales";
  return CLERK_TO_APP_ROLE[clerkRole] || "sales";
}

