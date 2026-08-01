import { NextRequest } from "next/server";
import { db } from "@/db/client";
import { users, teamAssignments } from "@/db/schema";
import { eq, and, inArray, or } from "drizzle-orm";
import { getTenantContextFromRequest } from "@/lib/mongoTenant";
import { authenticateRequest, createUnauthorizedResponse } from "@/lib/clerkAuth";
import { getTenantIdFromOrgSlug } from "@/lib/clerkOrganization";

interface TeamAssignment {
  salespersonId: string;
  jlId: string;
  status: string;
  tenantId?: number;
}

interface User {
  id: number;
  code: string | null;
  name: string | null;
  email: string;
  role: string;
  target?: number | null;
  tenantId?: number;
}

export async function GET(request: NextRequest) {
  try {
    // Authenticate with Clerk
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return createUnauthorizedResponse(authResult.error || 'Authentication failed', authResult.statusCode || 401);
    }

    if (!authResult.email) {
      return new Response(JSON.stringify({ error: "User email not found" }), { status: 400 });
    }

    // Use authenticated user's email instead of userId parameter
    const userId = authResult.email;
    
    if (process.env.NODE_ENV !== "production") {
      console.log("Team management request for userId:", userId);
      console.log("Clerk org context:", { orgId: authResult.orgId, orgSlug: authResult.orgSlug });
    }
    
    // Get tenantId from Clerk organization (primary method)
    let tenantId: number | null = null;
    
    if (authResult.orgSlug && authResult.orgId) {
      // Use Clerk organization slug to find or create tenant
      tenantId = await getTenantIdFromOrgSlug(
        authResult.orgSlug,
        authResult.orgId,
        undefined // orgName not available here
      );
      console.log("Got tenantId from Clerk organization:", { orgSlug: authResult.orgSlug, orgId: authResult.orgId, tenantId });
    }
    
    // Find current user by email to get their tenantId and role
    let userResult = await db
      .select({
        id: users.id,
        code: users.code,
        name: users.name,
        email: users.email,
        role: users.role,
        target: users.target,
        tenantId: users.tenantId,
      })
      .from(users)
      .where(eq(users.email, userId))
      .limit(1);
    
    let currentUser = userResult[0];

    // Fallback: If tenantId not found from org, use from user record
    if (!tenantId && currentUser?.tenantId) {
      tenantId = currentUser.tenantId;
      console.log("Got tenantId from user record:", tenantId);
    }

    // Final fallback: Try subdomain header
    if (!tenantId) {
      const { tenantId: subdomainTenantId } = await getTenantContextFromRequest(request);
      if (subdomainTenantId) {
        tenantId = subdomainTenantId;
        console.log("Got tenantId from subdomain header:", tenantId);
      }
    }

    // If user doesn't exist in database but we have tenantId, create them
    if (!currentUser && tenantId) {
      console.log("User not found in database, creating user record...");
      try {
        // Get Clerk user details
        const { currentUser: clerkUser } = await import("@clerk/nextjs/server");
        const clerkUserData = await clerkUser();
        
        if (clerkUserData) {
          const newUserResult = await db
            .insert(users)
            .values({
              email: userId,
              code: userId, // Use email as code
              name: clerkUserData.firstName && clerkUserData.lastName 
                ? `${clerkUserData.firstName} ${clerkUserData.lastName}`.trim()
                : clerkUserData.firstName || clerkUserData.lastName || userId.split('@')[0],
              role: authResult.appRole === 'teamleader' ? 'teamleader' : 'sales',
              password: '', // No password needed for Clerk users
              target: 0,
              tenantId: tenantId,
            })
            .returning({
              id: users.id,
              code: users.code,
              name: users.name,
              email: users.email,
              role: users.role,
              target: users.target,
              tenantId: users.tenantId,
            });
          
          if (newUserResult.length > 0) {
            currentUser = newUserResult[0];
            console.log("✅ Created user in database:", {
              id: currentUser.id,
              email: currentUser.email,
              role: currentUser.role,
              tenantId: currentUser.tenantId,
            });
          }
        }
      } catch (createError: any) {
        console.error("Error creating user in database:", createError);
        // Continue with empty user - will return empty team data
      }
    }

    if (!currentUser) {
      // User doesn't exist in database yet and couldn't be created - return empty team data
      console.warn("User not found in database and couldn't be created. Returning empty team data.");
      return new Response(JSON.stringify({ 
        teamData: {
          allUsers: [],
          juniorLeaders: [],
          salesPersons: []
        }
      }), { status: 200 });
    }

    if (!tenantId) {
      // Return empty team data instead of error - user can still add members
      console.warn("Tenant not found for user. Returning empty team data.");
      return new Response(JSON.stringify({ 
        teamData: {
          allUsers: [],
          juniorLeaders: [],
          salesPersons: []
        }
      }), { status: 200 });
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("Tenant context:", { tenantId, userTenantId: currentUser.tenantId });
      console.log("Found user:", currentUser.name, "Role:", currentUser.role, "TenantId:", currentUser.tenantId);
    }

    // Get all users for this tenant ONLY - always filter by tenantId
    // Include all roles except exclude the current user from sales/junior leaders lists
    const allUsers = await db
      .select({
        id: users.id,
        code: users.code,
        name: users.name,
        email: users.email,
        role: users.role,
        target: users.target,
      })
      .from(users)
      .where(and(
        eq(users.tenantId, tenantId),
        inArray(users.role, ["teamleader", "jl", "sales"])
      ));

    if (process.env.NODE_ENV !== "production") {
      console.log("Found users with filtered roles:", allUsers.length);
      console.log("Users:", allUsers.map((u: any) => ({ name: u.name, email: u.email, role: u.role })));
    }

    // Get team assignments for this tenant - always filter by tenantId
    const assignments = await db
      .select({
        salespersonId: teamAssignments.salespersonId,
        jlId: teamAssignments.jlId,
        status: teamAssignments.status,
      })
      .from(teamAssignments)
      .where(and(
        eq(teamAssignments.tenantId, tenantId),
        eq(teamAssignments.status, "active")
      ));
    
    // Convert to format expected by client (using user IDs/codes)
    // We need to map user IDs to codes for the mapping
    const userCodeMap = new Map<number, string>();
    allUsers.forEach((u: any) => userCodeMap.set(u.id, u.code || u.email));

    const teamAssignmentsList: TeamAssignment[] = assignments.map((a: any) => ({
      salespersonId: userCodeMap.get(a.salespersonId) || String(a.salespersonId),
      jlId: userCodeMap.get(a.jlId) || String(a.jlId),
      status: a.status,
      tenantId: tenantId,
    }));

    // Create a map of salesperson code to JL code
    const salesToJlMap = new Map<string, string>();
    teamAssignmentsList.forEach((assignment: TeamAssignment) => {
      salesToJlMap.set(assignment.salespersonId, assignment.jlId);
    });

    // Create a map of JL code to salesperson codes
    const jlToSalesMap = new Map<string, string[]>();
    teamAssignmentsList.forEach((assignment: TeamAssignment) => {
      if (!jlToSalesMap.has(assignment.jlId)) {
        jlToSalesMap.set(assignment.jlId, []);
      }
      jlToSalesMap.get(assignment.jlId)!.push(assignment.salespersonId);
    });

    let teamData;

    if (currentUser.role === "teamleader") {
      // Team Leader sees all users and their assignments
      teamData = {
        allUsers: allUsers.map((user: User) => ({
          id: user.id,
          code: user.code,
          name: user.name,
          email: user.email,
          role: user.role,
          target: user.target || 0,
          assignedTo: user.role === "sales" ? salesToJlMap.get(user.code || user.email) : null
        })),
        juniorLeaders: allUsers.filter((user: User) => user.role === "jl").map((jl: User) => ({
          id: jl.id,
          code: jl.code,
          name: jl.name,
          email: jl.email,
          role: jl.role,
          target: jl.target || 0,
          teamMembers: jlToSalesMap.get(jl.code || jl.email) || []
        })),
        salesPersons: allUsers.filter((user: User) => user.role === "sales").map((sales: User) => ({
          id: sales.id,
          code: sales.code,
          name: sales.name,
          email: sales.email,
          role: sales.role,
          target: sales.target || 0,
          assignedTo: salesToJlMap.get(sales.code || sales.email)
        }))
      };
    } else if (currentUser.role === "jl") {
      // Junior Leader sees only their assigned team
      const assignedSales = jlToSalesMap.get(currentUser.code || currentUser.email) || [];
      teamData = {
        allUsers: allUsers.filter((user: User) => 
          (user.code || user.email) === (currentUser.code || currentUser.email) || assignedSales.includes(user.code || user.email)
        ).map((u: any) => ({
          id: u.id,
          code: u.code,
          name: u.name,
          email: u.email,
          role: u.role,
          target: u.target || 0,
        })),
        juniorLeaders: [{
          id: currentUser.id,
          code: currentUser.code,
          name: currentUser.name,
          email: currentUser.email,
          role: currentUser.role,
          target: currentUser.target || 0,
        }],
        salesPersons: allUsers.filter((user: User) => 
          user.role === "sales" && assignedSales.includes(user.code || user.email)
        ).map((sales: User) => ({
          id: sales.id,
          code: sales.code,
          name: sales.name,
          email: sales.email,
          role: sales.role,
          target: sales.target || 0,
          assignedTo: currentUser.code || currentUser.email
        }))
      };
    } else {
      // Sales person sees only themselves
      teamData = {
        allUsers: [{
          id: currentUser.id,
          code: currentUser.code,
          name: currentUser.name,
          email: currentUser.email,
          role: currentUser.role,
          target: currentUser.target || 0,
        }],
        juniorLeaders: [],
        salesPersons: [{
          id: currentUser.id,
          code: currentUser.code,
          name: currentUser.name,
          email: currentUser.email,
          role: currentUser.role,
          target: currentUser.target || 0,
        }]
      };
    }

    if (process.env.NODE_ENV !== "production") {
      console.log("Returning team data for role:", currentUser.role);
    }
    return new Response(JSON.stringify({ teamData }), { status: 200 });
  } catch (error) {
    console.error("Team management error:", error);
    return new Response(JSON.stringify({ error: "Failed to fetch team data" }), { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate with Clerk
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return createUnauthorizedResponse(authResult.error || 'Authentication failed', authResult.statusCode || 401);
    }

    if (!authResult.email) {
      return new Response(JSON.stringify({ error: "User email not found" }), { status: 400 });
    }

    const body = await request.json();
    const { action, targetUserId, jlId } = body;

    if (!action || !targetUserId) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    // Use authenticated user's email
    const userId = authResult.email;

    // Get tenant context from subdomain
    const { tenantId: subdomainTenantId } = await getTenantContextFromRequest(request);

    // Get current user by email to get their tenantId
    const currentUserResult = await db
      .select({
        id: users.id,
        code: users.code,
        name: users.name,
        email: users.email,
        role: users.role,
        tenantId: users.tenantId,
      })
      .from(users)
      .where(eq(users.email, userId))
      .limit(1);

    const currentUser = currentUserResult[0];
    if (!currentUser) {
      return new Response(JSON.stringify({ error: "User not found in database" }), { status: 404 });
    }

    // Use tenantId from user record (most reliable) or from subdomain
    const tenantId = currentUser.tenantId || subdomainTenantId;

    if (!tenantId) {
      return new Response(JSON.stringify({ error: "Tenant context required. User must be associated with a tenant." }), { status: 400 });
    }

    // Verify user belongs to the tenant from subdomain (if subdomain was provided)
    if (subdomainTenantId && currentUser.tenantId !== subdomainTenantId) {
      return new Response(JSON.stringify({ error: "User does not belong to this tenant" }), { status: 403 });
    }

    // Get target user by code
    const targetUserResult = await db
      .select({
        id: users.id,
        code: users.code,
        name: users.name,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .where(and(
        eq(users.code, targetUserId),
        eq(users.tenantId, tenantId)
      ))
      .limit(1);

    const targetUser = targetUserResult[0];
    if (!targetUser) {
      return new Response(JSON.stringify({ error: "Target user not found" }), { status: 404 });
    }

    if (action === "promote_to_jl") {
      // Only team leaders can promote to JL
      if (currentUser.role !== "teamleader") {
        return new Response(JSON.stringify({ error: "Only team leaders can promote users" }), { status: 403 });
      }

      if (targetUser.role !== "sales") {
        return new Response(JSON.stringify({ error: "Only sales persons can be promoted to JL" }), { status: 400 });
      }

      // Update user role to JL
      await db
        .update(users)
        .set({ role: "jl" })
        .where(eq(users.id, targetUser.id));

      // Remove any existing team assignments for this user
      await db
        .update(teamAssignments)
        .set({ 
          status: "inactive",
          deactivatedAt: new Date()
        })
        .where(and(
          eq(teamAssignments.salespersonId, targetUser.id),
          eq(teamAssignments.tenantId, tenantId)
        ));

      return new Response(JSON.stringify({ success: true, message: "User promoted to JL successfully" }), { status: 200 });

    } else if (action === "demote_to_sales") {
      // Only team leaders can demote JLs
      if (currentUser.role !== "teamleader") {
        return new Response(JSON.stringify({ error: "Only team leaders can demote users" }), { status: 403 });
      }

      if (targetUser.role !== "jl") {
        return new Response(JSON.stringify({ error: "Only Junior Leaders can be demoted to sales" }), { status: 400 });
      }

      // Check if this JL has any assigned sales persons
      const assignedSales = await db
        .select()
        .from(teamAssignments)
        .where(and(
          eq(teamAssignments.jlId, targetUser.id),
          eq(teamAssignments.status, "active"),
          eq(teamAssignments.tenantId, tenantId)
        ));

      if (assignedSales.length > 0) {
        return new Response(JSON.stringify({ 
          error: "Cannot demote JL with assigned team members. Please reassign or remove team members first." 
        }), { status: 400 });
      }

      // Update user role back to sales
      await db
        .update(users)
        .set({ role: "sales" })
        .where(eq(users.id, targetUser.id));

      // Remove any existing team assignments where this user was a JL
      await db
        .update(teamAssignments)
        .set({ 
          status: "inactive",
          deactivatedAt: new Date()
        })
        .where(and(
          eq(teamAssignments.jlId, targetUser.id),
          eq(teamAssignments.tenantId, tenantId)
        ));

      return new Response(JSON.stringify({ success: true, message: "User demoted to sales successfully" }), { status: 200 });

    } else if (action === "assign_to_jl") {
      // Only team leaders can assign sales to JL
      if (currentUser.role !== "teamleader") {
        return new Response(JSON.stringify({ error: "Only team leaders can assign users" }), { status: 403 });
      }

      if (!jlId) {
        return new Response(JSON.stringify({ error: "JL ID is required for assignment" }), { status: 400 });
      }

      if (targetUser.role !== "sales") {
        return new Response(JSON.stringify({ error: "Only sales persons can be assigned to JL" }), { status: 400 });
      }

      // Verify JL exists by code
      const jlResult = await db
        .select({
          id: users.id,
          code: users.code,
          name: users.name,
          email: users.email,
          role: users.role,
        })
        .from(users)
        .where(and(
          eq(users.code, jlId),
          eq(users.role, "jl"),
          eq(users.tenantId, tenantId)
        ))
        .limit(1);

      const jl = jlResult[0];
      if (!jl) {
        return new Response(JSON.stringify({ error: "JL not found" }), { status: 404 });
      }

      // Deactivate any existing assignments for this salesperson
      await db
        .update(teamAssignments)
        .set({ 
          status: "inactive",
          deactivatedAt: new Date()
        })
        .where(and(
          eq(teamAssignments.salespersonId, targetUser.id),
          eq(teamAssignments.tenantId, tenantId)
        ));

      // Create new assignment
      await db
        .insert(teamAssignments)
        .values({
          salespersonId: targetUser.id,
          jlId: jl.id,
          status: "active",
          assignedBy: currentUser.id,
          tenantId: tenantId,
        });

      return new Response(JSON.stringify({ success: true, message: "User assigned to JL successfully" }), { status: 200 });

    } else if (action === "unassign_from_jl") {
      // Only team leaders can unassign users
      if (currentUser.role !== "teamleader") {
        return new Response(JSON.stringify({ error: "Only team leaders can unassign users" }), { status: 403 });
      }

      if (targetUser.role !== "sales") {
        return new Response(JSON.stringify({ error: "Only sales persons can be unassigned" }), { status: 400 });
      }

      // Check if user is currently assigned to a JL
      const currentAssignment = await db
        .select()
        .from(teamAssignments)
        .where(and(
          eq(teamAssignments.salespersonId, targetUser.id),
          eq(teamAssignments.status, "active"),
          eq(teamAssignments.tenantId, tenantId)
        ))
        .limit(1);

      if (currentAssignment.length === 0) {
        return new Response(JSON.stringify({ error: "User is not currently assigned to any JL" }), { status: 400 });
      }

      // Deactivate the current assignment
      await db
        .update(teamAssignments)
        .set({ 
          status: "inactive",
          deactivatedAt: new Date()
        })
        .where(and(
          eq(teamAssignments.salespersonId, targetUser.id),
          eq(teamAssignments.status, "active"),
          eq(teamAssignments.tenantId, tenantId)
        ));

      return new Response(JSON.stringify({ success: true, message: "User unassigned successfully" }), { status: 200 });

    } else {
      return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400 });
    }

  } catch (error) {
    console.error("Team management error:", error);
    return new Response(JSON.stringify({ error: "Failed to perform team action" }), { status: 500 });
  }
}
