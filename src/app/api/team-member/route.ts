import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { users, sales, leads, tasks } from "@/db/schema";
import { eq, and, or, inArray } from "drizzle-orm";
import { authenticateRequest } from "@/lib/clerkAuth";

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate Request using user session/token (do not trust query parameters)
    const authResult = await authenticateRequest(request);
    if (!authResult.success || !authResult.email) {
      return NextResponse.json(
        { success: false, error: "Team member authentication required" },
        { status: 401 }
      );
    }

    const email = authResult.email;

    // 2. Find user profile in database
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

    // 3. Fetch sales logged by or associated with this team member
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

    // 4. Fetch leads assigned to this team member (including follow-up fields)
    const memberLeadsRaw = await db
      .select({
        id: leads.id,
        phone: leads.phone,
        name: leads.name,
        email: leads.email,
        stage: leads.stage,
        source: leads.source,
        score: leads.score,
        needFollowup: leads.needFollowup,
        followupDate: leads.followupDate,
        followupNotes: leads.followupNotes,
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

    const assignedLeads = memberLeadsRaw.map((lead: {
      id: number;
      phone: string;
      name: string | null;
      email: string | null;
      stage: string;
      source: string | null;
      score: number | null;
      needFollowup: boolean | null;
      followupDate: Date | null;
      followupNotes: string | null;
      lastActivityAt: Date | null;
      createdAt: Date | null;
    }) => ({
      id: lead.id,
      phone: lead.phone,
      name: lead.name,
      email: lead.email,
      stage: lead.stage,
      source: lead.source,
      score: lead.score,
      needFollowup: Boolean(lead.needFollowup),
      followupDate: lead.followupDate ? new Date(lead.followupDate).toISOString() : null,
      followupNotes: lead.followupNotes || null,
      lastActivityAt: lead.lastActivityAt ? new Date(lead.lastActivityAt).toISOString() : null,
      createdAt: lead.createdAt ? new Date(lead.createdAt).toISOString() : null,
    }));

    // 5. Fetch tasks belonging to the authenticated member and their tenant
    const memberTasksRaw = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        leadPhone: tasks.leadPhone,
        type: tasks.type,
        status: tasks.status,
        priority: tasks.priority,
        dueAt: tasks.dueAt,
        completedAt: tasks.completedAt,
        createdAt: tasks.createdAt,
        updatedAt: tasks.updatedAt,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.tenantId, member.tenantId),
          or(
            eq(tasks.ownerId, String(member.id)),
            eq(tasks.ownerId, member.code || ""),
            eq(tasks.ownerId, member.email)
          )
        )
      );

    // Build phone-to-leadName map for tasks
    const phoneToNameMap: Record<string, string> = {};
    for (const lead of memberLeadsRaw) {
      if (lead.phone) {
        phoneToNameMap[lead.phone] = lead.name || "";
      }
    }

    const missingPhones: string[] = Array.from(
      new Set(
        memberTasksRaw
          .map((t: { leadPhone: string }) => t.leadPhone)
          .filter((phone: string | null | undefined): phone is string => Boolean(phone) && phoneToNameMap[phone!] === undefined)
      )
    );

    if (missingPhones.length > 0) {
      const extraLeads = await db
        .select({
          phone: leads.phone,
          name: leads.name,
        })
        .from(leads)
        .where(
          and(
            eq(leads.tenantId, member.tenantId),
            inArray(leads.phone, missingPhones)
          )
        );

      for (const el of extraLeads) {
        if (el.phone) {
          phoneToNameMap[el.phone] = el.name || "";
        }
      }
    }

    const formattedTasks = memberTasksRaw.map((t: {
      id: number;
      title: string;
      leadPhone: string;
      type: string | null;
      status: string;
      priority: string | null;
      dueAt: Date | null;
      completedAt: Date | null;
    }) => ({
      id: t.id,
      title: t.title,
      leadPhone: t.leadPhone,
      leadName: phoneToNameMap[t.leadPhone] || null,
      type: t.type || "OTHER",
      status: t.status || "OPEN",
      priority: t.priority || "MEDIUM",
      dueAt: t.dueAt ? new Date(t.dueAt).toISOString() : null,
      completedAt: t.completedAt ? new Date(t.completedAt).toISOString() : null,
    }));

    // 6. Calculate workStats
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    let openTasksCount = 0;
    let followupsTodayCount = 0;
    let overdueTasksCount = 0;
    let highPriorityTasksCount = 0;

    for (const t of memberTasksRaw) {
      const isCompleted = !!t.completedAt;
      const statusUpper = (t.status || "").toUpperCase();
      const isOpen = !isCompleted && statusUpper !== "DONE" && statusUpper !== "SKIPPED";

      if (isOpen) {
        openTasksCount++;

        if (t.dueAt) {
          const dueDate = new Date(t.dueAt);
          if (dueDate >= startOfToday && dueDate <= endOfToday) {
            if ((t.type || "").toUpperCase() === "FOLLOWUP") {
              followupsTodayCount++;
            }
          } else if (dueDate < startOfToday) {
            overdueTasksCount++;
          }
        }

        if ((t.priority || "").toUpperCase() === "HIGH") {
          highPriorityTasksCount++;
        }
      }
    }

    const workStats = {
      openTasks: openTasksCount,
      followupsToday: followupsTodayCount,
      overdueTasks: overdueTasksCount,
      highPriorityTasks: highPriorityTasksCount,
    };

    // 7. Calculate summary metrics
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
        assignedLeadsCount: assignedLeads.length,
        target,
        targetProgress,
      },
      workStats,
      sales: memberSales,
      assignedLeads,
      tasks: formattedTasks,
    });
  } catch (error: any) {
    console.error("Error in Team Member API:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Failed to fetch team member data" },
      { status: 500 }
    );
  }
}

