import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db/client';
import { tenants, users } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { getTenantContextFromRequest } from '@/lib/mongoTenant';
import { authenticateRequest, createUnauthorizedResponse } from '@/lib/clerkAuth';

export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request);
  if (!authResult.success) {
    return createUnauthorizedResponse(authResult.error, authResult.statusCode);
  }

  if (!authResult.email) {
    return NextResponse.json({ 
      success: false, 
      error: 'User email not found' 
    }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const identifier = searchParams.get('identifier');
  const email = identifier || authResult.email;

  try {
    const { tenantId } = await getTenantContextFromRequest(request);
    
    let userResult;
    if (tenantId) {
      userResult = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          code: users.code,
          role: users.role,
          target: users.target,
          tenantId: users.tenantId,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
          tenantSubdomain: tenants.subdomain,
        })
        .from(users)
        .leftJoin(tenants, eq(users.tenantId, tenants.id))
        .where(and(
          eq(users.email, email),
          eq(users.tenantId, tenantId)
        ))
        .limit(1);
    } else {
      userResult = await db
        .select({
          id: users.id,
          email: users.email,
          name: users.name,
          code: users.code,
          role: users.role,
          target: users.target,
          tenantId: users.tenantId,
          createdAt: users.createdAt,
          updatedAt: users.updatedAt,
          tenantSubdomain: tenants.subdomain,
        })
        .from(users)
        .leftJoin(tenants, eq(users.tenantId, tenants.id))
        .where(eq(users.email, email))
        .limit(1);
    }

    const user = userResult[0];

    if (!user) {
      return NextResponse.json({ 
        success: false, 
        error: 'User not found' 
      }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Error fetching current user:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to fetch user' 
    }, { status: 500 });
  }
}


