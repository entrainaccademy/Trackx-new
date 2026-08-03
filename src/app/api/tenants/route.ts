import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { tenants, users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { existsSync } from "fs";
import { authenticateRequest, createUnauthorizedResponse } from "@/lib/clerkAuth";
import { currentUser } from "@clerk/nextjs/server";
import { syncTenantToClerkOrganization } from "@/lib/clerkOrganization";

/**
 * Link Clerk user to tenant - updates existing user or creates new one
 */
async function linkClerkUserToTenant(clerkEmail: string, tenantId: number, contactName: string) {
  try {
    // Check if user already exists in database
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, clerkEmail))
      .limit(1);

    if (existingUser.length > 0) {
      // User exists - update tenantId and role
      const user = existingUser[0];
      await db
        .update(users)
        .set({
          tenantId: tenantId,
          role: "teamleader",
          name: contactName || user.name,
          code: clerkEmail, // Ensure code matches email
          updatedAt: new Date(),
        })
        .where(eq(users.email, clerkEmail));

      console.log(`Linked existing Clerk user to tenant:`, {
        email: clerkEmail,
        tenantId: tenantId,
        userId: user.id,
      });
    } else {
      // User doesn't exist - create new user
      const firstName = contactName.split(" ")[0] || "";
      const lastName = contactName.split(" ").slice(1).join(" ") || "";
      const name = contactName || clerkEmail.split("@")[0];

      const [newUser] = await db
        .insert(users)
        .values({
          email: clerkEmail,
          code: clerkEmail, // Use email as code
          name: name,
          role: "teamleader",
          password: "", // No password needed for Clerk users
          target: 0,
          tenantId: tenantId,
        })
        .returning();

      console.log(`Created and linked new Clerk user to tenant:`, {
        email: clerkEmail,
        tenantId: tenantId,
        userId: newUser.id,
      });
    }
  } catch (error: any) {
    console.error("Error linking Clerk user to tenant:", error);
    throw error;
  }
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const subdomain = url.searchParams.get('subdomain');
    
    if (!subdomain) {
      return NextResponse.json({ error: "Subdomain parameter is required" }, { status: 400 });
    }

    const normalizedSubdomain = subdomain.trim().toLowerCase();
    
    // Check if subdomain already exists
    const existing = await db
      .select({ id: tenants.id })
      .from(tenants)
      .where(eq(tenants.subdomain, normalizedSubdomain))
      .limit(1);

    return NextResponse.json({ 
      exists: !!existing[0]?.id,
      subdomain: normalizedSubdomain 
    });
  } catch (err: any) {
    console.error("Subdomain check error:", err);
    return NextResponse.json({ error: err?.message || "Failed to check subdomain" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate the request - tenant creation requires Clerk authentication
    const authResult = await authenticateRequest(req);
    if (!authResult.success) {
      return createUnauthorizedResponse(authResult.error, authResult.statusCode);
    }

    // Get Clerk user details
    const clerkUser = await currentUser();
    if (!clerkUser) {
      return NextResponse.json(
        { error: "Clerk user not found" },
        { status: 404 }
      );
    }

    const clerkEmail = clerkUser.emailAddresses[0]?.emailAddress;
    if (!clerkEmail) {
      return NextResponse.json(
        { error: "Email not found in Clerk user" },
        { status: 400 }
      );
    }

    // Check if the request is multipart/form-data (file upload)
    const contentType = req.headers.get("content-type");
    
    if (contentType && contentType.includes("multipart/form-data")) {
      // Handle file upload
      const formData = await req.formData();
      const subdomain = String(formData.get("subdomain") || "").trim().toLowerCase();
      const name = String(formData.get("name") || subdomain);
      const metadataRaw = formData.get("metadata");
      const metadata = metadataRaw ? JSON.parse(String(metadataRaw)) : null;
      const contactName = metadata?.contactName || clerkUser.firstName || "";
      const logoFile = formData.get("logo") as File | null;

      if (!subdomain || !/^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(subdomain)) {
        return NextResponse.json({ error: "Invalid subdomain" }, { status: 400 });
      }

      if (metadata?.staffCount !== undefined && (typeof metadata.staffCount !== 'number' || metadata.staffCount <= 0)) {
        return NextResponse.json({ error: "Company Staff Count must be a positive numeric value" }, { status: 400 });
      }

      const existing = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.subdomain, subdomain))
        .limit(1);
      if (existing[0]?.id) {
        return NextResponse.json({ error: "Subdomain already exists" }, { status: 409 });
      }

      // First, create/update Clerk organization and get the org slug
      // This ensures the tenant subdomain matches the Clerk org slug
      const orgSyncResult = await syncTenantToClerkOrganization(
        subdomain,
        name,
        clerkUser.id
      );

      // Use the actual Clerk org slug (which may differ from requested subdomain)
      // Get the org details to get the actual slug
      let actualOrgSlug = subdomain;
      if (orgSyncResult.success && orgSyncResult.organizationId) {
        try {
          const { clerkClient } = await import("@clerk/nextjs/server");
          const clerk = await clerkClient();
          const org = await clerk.organizations.getOrganization({
            organizationId: orgSyncResult.organizationId,
          });
          actualOrgSlug = org.slug || subdomain;
        } catch (error) {
          console.warn("Could not fetch org details, using requested subdomain:", error);
        }
      }

      // Check if tenant with actual org slug already exists
      const existingBySlug = await db
        .select({ id: tenants.id })
        .from(tenants)
        .where(eq(tenants.subdomain, actualOrgSlug))
        .limit(1);

      let tenantId: number;
      let inserted: typeof tenants.$inferSelect[];
      
      if (existingBySlug[0]?.id) {
        // Tenant exists, update it
        tenantId = existingBySlug[0].id;
        await db
          .update(tenants)
          .set({
            name: name,
            metadata: {
              ...metadata,
              clerkOrgId: orgSyncResult.organizationId,
              clerkOrgSlug: actualOrgSlug,
            },
            updatedAt: new Date(),
          })
          .where(eq(tenants.id, tenantId));
        
        const [updated] = await db
          .select()
          .from(tenants)
          .where(eq(tenants.id, tenantId))
          .limit(1);
        
        inserted = [updated];
      } else {
        // Create tenant with the actual Clerk org slug as subdomain
        const insertedTenants = await db
          .insert(tenants)
          .values({
            subdomain: actualOrgSlug,
            name: name,
            metadata: {
              ...metadata,
              clerkOrgId: orgSyncResult.organizationId,
              clerkOrgSlug: actualOrgSlug,
            },
          })
          .returning();

        tenantId = insertedTenants[0].id;
        inserted = insertedTenants;
      }

      // Handle logo upload if provided
      if (logoFile && logoFile instanceof File) {
        try {
          // Create uploads directory if it doesn't exist
          const uploadsDir = join(process.cwd(), "public", "uploads", "logos", tenantId.toString());
          if (!existsSync(uploadsDir)) {
            await mkdir(uploadsDir, { recursive: true });
          }

          // Generate unique filename
          const fileExtension = logoFile.name.split('.').pop();
          const fileName = `logo.${fileExtension}`;
          const filePath = join(uploadsDir, fileName);

          // Convert File to Buffer and save
          const bytes = await logoFile.arrayBuffer();
          const buffer = Buffer.from(bytes);
          await writeFile(filePath, buffer);

          // Update tenant with logo path
          const logoPath = `/uploads/logos/${tenantId}/${fileName}`;
          
          await db
            .update(tenants)
            .set({ 
              metadata: { 
                ...metadata, 
                logoPath: logoPath
              } 
            })
            .where(eq(tenants.id, tenantId));

        } catch (logoError) {
          console.error("Logo upload failed:", logoError);
          // Logo upload failed, but tenant was created successfully
          // We don't want to fail the entire request for logo issues
        }
      }

      // Link Clerk user to tenant
      const contactNameFromMetadata = metadata?.contactName || clerkUser.firstName || "";
      await linkClerkUserToTenant(clerkEmail, tenantId, contactNameFromMetadata);

      if (!orgSyncResult.success) {
        console.warn("Failed to sync tenant to Clerk organization:", orgSyncResult.error);
        // Don't fail the tenant creation if org sync fails - tenant was created successfully
        // We can sync later if needed
      } else {
        console.log(`Successfully synced tenant "${actualOrgSlug}" to Clerk organization:`, orgSyncResult.organizationId);
      }

      return NextResponse.json({ 
        tenant: inserted[0],
        subdomain: actualOrgSlug, // Return the actual org slug used
        organizationId: orgSyncResult.organizationId,
        organizationSynced: orgSyncResult.success
      }, { status: 201 });
    } else {
      // This branch is not used anymore - all tenant creation goes through multipart/form-data
      // But keeping it for backward compatibility
      return NextResponse.json({ error: "Please use the onboarding form" }, { status: 400 });
    }
  } catch (err: any) {
    console.error("Tenant creation error:", err);
    return NextResponse.json({ error: err?.message || "Failed to create tenant" }, { status: 500 });
  }
}


