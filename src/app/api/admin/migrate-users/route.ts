import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { users, tenants } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { authenticateRequest, createUnauthorizedResponse } from "@/lib/clerkAuth";

/**
 * Migration endpoint to assign existing users to tenants
 * This checks all users without tenantId and tries to match them with tenants
 * based on email in tenant metadata or creates a default tenant
 */
export async function POST(request: NextRequest) {
  try {
    // Authenticate the request - only admin users should run migrations
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return createUnauthorizedResponse(authResult.error, authResult.statusCode);
    }

    const migrationResults = {
      totalUsersWithoutTenant: 0,
      usersMatched: 0,
      usersCreatedWithDefaultTenant: 0,
      errors: [] as string[],
      details: [] as Array<{
        userId: number;
        email: string;
        action: string;
        tenantId?: number;
        tenantSubdomain?: string;
        error?: string;
      }>,
    };

    // Get all users without tenantId
    const usersWithoutTenant = await db
      .select()
      .from(users)
      .where(isNull(users.tenantId));

    migrationResults.totalUsersWithoutTenant = usersWithoutTenant.length;

    // Get all tenants to check metadata
    const allTenants = await db
      .select()
      .from(tenants);

    // Create a map of tenant email -> tenantId from metadata
    const tenantEmailMap = new Map<string, { tenantId: number; subdomain: string }>();
    for (const tenant of allTenants) {
      if (tenant.metadata && typeof tenant.metadata === "object") {
        const metadata = tenant.metadata as any;
        if (metadata.email && typeof metadata.email === "string") {
          tenantEmailMap.set(metadata.email.toLowerCase(), {
            tenantId: tenant.id as number,
            subdomain: tenant.subdomain,
          });
        }
      }
    }

    // Process each user
    for (const user of usersWithoutTenant) {
      try {
        const userEmail = user.email?.toLowerCase();
        if (!userEmail) {
          migrationResults.errors.push(`User ${user.id} has no email`);
          migrationResults.details.push({
            userId: user.id,
            email: user.email || "unknown",
            action: "skipped",
            error: "No email found",
          });
          continue;
        }

        // Try to match with existing tenant by email
        const matchedTenant = tenantEmailMap.get(userEmail);

        if (matchedTenant) {
          // User email matches tenant metadata email - assign to that tenant
          await db
            .update(users)
            .set({
              tenantId: matchedTenant.tenantId,
              updatedAt: new Date(),
            })
            .where(eq(users.id, user.id));

          migrationResults.usersMatched++;
          migrationResults.details.push({
            userId: user.id,
            email: userEmail,
            action: "matched",
            tenantId: matchedTenant.tenantId,
            tenantSubdomain: matchedTenant.subdomain,
          });
        } else {
          // No matching tenant found - create a default tenant for this user
          // Use email prefix as subdomain (sanitized)
          const subdomainPrefix = userEmail.split("@")[0].replace(/[^a-z0-9-]/g, "-").substring(0, 50);
          let defaultSubdomain = subdomainPrefix;
          let counter = 1;

          // Ensure subdomain is unique
          while (true) {
            const existing = await db
              .select()
              .from(tenants)
              .where(eq(tenants.subdomain, defaultSubdomain))
              .limit(1);

            if (existing.length === 0) break;
            defaultSubdomain = `${subdomainPrefix}-${counter}`;
            counter++;
          }

          // Create default tenant
          const [newTenant] = await db
            .insert(tenants)
            .values({
              subdomain: defaultSubdomain,
              name: user.name || userEmail.split("@")[0],
              metadata: {
                email: userEmail,
                contactName: user.name || "",
                autoCreated: true,
                migratedAt: new Date().toISOString(),
              },
            })
            .returning();

          // Assign user to the new tenant
          await db
            .update(users)
            .set({
              tenantId: newTenant.id as number,
              role: user.role === "teamleader" ? "teamleader" : user.role || "sales",
              updatedAt: new Date(),
            })
            .where(eq(users.id, user.id));

          migrationResults.usersCreatedWithDefaultTenant++;
          migrationResults.details.push({
            userId: user.id,
            email: userEmail,
            action: "created_default_tenant",
            tenantId: newTenant.id as number,
            tenantSubdomain: defaultSubdomain,
          });
        }
      } catch (error: any) {
        const errorMsg = error?.message || "Unknown error";
        migrationResults.errors.push(`User ${user.id}: ${errorMsg}`);
        migrationResults.details.push({
          userId: user.id,
          email: user.email || "unknown",
          action: "error",
          error: errorMsg,
        });
      }
    }

    return NextResponse.json({
      success: true,
      migrationResults,
      message: `Migration completed: ${migrationResults.usersMatched} matched, ${migrationResults.usersCreatedWithDefaultTenant} created with default tenant`,
    });
  } catch (error: any) {
    console.error("Migration error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Migration failed",
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint to preview migration without executing
 */
export async function GET(request: NextRequest) {
  try {
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return createUnauthorizedResponse(authResult.error, authResult.statusCode);
    }

    // Get all users without tenantId
    const usersWithoutTenant = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
      })
      .from(users)
      .where(isNull(users.tenantId));

    // Get all tenants to check metadata
    const allTenants = await db
      .select({
        id: tenants.id,
        subdomain: tenants.subdomain,
        name: tenants.name,
        metadata: tenants.metadata,
      })
      .from(tenants);

    // Create a map of tenant email -> tenantId from metadata
    const tenantEmailMap = new Map<string, { tenantId: number; subdomain: string; name: string }>();
    for (const tenant of allTenants) {
      if (tenant.metadata && typeof tenant.metadata === "object") {
        const metadata = tenant.metadata as any;
        if (metadata.email && typeof metadata.email === "string") {
          tenantEmailMap.set(metadata.email.toLowerCase(), {
            tenantId: tenant.id as number,
            subdomain: tenant.subdomain,
            name: tenant.name,
          });
        }
      }
    }

    // Preview what would happen
    const preview = usersWithoutTenant.map((user: any) => {
      const userEmail = user.email?.toLowerCase() || "";
      const matchedTenant = userEmail ? tenantEmailMap.get(userEmail) : null;

      return {
        userId: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        willMatch: !!matchedTenant,
        matchedTenant: matchedTenant
          ? {
              tenantId: matchedTenant.tenantId,
              subdomain: matchedTenant.subdomain,
              name: matchedTenant.name,
            }
          : null,
        willCreateDefaultTenant: !matchedTenant,
        defaultSubdomain: matchedTenant
          ? null
          : userEmail.split("@")[0].replace(/[^a-z0-9-]/g, "-").substring(0, 50),
      };
    });

    return NextResponse.json({
      success: true,
      preview,
      summary: {
        totalUsersWithoutTenant: usersWithoutTenant.length,
        willMatch: preview.filter((p: any) => p.willMatch).length,
        willCreateDefaultTenant: preview.filter((p: any) => p.willCreateDefaultTenant).length,
      },
    });
  } catch (error: any) {
    console.error("Preview error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Preview failed",
      },
      { status: 500 }
    );
  }
}


