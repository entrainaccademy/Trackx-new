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
  
  if (sub) {
    try {
      const t = await getTenantBySubdomain(sub);
      if (t?.id) {
        return { tenantSubdomain: sub, tenantId: t.id };
      }
    } catch {}
  }

  // 1. Resolve via Clerk Auth (Org slug or User email)
  try {
    const authResult = await auth();
    if (authResult?.orgSlug && authResult?.orgId) {
      const tenantId = await getTenantIdFromOrgSlug(authResult.orgSlug, authResult.orgId);
      if (tenantId) {
        return { tenantSubdomain: authResult.orgSlug, tenantId };
      }
    }

    if (authResult?.userId) {
      const clerkUser = await currentUser();
      const email = clerkUser?.emailAddresses?.[0]?.emailAddress;
      if (email) {
        const userRows = await db
          .select({ tenantId: users.tenantId })
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (userRows.length > 0 && userRows[0]?.tenantId) {
          return { tenantSubdomain: sub || "", tenantId: userRows[0].tenantId };
        }
      }
    }
  } catch {}

  // 2. Fallback to default tenant for dev / localhost
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
