import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { users, tenants } from '@/db/schema';
import { eq, and, or } from 'drizzle-orm';
import { getTenantContextFromRequest } from '@/lib/mongoTenant';
import { authenticateRequest, createUnauthorizedResponse } from '@/lib/clerkAuth';
import { requireTenantIdFromRequest } from '@/lib/tenant';
import { clerkClient } from '@clerk/nextjs/server';
import { getClerkOrganizationBySlug, getTenantIdFromOrgSlug } from '@/lib/clerkOrganization';
import bcrypt from 'bcryptjs';

// Get all users (for team leader / admin)
export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return createUnauthorizedResponse(authResult.error, authResult.statusCode);
  }

  let { tenantSubdomain, tenantId } = await getTenantContextFromRequest(request);
  if (!tenantId) {
    try {
      tenantId = await requireTenantIdFromRequest(request);
    } catch {
      return NextResponse.json({ success: false, error: "Tenant identification required" }, { status: 400 });
    }
  }
  
  const { searchParams } = new URL(request.url);
  const roleFilter = searchParams.get("role");

  const queryWhere = roleFilter 
    ? and(eq(users.tenantId, tenantId), eq(users.role, roleFilter))
    : eq(users.tenantId, tenantId);

  const allUsers = await db
    .select()
    .from(users)
    .where(queryWhere);
  
  // Remove passwords from response
  const usersWithoutPasswords = allUsers.map((user: any) => {
    const { password, ...userWithoutPassword } = user;
    return userWithoutPassword;
  });
  
  return NextResponse.json(usersWithoutPasswords);
}

