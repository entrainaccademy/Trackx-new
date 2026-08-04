import { db } from "@/db/client";
import { tenants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { auth } from "@clerk/nextjs/server";
import { getTenantIdFromOrgSlug } from "@/lib/clerkOrganization";

interface TenantMetadata {
  contactName?: string;
  email?: string;
  staffCount?: number;
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

  if (subdomain && subdomain !== "www") {
    const tenant = await getTenantBySubdomain(subdomain);
    if (tenant?.id) return tenant.id as number;
  }

  // Check Clerk auth for user email or org info
  let authResult: any = null;
  try {
    authResult = await auth();
  } catch {}

  let email: string | null = null;

  if (authResult?.userId) {
    try {
      const { currentUser } = await import("@clerk/nextjs/server");
      const clerkUser = await currentUser();
      email = clerkUser?.emailAddresses?.[0]?.emailAddress || null;
    } catch {}
  }

  if (!email && req) {
    try {
      const cookieHeader = req.headers?.get?.("cookie") || "";
      const match = cookieHeader.match(/trackx_user_email=([^;]+)/);
      if (match && match[1]) {
        email = decodeURIComponent(match[1]).trim();
      }
    } catch {}

    if (!email) {
      email = (req.headers?.get?.("x-user-email") || "").trim() || null;
    }
  }

  if (email) {
    try {
      const { users } = await import("@/db/schema");
      const userRows = await db
        .select({ tenantId: users.tenantId })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);

      if (userRows.length > 0 && userRows[0]?.tenantId) {
        return userRows[0].tenantId as number;
      }
    } catch {}
  }

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


