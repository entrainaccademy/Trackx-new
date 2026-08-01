import { NextRequest, NextResponse } from "next/server";
import { and, eq, sql } from "drizzle-orm";
import { sql as dsql } from "drizzle-orm";
import { db } from "@/db/client";
import { leadLists, leadListItems } from "@/db/schema";
import { requireTenantIdFromRequest } from "@/lib/tenant";
import { addPerformanceHeaders, CACHE_DURATION } from "@/lib/performance";

async function ensureTables() {
  try {
    await db.execute(dsql`CREATE TABLE IF NOT EXISTS lead_lists (
      id SERIAL PRIMARY KEY,
      name VARCHAR(160) NOT NULL,
      tenant_id INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await db.execute(dsql`CREATE TABLE IF NOT EXISTS lead_list_items (
      id SERIAL PRIMARY KEY,
      list_id INTEGER NOT NULL,
      lead_phone VARCHAR(32) NOT NULL,
      tenant_id INTEGER,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )`);
    await db.execute(dsql`CREATE UNIQUE INDEX IF NOT EXISTS lead_list_items_unique ON lead_list_items (list_id, lead_phone, tenant_id)`);
  } catch (e: any) {
    console.error("ensureTables error:", e?.message);
  }
}

export async function GET(req: NextRequest) {
  try {
    await ensureTables();
    const { searchParams } = new URL(req.url);
    const listId = searchParams.get("listId");
    const tenantId = await requireTenantIdFromRequest(req as any).catch(() => undefined);
    
    if (listId) {
      // Return items for a specific list
      const items = await db
        .select({ leadPhone: leadListItems.leadPhone })
        .from(leadListItems)
        .where(tenantId ? and(eq(leadListItems.listId, Number(listId)), eq(leadListItems.tenantId, tenantId)) : eq(leadListItems.listId, Number(listId)));
      const response = NextResponse.json({ success: true, items });
      return addPerformanceHeaders(response, CACHE_DURATION.SHORT);
    }
    
    // Return all lists
    const rows = await db
      .select({ id: leadLists.id, name: leadLists.name, createdAt: leadLists.createdAt })
      .from(leadLists)
      .where(tenantId ? eq(leadLists.tenantId, tenantId) : (sql`1=1` as any))
      .orderBy(leadLists.createdAt);
    const response = NextResponse.json({ success: true, rows });
    return addPerformanceHeaders(response, CACHE_DURATION.SHORT);
  } catch (e: any) {
    console.error("GET /api/tl/lists error:", e?.message);
    return NextResponse.json({ success: false, error: e?.message || "Failed to fetch lists" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    await ensureTables();
    const body = await req.json().catch(() => ({}));
    const name = body?.name;
    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json({ success: false, error: "name is required" }, { status: 400 });
    }
    const tenantId = await requireTenantIdFromRequest(req as any).catch(() => undefined);
    const [created] = await db
      .insert(leadLists)
      .values({ name: name.trim(), tenantId: tenantId || null } as any)
      .returning({ id: leadLists.id, name: leadLists.name });
    return NextResponse.json({ success: true, list: created }, { status: 201 });
  } catch (e: any) {
    console.error("POST /api/tl/lists error:", e?.message);
    return NextResponse.json({ success: false, error: e?.message || "Failed to create list" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    await ensureTables();
    const body = await req.json().catch(() => ({}));
    const { listId, phones } = body;
    console.log("PUT request - listId:", listId, "phones:", phones);
    
    if (!listId || !Array.isArray(phones) || phones.length === 0) {
      return NextResponse.json({ success: false, error: "listId and phones[] required" }, { status: 400 });
    }
    const tenantId = await requireTenantIdFromRequest(req as any).catch(() => undefined);

    // Ensure list belongs to tenant
    const exists = await db
      .select({ id: leadLists.id })
      .from(leadLists)
      .where(tenantId ? and(eq(leadLists.id, Number(listId)), eq(leadLists.tenantId, tenantId)) : eq(leadLists.id, Number(listId)))
      .limit(1);
    if (!exists.length) {
      return NextResponse.json({ success: false, error: "List not found" }, { status: 404 });
    }

    const values = (phones as string[]).map((p) => ({ listId: Number(listId), leadPhone: String(p), tenantId: tenantId || null } as any));
    
    let insertedCount = 0;
    for (const v of values) {
      try {
        await db.insert(leadListItems).values(v).onConflictDoNothing();
        insertedCount++;
      } catch (insertError: any) {
        console.log("Failed to insert phone item:", v, "Error:", insertError?.message);
      }
    }

    return NextResponse.json({ success: true, inserted: insertedCount }, { status: 200 });
  } catch (e: any) {
    console.error("PUT /api/tl/lists error:", e?.message);
    return NextResponse.json({ success: false, error: e?.message || "Failed to add to list" }, { status: 500 });
  }
} 

export async function PATCH(req: NextRequest) {
  try {
    await ensureTables();
    return NextResponse.json({ success: true, message: "Tables created" }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || "Failed to create tables" }, { status: 500 });
  }
} 

export async function DELETE(req: NextRequest) {
  try {
    await ensureTables();
    const body = await req.json().catch(() => ({}));
    const { listId } = body;
    if (!listId || Number.isNaN(Number(listId))) {
      return NextResponse.json({ success: false, error: "listId is required" }, { status: 400 });
    }
    const tenantId = await requireTenantIdFromRequest(req as any).catch(() => undefined);

    // Ensure list exists and belongs to tenant
    const exists = await db
      .select({ id: leadLists.id })
      .from(leadLists)
      .where(
        tenantId
          ? and(eq(leadLists.id, Number(listId)), eq(leadLists.tenantId, tenantId))
          : eq(leadLists.id, Number(listId))
      )
      .limit(1);

    if (!exists.length) {
      return NextResponse.json({ success: false, error: "List not found" }, { status: 404 });
    }

    // Delete items first, then the list
    if (tenantId) {
      await db.delete(leadListItems).where(and(eq(leadListItems.listId, Number(listId)), eq(leadListItems.tenantId, tenantId)) as any);
      await db.delete(leadLists).where(and(eq(leadLists.id, Number(listId)), eq(leadLists.tenantId, tenantId)) as any);
    } else {
      await db.delete(leadListItems).where(eq(leadListItems.listId, Number(listId)) as any);
      await db.delete(leadLists).where(eq(leadLists.id, Number(listId)) as any);
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e: any) {
    console.error("DELETE /api/tl/lists error:", e?.message);
    return NextResponse.json({ success: false, error: e?.message || "Failed to delete list" }, { status: 500 });
  }
}