import { getTenantBySubdomain } from "@/lib/tenant";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getTenantIdFromOrgSlug } from "@/lib/clerkOrganization";
import { db } from "@/db/client";
import { tenants, users } from "@/db/schema";
import { eq } from "drizzle-orm";

export type TenantContext = {
  tenantSubdomain: string;
  tenantId?: number;
};

export async function getTenantContextFromRequest(req: Request): Promise<TenantContext> {
  const sub = (req?.headers?.get?.("x-tenant-subdomain") || "").trim().toLowerCase();
  
  if (sub && sub !== "www") {
    try {
      const t = await getTenantBySubdomain(sub);
      if (t?.id) {
        return { tenantSubdomain: sub, tenantId: t.id };
      }
    } catch {}
  }

  // 1. Resolve via Clerk Auth or Cookie Session (User email lookup in DB or Org slug)
  try {
    let authEmail: string | null = null;
    let authOrgSlug: string | null = null;
    let authOrgId: string | null = null;

    try {
      const authResult = await auth();
      if (authResult?.userId) {
        const clerkUser = await currentUser();
        authEmail = clerkUser?.emailAddresses?.[0]?.emailAddress || null;
        authOrgSlug = authResult.orgSlug || null;
        authOrgId = authResult.orgId || null;
      }
    } catch {}

    // Fallback email from cookie / header for credential login
    if (!authEmail && req) {
      try {
        const cookieHeader = req.headers?.get?.("cookie") || "";
        const match = cookieHeader.match(/trackx_user_email=([^;]+)/);
        if (match && match[1]) {
          authEmail = decodeURIComponent(match[1]).trim();
        }
      } catch {}

      if (!authEmail) {
        authEmail = (req.headers?.get?.("x-user-email") || "").trim() || null;
      }
    }

    // Check if user email has an assigned tenant in users table
    if (authEmail) {
      try {
        const userRows = await db
          .select({ tenantId: users.tenantId })
          .from(users)
          .where(eq(users.email, authEmail))
          .limit(1);

        if (userRows.length > 0 && userRows[0]?.tenantId) {
          const resolvedTenantId = userRows[0].tenantId;
          console.log(`[TenantContext] Resolved tenantId ${resolvedTenantId} via user email in DB: ${authEmail}`);
          return { tenantSubdomain: sub || authOrgSlug || "", tenantId: resolvedTenantId };
        }
      } catch (err: any) {
        console.warn(`[TenantContext] User email lookup failed: ${err?.message}`);
      }
    }

    // Resolve via Clerk Org slug if present
    if (authOrgSlug && authOrgId) {
      const tenantId = await getTenantIdFromOrgSlug(authOrgSlug, authOrgId);
      if (tenantId) {
        console.log(`[TenantContext] Resolved tenantId ${tenantId} via orgSlug`);
        return { tenantSubdomain: authOrgSlug, tenantId };
      }
    }
  } catch (err: any) {
    console.warn(`[TenantContext] Tenant resolution error: ${err?.message}`);
  }

  // 2. Fallback to default tenant for dev / single-tenant setup
  try {
    const firstTenant = await db
      .select({ id: tenants.id, subdomain: tenants.subdomain })
      .from(tenants)
      .limit(1);

    if (firstTenant.length > 0 && firstTenant[0]?.id) {
      return { tenantSubdomain: firstTenant[0].subdomain || "", tenantId: firstTenant[0].id };
    }
  } catch {}

  return { tenantSubdomain: sub || "" };
}
