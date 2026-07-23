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

      // No organization - redirect to onboarding
      if (!organization || !membership) {
        console.log("No organization found, redirecting to onboarding");
        hasRedirected.current = true;
        router.push("/onboarding");
        return;
      }

      // Get user's role in the organization
      const clerkRole = membership.role;
      const appRole = CLERK_TO_APP_ROLE[clerkRole] || "sales";
      const isAdmin = clerkRole === "org:admin" || clerkRole === "Admin" || clerkRole === "admin";
      
      // Ensure user exists in database (create if needed)
      // This happens automatically via the API endpoints, but we can trigger it here
      try {
        const userEmail = user.emailAddresses[0]?.emailAddress;
        if (userEmail) {
          // This will auto-create the user if they don't exist
          const emailStr = String(userEmail);
          await fetch(`/api/users/current?identifier=${encodeURIComponent(emailStr)}`, {
            method: 'GET',
          });
        }
      } catch (error) {
        console.error("Error ensuring user exists in database:", error);
        // Continue anyway - APIs will create user on first access
      }
      
      // Determine dashboard path based on role
      // Admin (teamleader) → /team-leader
      // Member (salesExecutive/salesperson) → /dashboard
      const path = isAdmin ? "/team-leader" : "/dashboard";
      
      // Get organization slug for tenant subdomain
      const organizationSlug = organization.slug;
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