// Create new user (for team leader / admin)
export async function POST(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      console.error('Authentication failed:', authResult.error);
      return createUnauthorizedResponse(authResult.error, authResult.statusCode);
    }

    // Role check: Super Admin or Company Admin only
    const userRole = authResult.appRole || "";
    if (userRole !== "teamleader" && userRole !== "CEO" && !authResult.isAdmin) {
      return NextResponse.json(
        { success: false, error: "Only Super Admin or Company Admin can create team members" },
        { status: 403 }
      );
    }

    const data = await request.json();
    
    // Validate required fields
    if (!data.email || !data.name) {
      return NextResponse.json({ 
        success: false, 
        error: 'Email and full name are required' 
      }, { status: 400 });
    }

    if (!data.password) {
      return NextResponse.json({ 
        success: false, 
        error: 'Password is required' 
      }, { status: 400 });
    }

    if (data.confirmPassword && data.password !== data.confirmPassword) {
      return NextResponse.json({ 
        success: false, 
        error: 'Passwords do not match' 
      }, { status: 400 });
    }

    if (data.password.length < 6) {
      return NextResponse.json({ 
        success: false, 
        error: 'Password must be at least 6 characters long' 
      }, { status: 400 });
    }

    // Get tenantId from Clerk organization
    let tenantId: number | null = null;
    let tenantSubdomain: string | null = null;

    if (authResult.orgSlug && authResult.orgId) {
      tenantId = await getTenantIdFromOrgSlug(
        authResult.orgSlug,
        authResult.orgId,
        undefined
      );
      tenantSubdomain = authResult.orgSlug;
    }

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
      const { tenantId: subdomainTenantId, tenantSubdomain: subdomain } = await getTenantContextFromRequest(request);
      if (subdomainTenantId) {
        tenantId = subdomainTenantId;
        tenantSubdomain = subdomain;
      }
    }

    if (!tenantId) {
      return NextResponse.json({ 
        success: false, 
        error: 'Tenant context required. You must belong to an organization to add team members.' 
      }, { status: 400 });
    }
  
    // Force code to equal email for new users
    if (typeof data.email === 'string' && data.email.trim().length > 0) {
      data.code = data.email.trim();
    }

    if (!data.role || data.role.trim() === '') {
      data.role = 'sales';
    }

    // Check if email already exists globally
    const existingEmailUser = await db
      .select()
      .from(users)
      .where(eq(users.email, data.email.trim()))
      .limit(1);
    
    if (existingEmailUser.length > 0) {
      return NextResponse.json({ 
        success: false, 
        error: `User with email "${data.email}" already exists.` 
      }, { status: 400 });
    }

    // Check if code exists in tenant
    if (data.code) {
      const existingCodeUser = await db
        .select()
        .from(users)
        .where(and(
          eq(users.tenantId, tenantId),
          eq(users.code, data.code)
        ))
        .limit(1);
      
      if (existingCodeUser.length > 0) {
        return NextResponse.json({ 
          success: false, 
          error: `User with code "${data.code}" already exists in your organization` 
        }, { status: 400 });
      }
    }

    // Hash password with bcrypt
    const hashedPassword = await bcrypt.hash(data.password, 10);
    
    // Create user in database directly with admin created hashed password
    const userData = {
      email: data.email.trim(),
      password: hashedPassword,
      code: data.code || data.email.trim(),
      name: data.name.trim(),
      phone: data.phone ? data.phone.trim() : null,
      department: data.department ? data.department.trim() : null,
      status: data.status || 'Active',
      role: data.role || 'sales',
      target: data.target || 0,
      tenantId: tenantId,
    };

    const [newUser] = await db
      .insert(users)
      .values(userData)
      .returning({ id: users.id, email: users.email, name: users.name });

    // Optionally create user in Clerk directly (without email invitation)
    let organizationId: string | null = authResult.orgId || null;
    if (!organizationId && authResult.orgSlug) {
      organizationId = await getClerkOrganizationBySlug(authResult.orgSlug);
    }

    if (organizationId) {
      try {
        const clerk = await clerkClient();
        let clerkUserId: string | null = null;

        // Check if user already exists in Clerk
        const userList = await clerk.users.getUserList({
          emailAddress: [data.email.trim()],
        });

        if (userList.data && userList.data.length > 0) {
          clerkUserId = userList.data[0].id;
          // Update user password directly
          await clerk.users.updateUser(clerkUserId, {
            password: data.password,
          });
        } else {
          // Create user directly in Clerk with password
          const nameParts = data.name.trim().split(' ');
          const firstName = nameParts[0] || data.name.trim();
          const lastName = nameParts.slice(1).join(' ') || '';

          const createdClerkUser = await clerk.users.createUser({
            emailAddress: [data.email.trim()],
            password: data.password,
            firstName,
            lastName,
            skipPasswordRequirement: false,
          });
          clerkUserId = createdClerkUser.id;
        }

        // Add user to Clerk organization
        if (clerkUserId) {
          const clerkRole = data.role === 'teamleader' ? 'Admin' : 'org:salesexecutive';
          try {
            await clerk.organizations.createOrganizationMembership({
              organizationId,
              userId: clerkUserId,
              role: clerkRole,
            });
          } catch (memErr: any) {
            console.warn('Organization membership warning:', memErr?.message || memErr);
          }
        }
      } catch (clerkErr: any) {
        console.warn('Clerk sync warning (user still created in DB):', clerkErr?.message || clerkErr);
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'Team member created successfully',
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        phone: userData.phone,
        department: userData.department,
        status: userData.status,
        role: userData.role,
      }
    });

  } catch (error: any) {
    console.error('Error in POST /api/users:', error);
    return NextResponse.json({ 
      success: false, 
      error: error?.message || 'Failed to create user' 
    }, { status: 500 });
  }
}

