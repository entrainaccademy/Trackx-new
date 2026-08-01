import { NextRequest } from "next/server";
import { db } from "@/db/client";
import { leads, leadEvents, leadListItems, users } from "@/db/schema";
import { requireTenantIdFromRequest } from "@/lib/tenant";
import { eq } from "drizzle-orm";

// Normalize phone by extracting the first 10+ digit run, and cap to 15 digits
function normalizePhone(value: any): string | null {
  if (value === null || value === undefined) return null;
  const raw = String(value);
  const cleaned = raw.replace(/[\u00A0\u2000-\u200F\u2028-\u202F\u205F\u3000]/g, ' ');
  const digitRuns = cleaned.match(/\d{10,}/g);
  if (!digitRuns || digitRuns.length === 0) return null;
  let digits = digitRuns[0];
  if (digits.length > 15) digits = digits.slice(-15);
  return digits;
}

function safeStr(value: any, max: number): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;
  return s.length > max ? s.slice(0, max) : s;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    const listId = body?.listId;
    let tenantId: number;
    try {
      tenantId = await requireTenantIdFromRequest(req as any);
    } catch {
      return new Response(JSON.stringify({ success: false, error: "Tenant not resolved" }), { status: 400 });
    }
    if (rows.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "rows array required" }), { status: 400 });
    }
    // Build owner lookup (code/email -> email) from PostgreSQL users, scoped by tenant
    let ownerLookup: Map<string, string> | null = null;
    try {
      const userDocs = await db
        .select({
          code: users.code,
          email: users.email,
        })
        .from(users)
        .where(eq(users.tenantId, tenantId));
      
      ownerLookup = new Map<string, string>();
      for (const u of userDocs) {
        const code = u.code;
        const email = u.email;
        if (typeof email === "string" && email.trim().length > 0) {
          ownerLookup.set(email, email);
        }
        if (typeof code === "string" && code && code.trim().length > 0 && typeof email === "string" && email.trim().length > 0) {
          ownerLookup.set(code, email);
        }
      }
    } catch {
      ownerLookup = null;
    }
    const phoneToOwnerEmail = new Map<string, string>();
    const phoneToNotes = new Map<string, string>();
    const values = rows
      .map((r: any) => {
        const phone = normalizePhone(r.phone);
        // Accept owner via various column names
        const ownerRaw = safeStr(r.owner, 320) || safeStr(r.ownerId, 320) || safeStr(r.ownerEmail, 320) || safeStr(r.owner_email, 320);
        let resolvedOwner: string | null = null;
        if (ownerRaw) {
          const byLookup = ownerLookup?.get(ownerRaw);
          if (byLookup) {
            resolvedOwner = byLookup;
          } else if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(ownerRaw)) {
            resolvedOwner = ownerRaw;
          }
        }
        // Capture notes for later event creation
        const notes = safeStr(r.notes, 5000);
        if (phone && notes) {
          phoneToNotes.set(phone, notes);
        }
        return {
          phone: phone || undefined,
          name: safeStr(r.name, 160),
          email: safeStr(r.email, 256),
          address: safeStr(r.address, 1000),
          alternateNumber: safeStr(r.alternateNumber, 32),
          source: safeStr(r.source, 64),
          stage: safeStr(r.stage, 48) || "Not contacted",
          score: typeof r.score === "number" ? r.score : Number.isFinite(Number(r.score)) ? Number(r.score) : 0,
          ownerId: (() => {
            if (phone && resolvedOwner) {
              phoneToOwnerEmail.set(phone, resolvedOwner);
            }
            return resolvedOwner || undefined;
          })(),
          tenantId: tenantId,
        };
      })
      .filter((v: { phone?: string }) => typeof v.phone === "string" && v.phone.length >= 10);

    if (values.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "no valid rows with phone" }), { status: 400 });
    }

    const inserted = await db
      .insert(leads)
      .values(values as any)
      .onConflictDoNothing({ target: [leads.tenantId, leads.phone] })
      .returning({ phone: leads.phone, source: leads.source });

    // timeline events for created leadsAll systems operational

    if (inserted.length) {
      const ev = inserted
        .filter((r: any) => r.phone)
        .map((r: { phone: string; source: string | null }) => ({ leadPhone: r.phone, type: "CREATED", data: { source: r.source }, at: new Date(), tenantId: tenantId }));
      if (ev.length) await db.insert(leadEvents).values(ev as any);
      // ASSIGNED events for imported owner assignments
      const assigned = inserted
        .filter((r: any) => r.phone && phoneToOwnerEmail.has(r.phone))
        .map((r: { phone: string }) => ({
          leadPhone: r.phone,
          type: "ASSIGNED",
          data: { from: "unassigned", to: phoneToOwnerEmail.get(r.phone), actorId: "system" },
          at: new Date(),
          tenantId: tenantId,
        }));
      if (assigned.length) await db.insert(leadEvents).values(assigned as any);
      
      // NOTE_ADDED events for imported notes
      const noteEvents = inserted
        .filter((r: any) => r.phone && phoneToNotes.has(r.phone))
        .map((r: { phone: string }) => ({
          leadPhone: r.phone,
          type: "NOTE_ADDED",
          data: { note: phoneToNotes.get(r.phone) },
          at: new Date(),
          tenantId: tenantId,
        }));
      if (noteEvents.length) await db.insert(leadEvents).values(noteEvents as any);
      
      // Add to list if listId is provided
      if (listId && typeof listId === "number" && inserted.length > 0) {
        try {
          const listItems = inserted
            .filter((r: any) => r.phone)
            .map((r: { phone: string }) => ({
              listId: listId,
              leadPhone: r.phone,
              tenantId: tenantId,
            }));
          
          if (listItems.length > 0) {
            await db.insert(leadListItems).values(listItems as any).onConflictDoNothing();
          }
        } catch (listError) {
          console.error("Failed to add leads to list:", listError);
          // Don't fail the entire operation if list addition fails
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, inserted: inserted.length, skipped: values.length - inserted.length }),
      { status: 201 }
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ success: false, error: e?.message || "import failed" }), { status: 500 });
  }
}


