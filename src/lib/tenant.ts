import { db } from "@/db/client";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { getTenantIdFromOrgSlug } from "@/lib/clerkOrganization";

interface TenantMetadata {
  contactName?: string;
  email?: string;
  phone?: string;
  expectedUsers?: string;
  industry?: string;
  onboardingDate?: string;
  logoPath?: string;
}

export async function getTenantBySubdomain(subdomain: string) {
  if (!subdomain) return null;
  const rows = await db.select().from(tenants).where(eq(tenants.subdomain, subdomain)).limit(1);
  return rows[0] || null;
}

export async function getTenantLogo(subdomain: string): Promise<string | null> {
  try {
    const tenant = await getTenantBySubdomain(subdomain);
    if (tenant?.metadata) {
      const metadata = tenant.metadata as TenantMetadata;
      return metadata.logoPath || null;
    }
    return null;
  } catch (error) {
    console.error("Error fetching tenant logo:", error);
    return null;
  }
}

export async function requireTenantIdFromRequest(req: Request): Promise<number> {
  const subdomain = req.headers.get("x-tenant-subdomain");

  if (subdomain) {
    const tenant = await getTenantBySubdomain(subdomain);
    if (tenant?.id) return tenant.id as number;
  }

  // Check Clerk auth for org info
  let authResult: any = null;
  try {
    authResult = await auth();
  } catch {}

  const targetSlug = subdomain || authResult?.orgSlug;
  const orgId = authResult?.orgId || (subdomain ? `org_${subdomain}` : undefined);

  if (targetSlug && orgId) {
    const tenantId = await getTenantIdFromOrgSlug(
      targetSlug,
      orgId,
      authResult?.orgSlug || targetSlug
    );
    if (tenantId) return tenantId;
  }

  if (subdomain) {
    const tenantId = await getTenantIdFromOrgSlug(
      subdomain,
      `org_${subdomain}`,
      subdomain
    );
    if (tenantId) return tenantId;
  }

  // Handle development requests made directly against localhost without subdomain.
  if (!subdomain) {
    const allTenants = await db.select().from(tenants).limit(1);
    if (allTenants.length > 0) {
      return allTenants[0].id as number;
    }
    throw new Error("No tenant found and no subdomain provided");
  }

  throw new Error("Tenant not found");
}


