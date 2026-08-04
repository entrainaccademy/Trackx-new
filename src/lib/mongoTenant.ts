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

  // 1. Resolve via Clerk Auth (User email lookup in DB or Org slug)
  try {
    const authResult = await auth();
    
    // First, check if logged in Clerk user has an assigned tenant in users table
    if (authResult?.userId) {
      try {
        const clerkUser = await currentUser();
        const email = clerkUser?.emailAddresses?.[0]?.emailAddress;
        if (email) {
          const userRows = await db
            .select({ tenantId: users.tenantId })
            .from(users)
            .where(eq(users.email, email))
            .limit(1);

          if (userRows.length > 0 && userRows[0]?.tenantId) {
            const resolvedTenantId = userRows[0].tenantId;
            console.log(`[TenantContext] Resolved tenantId ${resolvedTenantId} via user email in DB`);
            return { tenantSubdomain: sub || authResult.orgSlug || "", tenantId: resolvedTenantId };
          }
        }
      } catch (err: any) {
        console.warn(`[TenantContext] User email lookup failed: ${err?.message}`);
      }
    }

    // Second, resolve via Clerk Org slug if present
    if (authResult?.orgSlug && authResult?.orgId) {
      const tenantId = await getTenantIdFromOrgSlug(authResult.orgSlug, authResult.orgId);
      if (tenantId) {
        console.log(`[TenantContext] Resolved tenantId ${tenantId} via orgSlug`);
        return { tenantSubdomain: authResult.orgSlug, tenantId };
      }
    }
  } catch (err: any) {
    console.warn(`[TenantContext] Clerk auth lookup failed: ${err?.message}`);
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
