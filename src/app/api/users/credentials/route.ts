import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { authenticateRequest, createUnauthorizedResponse } from "@/lib/clerkAuth";
import { getTenantIdFromOrgSlug } from "@/lib/clerkOrganization";

/**
 * Get user credentials for team management
 * Passwords are managed by Admin and stored as bcrypt hashes in database.
 * Passwords are masked in API response for security.
 */
export async function GET(req: NextRequest) {
  try {
    // Authenticate the request
    const authResult = await authenticateRequest(req);
    if (!authResult.success) {
      return createUnauthorizedResponse(authResult.error || 'Authentication failed', authResult.statusCode);
    }

    if (!authResult.email) {
      return NextResponse.json({ error: "User email not found" }, { status: 400 });
    }

    // Get tenantId from Clerk organization (primary method)
    let tenantId: number | null = null;
    
    if (authResult.orgSlug && authResult.orgId) {
      tenantId = await getTenantIdFromOrgSlug(
        authResult.orgSlug,
        authResult.orgId,
        authResult.orgSlug
      );
    }

    // Fallback: Get tenantId from current user's record
    if (!tenantId && authResult.email) {
      try {
        const currentUserResult = await db
          .select({ tenantId: users.tenantId })
          .from(users)
          .where(eq(users.email, authResult.email))
          .limit(1);
        
        if (currentUserResult.length > 0 && currentUserResult[0].tenantId) {
          tenantId = currentUserResult[0].tenantId;
        }
      } catch (error) {
        console.error('Error fetching current user tenantId:', error);
      }
    }

    if (!tenantId) {
      return NextResponse.json({ error: "Tenant context required" }, { status: 400 });
    }

    // Get all users for this tenant
    const allUsers = await db
      .select({
        id: users.id,
        code: users.code,
        name: users.name,
        email: users.email,
        phone: users.phone,
        department: users.department,
        status: users.status,
        role: users.role,
        password: users.password,
      })
      .from(users)
      .where(eq(users.tenantId, tenantId));

    // Map credentials - NEVER return raw hash to client
    const credentials = allUsers.map((user: any) => ({
      _id: user.id.toString(),
      id: user.id,
      code: user.code || user.email,
      name: user.name || '',
      email: user.email || '',
      phone: user.phone || '',
      department: user.department || '',
      status: user.status || 'Active',
      role: user.role || 'sales',
      passwordSet: !!user.password,
      password: user.password ? '••••••••' : '',
    }));

    return NextResponse.json(credentials);
  } catch (error: any) {
    console.error("Error fetching credentials:", error);
    return NextResponse.json(
      { error: "Failed to fetch credentials" },
      { status: 500 }
    );
  }
}
