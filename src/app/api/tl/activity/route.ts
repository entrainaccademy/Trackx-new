import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { leads, leadEvents, users } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { getTenantContextFromRequest } from "@/lib/mongoTenant";
import { addPerformanceHeaders, CACHE_DURATION } from "@/lib/performance";

function summarizeEvent(e: any, leadName: string | null | undefined, nameByCode: Map<string, string> | null) {
  const t = e.type as string;
  const lp = e.leadPhone as string;
  const actorCode = e.actorId as string | null;
  const actorName = actorCode && nameByCode ? nameByCode.get(actorCode) : undefined;
  const who = actorCode ? ` by ${actorName || actorCode}` : "";
  const name = leadName || lp;
  // Simple mapping of known event types to readable messages and colors
  switch (t) {
    case "CREATED":
      return { title: `Lead created`, detail: name, color: "green" };
    case "ASSIGNED": {
      const fromOwner = e.data?.from ? String(e.data.from) : "unassigned";
      const toOwner = e.data?.to ? String(e.data.to) : "";
      const actorId = e.data?.actorId || e.actorId;
      
      if (actorId && actorId !== "system") {
        const actorName = nameByCode?.get(String(actorId)) || actorId;
        const fromOwnerName = fromOwner === "unassigned" ? "Unassigned" : (nameByCode?.get(fromOwner) || fromOwner);
        const toOwnerName = nameByCode?.get(toOwner) || toOwner;
        return { title: `${actorName} reassigned lead`, detail: `${fromOwnerName} → ${toOwnerName}`, color: "blue" };
      } else {
        const fromOwnerName = fromOwner === "unassigned" ? "Unassigned" : (nameByCode?.get(fromOwner) || fromOwner);
        const toOwnerName = nameByCode?.get(toOwner) || toOwner;
        return { title: `Lead reassigned`, detail: `${fromOwnerName} → ${toOwnerName}`, color: "blue" };
      }
    }
    case "CALL_STARTED":
      return { title: `Call started${who}` , detail: name, color: "amber" };
    case "CALL_ENDED":
      return { title: `Call ended${who}` , detail: name, color: "slate" };
    case "CALL_OUTCOME": {
      const status = e.data?.status ? String(e.data.status) : "updated";
      return { title: `Call outcome: ${status}`, detail: name, color: "purple" };
    }
    case "CALL_LOGGED": {
      const status = e.data?.status ? String(e.data.status) : "logged";
      return { title: `Call logged${status ? `: ${status}` : ""}`, detail: name, color: "purple" };
    }
    case "LEAD_STATUS_CHANGED": {
      const stage = e.data?.stage ? String(e.data.stage) : "updated";
      return { title: `Lead stage → ${stage}`, detail: name, color: "cyan" };
    }
    // Backward/forward compatibility
    case "CALL_OUTCOME_RECORDED": {
      const status = e.data?.status ? String(e.data.status) : "updated";
      return { title: `Call outcome: ${status}`, detail: name, color: "purple" };
    }
    case "STAGE_CHANGE": {
      const fromStage = e.data?.from ? String(e.data.from) : "Unknown";
      const toStage = e.data?.to ? String(e.data.to) : "Unknown";
      const actorId = e.data?.actorId || e.actorId;
      
      if (actorId) {
        const actorName = nameByCode?.get(String(actorId)) || actorId;
        return { title: `${actorName} updated stage`, detail: `${fromStage} → ${toStage}`, color: "cyan" };
      } else {
        return { title: `Stage changed`, detail: `${fromStage} → ${toStage}`, color: "cyan" };
      }
    }
    default:
      return { title: t.replaceAll("_", " "), detail: name, color: "indigo" };
  }
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Number(searchParams.get("limit") || 10);
    let { tenantSubdomain, tenantId } = await getTenantContextFromRequest(req as any);

    // If tenantId missing but subdomain present, resolve tenantId from DB
    if (!tenantId && tenantSubdomain) {
      try {
        const tenantRow = await db.select({ id: (await import("@/db/schema")).tenants.id })
          .from((await import("@/db/schema")).tenants)
          .where(eq((await import("@/db/schema")).tenants.subdomain, tenantSubdomain))
          .limit(1);
        if (Array.isArray(tenantRow) && tenantRow.length > 0) {
          tenantId = tenantRow[0].id as any;
        }
      } catch {}
    }

    // Optional: load users to resolve codes -> names
    let nameByCode: Map<string, string> | null = null;
    try {
      if (tenantId) {
        const userDocs = await db
          .select({
            code: users.code,
            name: users.name,
          })
          .from(users)
          .where(eq(users.tenantId, tenantId));
        
        nameByCode = new Map<string, string>();
        for (const u of userDocs) {
          if (typeof u.code === "string" && u.code && typeof u.name === "string" && u.name) {
            nameByCode.set(u.code, u.name);
          }
        }
      }
    } catch {
      // If lookup fails, proceed without names
      nameByCode = null;
    }

    // If we still don't have a tenantId, return empty to avoid cross-tenant leakage
    if (!tenantId) {
      return new Response(JSON.stringify({ success: true, items: [] }), { status: 200 });
    }

    const rows = await db
      .select({
        id: leadEvents.id,
        at: leadEvents.at,
        type: leadEvents.type,
        data: leadEvents.data,
        actorId: leadEvents.actorId,
        leadPhone: leadEvents.leadPhone,
        leadName: leads.name,
      })
      .from(leadEvents)
      .leftJoin(leads, eq(leads.phone, leadEvents.leadPhone))
      .where(
        and(eq(leadEvents.tenantId, tenantId))
      )
      .orderBy(desc(leadEvents.at))
      .limit(limit);

    const seenIds = new Set<any>();
    const uniqueRows: any[] = [];
    for (const r of rows) {
      if (!seenIds.has(r.id)) {
        seenIds.add(r.id);
        uniqueRows.push(r);
      }
    }

    const items = uniqueRows.map((r: any) => {
      const summary = summarizeEvent(r, r.leadName, nameByCode);
      return {
        id: r.id,
        at: r.at,
        type: r.type,
        leadPhone: r.leadPhone,
        actorId: r.actorId || null,
        title: summary.title,
        detail: summary.detail,
        color: summary.color,
      };
    });

    const response = NextResponse.json({ success: true, items });
    return addPerformanceHeaders(response, CACHE_DURATION.SHORT);
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e?.message || "Failed to fetch activity" }), { status: 500 });
  }
}