// Update user (for team leader / admin)
export async function PUT(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return createUnauthorizedResponse(authResult.error, authResult.statusCode);
    }

    // Role check: Super Admin or Company Admin only
    const userRole = authResult.appRole || "";
    if (userRole !== "teamleader" && userRole !== "CEO" && !authResult.isAdmin) {
      return NextResponse.json(
        { success: false, error: "Only Super Admin or Company Admin can edit team members" },
        { status: 403 }
      );
    }

    const { id, ...updateData } = await request.json();
    const { tenantId } = await getTenantContextFromRequest(request);
    
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing user ID' }, { status: 400 });
    }

    const userId = parseInt(id, 10);
    if (isNaN(userId)) {
      return NextResponse.json({ success: false, error: 'Invalid user ID' }, { status: 400 });
    }
    
    delete updateData.id;

    // If password is being updated, hash it with bcrypt
    if (updateData.password && typeof updateData.password === 'string' && updateData.password.trim().length > 0) {
      if (updateData.password.length < 6) {
        return NextResponse.json({ success: false, error: 'Password must be at least 6 characters long' }, { status: 400 });
      }
      updateData.password = await bcrypt.hash(updateData.password, 10);
    } else {
      delete updateData.password; // Don't overwrite password with empty string
    }

    const updatePayload = {
      ...updateData,
      updatedAt: new Date()
    };
    
    let updateResult;
    if (tenantId) {
      updateResult = await db
        .update(users)
        .set(updatePayload)
        .where(and(
          eq(users.id, userId),
          eq(users.tenantId, tenantId)
        ))
        .returning({ id: users.id });
    } else {
      updateResult = await db
        .update(users)
        .set(updatePayload)
        .where(eq(users.id, userId))
        .returning({ id: users.id });
    }
    
    if (updateResult.length > 0) {
      return NextResponse.json({ success: true, message: 'User updated successfully' });
    } else {
      return NextResponse.json({ success: false, error: 'User not found or not updated' }, { status: 404 });
    }
  } catch (error: any) {
    console.error('Error updating user:', error);
    return NextResponse.json({ success: false, error: 'Failed to update user' }, { status: 500 });
  }
}

// Delete user (for team leader / admin)
export async function DELETE(request: NextRequest) {
  try {
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return createUnauthorizedResponse(authResult.error, authResult.statusCode);
    }

    // Role check: Super Admin or Company Admin only
    const userRole = authResult.appRole || "";
    if (userRole !== "teamleader" && userRole !== "CEO" && !authResult.isAdmin) {
      return NextResponse.json(
        { success: false, error: "Only Super Admin or Company Admin can delete team members" },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const idOrCode = searchParams.get('id');
    
    if (!idOrCode) {
      return NextResponse.json({ success: false, error: 'Missing user ID or code' }, { status: 400 });
    }

    let tenantId: number | null = null;
    if (authResult.orgSlug && authResult.orgId) {
      tenantId = await getTenantIdFromOrgSlug(
        authResult.orgSlug,
        authResult.orgId,
        authResult.orgSlug
      );
    }

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
        console.error('Error fetching current user tenantId for delete:', error);
      }
    }

    if (!tenantId) {
      const { tenantId: subdomainTenantId } = await getTenantContextFromRequest(request);
      if (subdomainTenantId) {
        tenantId = subdomainTenantId;
      }
    }

    if (!tenantId) {
      return NextResponse.json({ success: false, error: 'Tenant context required to delete user.' }, { status: 400 });
    }

    const userId = parseInt(idOrCode, 10);
    const isNumericId = !isNaN(userId);

    let userToDelete;
    
    if (isNumericId) {
      const userResult = await db
        .select({ id: users.id })
        .from(users)
        .where(and(
          eq(users.id, userId),
          eq(users.tenantId, tenantId)
        ))
        .limit(1);
      
      userToDelete = userResult[0];
    } else {
      const userResult = await db
        .select({ id: users.id })
        .from(users)
        .where(and(
          eq(users.code, idOrCode),
          eq(users.tenantId, tenantId)
        ))
        .limit(1);
      
      if (userResult.length === 0) {
        const userByEmail = await db
          .select({ id: users.id })
          .from(users)
          .where(and(
            eq(users.email, idOrCode),
            eq(users.tenantId, tenantId)
          ))
          .limit(1);
        
        userToDelete = userByEmail[0];
      } else {
        userToDelete = userResult[0];
      }
    }

    if (!userToDelete) {
      return NextResponse.json({ success: false, error: 'User not found in your organization' }, { status: 404 });
    }

    const deleteResult = await db
      .delete(users)
      .where(and(
        eq(users.id, userToDelete.id),
        eq(users.tenantId, tenantId)
      ))
      .returning({ id: users.id, email: users.email });
  
    if (deleteResult.length > 0) {
      return NextResponse.json({ success: true, message: 'User deleted successfully' });
    } else {
      return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });
    }
  } catch (error: any) {
    console.error('Error deleting user:', error);
    return NextResponse.json({ success: false, error: 'Failed to delete user' }, { status: 500 });
  }
}
