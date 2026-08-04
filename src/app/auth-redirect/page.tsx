"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser, useOrganization } from "@clerk/nextjs";
import { getTenantUrl } from "@/lib/tenantUrl";
import { CLERK_TO_APP_ROLE } from "@/lib/clerkRoles";

/**
 * Login redirect page that determines where to redirect users based on their Clerk organization role
 * Handles both regular login and organization invitation acceptance
 * 
 * Role mapping:
 * - Admin (Clerk) → teamleader → /team-leader dashboard
 * - org:salesexecutive (Clerk) → sales → /dashboard
 */
export default function LoginRedirectPage() {
  const router = useRouter();
  const { user, isLoaded: isUserLoaded } = useUser();
  const { organization, membership, isLoaded: isOrgLoaded } = useOrganization();
  const hasRedirected = useRef(false);

  useEffect(() => {
    if (!isUserLoaded || !isOrgLoaded || hasRedirected.current) return;

    const redirectUser = async () => {
      // Not logged in - redirect to login
      if (!user) {
        hasRedirected.current = true;
        router.push("/login");
        return;
      }

      // 1. Fetch user record from database
      let dbUser: any = null;
      try {
        const userEmail = user.emailAddresses[0]?.emailAddress;
        if (userEmail) {
          const emailStr = String(userEmail);
          const res = await fetch(`/api/users/current?identifier=${encodeURIComponent(emailStr)}`, {
            method: 'GET',
          });
          if (res.ok) {
            const data = await res.json();
            if (data?.success && data?.user) {
              dbUser = data.user;
            }
          }
        }
      } catch (error) {
        console.error("Error ensuring user exists in database:", error);
      }

      // 2. Determine role from DB or Clerk membership
      const clerkRole = membership?.role;
      const appRole = clerkRole ? (CLERK_TO_APP_ROLE[clerkRole] || "sales") : null;
      let isAdmin = clerkRole === "org:admin" || clerkRole === "Admin" || clerkRole === "admin";

      if (dbUser && dbUser.role) {
        const roleLower = String(dbUser.role).toLowerCase();
        if (roleLower === "teamleader" || roleLower === "admin" || roleLower === "ceo") {
          isAdmin = true;
        }
      }

      // 3. Get organization slug for tenant subdomain from Clerk org or DB user
      const organizationSlug = organization?.slug || dbUser?.tenantSubdomain;

      // No organization and no DB user -> redirect to onboarding
      if (!organization && !membership && !dbUser && !organizationSlug) {
        console.log("No organization or user record found, redirecting to onboarding");
        hasRedirected.current = true;
        router.push("/onboarding");
        return;
      }

      // Determine dashboard path based on role
      // Admin (teamleader) → /team-leader
      // Member (salesExecutive/salesperson) → /team-member
      const path = isAdmin ? "/team-leader" : "/team-member";
      
      if (!organizationSlug) {
        console.error("Organization slug not found, redirecting to onboarding");
        hasRedirected.current = true;
        router.push("/onboarding");
        return;
      }
      
      // Build the full URL with organization subdomain
      const redirectUrl = getTenantUrl(organizationSlug, path);
      
      console.log("Redirecting user after login/invitation:", {
        organizationSlug,
        clerkRole,
        appRole,
        dbUserRole: dbUser?.role,
        isAdmin,
        path,
        redirectUrl,
      });

      hasRedirected.current = true;
      window.location.href = redirectUrl;
    };

    redirectUser();
  }, [isUserLoaded, isOrgLoaded, user, organization, membership, router]);

  const organizationSlug = organization?.slug;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-gray-600">Loading your dashboard...</p>
        {isUserLoaded && isOrgLoaded && (
          <p className="text-sm text-gray-400 mt-2">
            {organizationSlug ? `Redirecting to ${organizationSlug}...` : "Setting up your account..."}
          </p>
        )}
      </div>
    </div>
  );
}
