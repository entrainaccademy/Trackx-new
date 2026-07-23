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

  // A newly created Clerk organization may not have a matching tenant row yet.
  // Resolve it from the authenticated organization only when it matches the
  // requested tenant hostname.
  const authResult = await auth();
  if (
    authResult.orgSlug &&
    authResult.orgId &&
    (!subdomain || authResult.orgSlug === subdomain)
  ) {
    const tenantId = await getTenantIdFromOrgSlug(
      authResult.orgSlug,
      authResult.orgId,
      authResult.orgSlug
    );
    if (tenantId) return tenantId;
  }

  // Handle development requests made directly against localhost.
  if (!subdomain) {
    const allTenants = await db.select().from(tenants).limit(1);
    if (allTenants.length > 0) {
      return allTenants[0].id as number;
    }
    throw new Error("No tenant found and no subdomain provided");
  }

  throw new Error("Tenant not found");
}


