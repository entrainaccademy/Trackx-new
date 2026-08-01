import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { authenticateRequest, createUnauthorizedResponse } from "@/lib/clerkAuth";
import { getTenantIdFromOrgSlug } from "@/lib/clerkOrganization";
import { clerkClient } from "@clerk/nextjs/server";
import bcrypt from "bcryptjs";

export async function POST(req: NextRequest) {
  try {
    const authResult = await authenticateRequest(req);
    if (!authResult.success) {
      return createUnauthorizedResponse(authResult.error || "Authentication failed", authResult.statusCode);
    }

    // Role check: Only Super Admin or Company Admin / Team Leader can reset passwords
    const userRole = authResult.appRole || "";
    if (userRole !== "teamleader" && userRole !== "CEO" && !authResult.isAdmin) {
      return NextResponse.json(
        { success: false, error: "Only Super Admin or Company Admin can reset passwords" },
        { status: 403 }
      );
    }

    const { userId, id, email, newPassword } = await req.json();
    const targetId = userId || id;

    if ((!targetId && !email) || !newPassword) {
      return NextResponse.json(
        { success: false, error: "User ID/Email and new password are required" },
        { status: 400 }
      );
    }

    if (typeof newPassword !== "string" || newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 6 characters long" },
        { status: 400 }
      );
    }

    // Resolve tenantId
    let tenantId: number | null = null;
    if (authResult.orgSlug && authResult.orgId) {
      tenantId = await getTenantIdFromOrgSlug(authResult.orgSlug, authResult.orgId);
    }

    if (!tenantId && authResult.email) {
      const currentUserResult = await db
        .select({ tenantId: users.tenantId })
        .from(users)
        .where(eq(users.email, authResult.email))
        .limit(1);

      if (currentUserResult.length > 0 && currentUserResult[0].tenantId) {
        tenantId = currentUserResult[0].tenantId;
      }
    }

    // Find the user to update
    let targetUser: any = null;

    if (targetId) {
      const parsedId = typeof targetId === "number" ? targetId : parseInt(targetId, 10);
      if (!isNaN(parsedId)) {
        const result = tenantId
          ? await db.select().from(users).where(and(eq(users.id, parsedId), eq(users.tenantId, tenantId))).limit(1)
          : await db.select().from(users).where(eq(users.id, parsedId)).limit(1);
        targetUser = result[0];
      }
    }

    if (!targetUser && email) {
      const result = tenantId
        ? await db.select().from(users).where(and(eq(users.email, email), eq(users.tenantId, tenantId))).limit(1)
        : await db.select().from(users).where(eq(users.email, email)).limit(1);
      targetUser = result[0];
    }

    if (!targetUser) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update PostgreSQL
    await db
      .update(users)
      .set({
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, targetUser.id));

    // Also update password in Clerk if user exists in Clerk
    try {
      const clerk = await clerkClient();
      const clerkUsers = await clerk.users.getUserList({
        emailAddress: [targetUser.email],
      });
      if (clerkUsers.data && clerkUsers.data.length > 0) {
        const clerkUserId = clerkUsers.data[0].id;
        await clerk.users.updateUser(clerkUserId, {
          password: newPassword,
        });
        console.log(`✅ Updated password in Clerk for user ${targetUser.email}`);
      }
    } catch (clerkErr: any) {
      console.warn("⚠️ Could not update password in Clerk:", clerkErr?.message || clerkErr);
    }

    return NextResponse.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error: any) {
    console.error("Error resetting password:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to reset password" },
      { status: 500 }
    );
  }
}
