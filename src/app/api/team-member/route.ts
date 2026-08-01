import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { users, sales, leads } from "@/db/schema";
import { eq, and, or } from "drizzle-orm";
import { authenticateRequest } from "@/lib/clerkAuth";
import { getTenantIdFromOrgSlug } from "@/lib/clerkOrganization";

export async function GET(request: NextRequest) {
  try {
    let email: string | null = null;

    // 1. Check Clerk Auth
    const authResult = await authenticateRequest(request);
    if (authResult.success && authResult.email) {
      email = authResult.email;
    }

    // 2. Check query params or headers for custom team member session fallback
    const { searchParams } = new URL(request.url);
    const queryEmail = searchParams.get("email");
    const cookieEmail = request.cookies.get("trackx_user_email")?.value;
    const headerEmail = request.headers.get("x-user-email");

    if (!email) {
      email = queryEmail || cookieEmail || headerEmail || null;
    }

    if (!email) {
      return NextResponse.json(
        { success: false, error: "Team member authentication or email identifier required" },
        { status: 401 }
      );
    }

    // 3. Find user profile in database
    const userResult = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        code: users.code,
        role: users.role,
        phone: users.phone,
        department: users.department,
        status: users.status,
        target: users.target,
        tenantId: users.tenantId,
      })
      .from(users)
      .where(eq(users.email, email.trim()))
      .limit(1);

    if (userResult.length === 0) {
      return NextResponse.json(
        { success: false, error: "Team member profile not found" },
        { status: 404 }
      );
    }

    const member = userResult[0];

    // 4. Fetch sales logged by or associated with this team member
    const memberSales = await db
      .select()
      .from(sales)
      .where(
        and(
          eq(sales.tenantId, member.tenantId),
          or(
            eq(sales.ogaName, member.name || ""),
            eq(sales.ogaName, member.email)
          )
        )
      );

    // 5. Fetch leads assigned to this team member
    const memberLeads = await db
      .select({
        id: leads.id,
        phone: leads.phone,
        name: leads.name,
        email: leads.email,
        stage: leads.stage,
        source: leads.source,
        score: leads.score,
        lastActivityAt: leads.lastActivityAt,
        createdAt: leads.createdAt,
      })
      .from(leads)
      .where(
        and(
          eq(leads.tenantId, member.tenantId),
          or(
            eq(leads.ownerId, String(member.id)),
            eq(leads.ownerId, member.code || ""),
            eq(leads.ownerId, member.email)
          )
        )
      );

    // 6. Calculate summary metrics
    const totalRevenue = memberSales.reduce((sum: number, item: any) => sum + (Number(item.amount) || 0), 0);
    const target = member.target || 50000;
    const targetProgress = Math.min(Math.round((totalRevenue / Math.max(target, 1)) * 100), 100);

    return NextResponse.json({
      success: true,
      profile: {
        id: member.id,
        name: member.name || "Team Member",
        email: member.email,
        code: member.code || member.email,
        role: member.role || "sales",
        phone: member.phone || "",
        department: member.department || "",
        status: member.status || "Active",
        target: target,
      },
      stats: {
        totalRevenue,
        totalSales: memberSales.length,
        assignedLeadsCount: memberLeads.length,
        target,
        targetProgress,
      },
      sales: memberSales,
      assignedLeads: memberLeads,
    });
  } catch (error: any) {
    console.error("Error in Team Member API:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch team member data" },
      { status: 500 }
    );
  }
}
