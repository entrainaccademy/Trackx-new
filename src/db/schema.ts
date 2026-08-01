import { pgTable, varchar, integer, timestamp, boolean, jsonb, serial, text, uniqueIndex, index } from "drizzle-orm/pg-core";
import { sql as dsql } from "drizzle-orm";

export const leads = pgTable(
  "leads",
  {
    id: serial("id").primaryKey(),
    phone: varchar("phone", { length: 32 }).notNull(),
    name: varchar("name", { length: 160 }),
    email: varchar("email", { length: 256 }),
    address: text("address"),
    alternateNumber: varchar("alternate_number", { length: 32 }),
    source: varchar("source", { length: 64 }),
    utm: jsonb("utm"),
    stage: varchar("stage", { length: 48 }).notNull().default("Not contacted"), // Default stage for new leads
    ownerId: varchar("owner_id", { length: 64 }),
    score: integer("score").default(0),
    lastActivityAt: timestamp("last_activity_at", { withTimezone: true }),
    needFollowup: boolean("need_followup").default(false),
    followupDate: timestamp("followup_date", { withTimezone: true }),
    followupNotes: text("followup_notes"),
    courseId: integer("course_id"), // Reference to courses table
    paidAmount: integer("paid_amount"), // Amount paid in cents
    tenantId: integer("tenant_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
    consent: boolean("consent").default(true),
  },
  (t) => ({
    leadsTenantPhoneIdx: uniqueIndex("leads_tenant_phone_idx").on(t.tenantId, t.phone),
    // Performance indexes for common queries
    leadsTenantIdx: index("leads_tenant_idx").on(t.tenantId),
    leadsOwnerIdx: index("leads_owner_idx").on(t.ownerId),
    leadsStageIdx: index("leads_stage_idx").on(t.stage),
    leadsCreatedAtIdx: index("leads_created_at_idx").on(t.createdAt),
    leadsUpdatedAtIdx: index("leads_updated_at_idx").on(t.updatedAt),
    leadsLastActivityIdx: index("leads_last_activity_idx").on(t.lastActivityAt),
    leadsFollowupIdx: index("leads_followup_idx").on(t.needFollowup, t.followupDate),
  })
);

export const tasks = pgTable(
  "tasks",
  {
    id: serial("id").primaryKey(),
    leadPhone: varchar("lead_phone", { length: 32 }).notNull(),
    title: varchar("title", { length: 160 }).notNull(),
    // PENDING | DONE | SKIPPED | OPEN (backward compatibility)
    status: varchar("status", { length: 24 }).notNull().default("OPEN"),
    // CALL | FOLLOWUP | OTHER
    type: varchar("type", { length: 24 }).default("OTHER"),
    ownerId: varchar("owner_id", { length: 64 }),
    priority: varchar("priority", { length: 16 }).default("MEDIUM"), // LOW | MEDIUM | HIGH
    dueAt: timestamp("due_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    tenantId: integer("tenant_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    // Performance indexes for tasks
    tasksTenantIdx: index("tasks_tenant_idx").on(t.tenantId),
    tasksOwnerIdx: index("tasks_owner_idx").on(t.ownerId),
    tasksStatusIdx: index("tasks_status_idx").on(t.status),
    tasksDueAtIdx: index("tasks_due_at_idx").on(t.dueAt),
    tasksLeadPhoneIdx: index("tasks_lead_phone_idx").on(t.leadPhone),
    tasksCreatedAtIdx: index("tasks_created_at_idx").on(t.createdAt),
  })
);

export const integrations = pgTable(
  "integrations",
  {
    id: serial("id").primaryKey(),
    provider: varchar("provider", { length: 64 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    status: varchar("status", { length: 32 }).notNull().default("NOT_CONFIGURED"),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    metrics24h: jsonb("metrics_24h"),
    tenantId: integer("tenant_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  }
);

export const settings = pgTable(
  "settings",
  {
    key: varchar("key", { length: 100 }).primaryKey().notNull(),
    value: jsonb("value").notNull(),
    tenantId: integer("tenant_id"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  }
);

export const leadEvents = pgTable(
  "lead_events",
  {
    id: serial("id").primaryKey(),
    leadPhone: varchar("lead_phone", { length: 32 }).notNull(),
    type: varchar("type", { length: 48 }).notNull(),
    data: jsonb("data"),
    at: timestamp("at", { withTimezone: true }).defaultNow(),
    actorId: varchar("actor_id", { length: 64 }),
    tenantId: integer("tenant_id"),
  }
);

export const callLogs = pgTable(
  "call_logs",
  {
    id: serial("id").primaryKey(),
    leadPhone: varchar("lead_phone", { length: 32 }).notNull(),
    salespersonId: varchar("salesperson_id", { length: 64 }),
    phone: varchar("phone", { length: 32 }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    durationMs: integer("duration_ms"),
    completed: boolean("completed").default(false),
    qualified: boolean("qualified"),
    status: varchar("status", { length: 32 }).default("NONE"),
    notes: text("notes"),
    tenantId: integer("tenant_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    // Performance indexes for call logs
    callLogsTenantIdx: index("call_logs_tenant_idx").on(t.tenantId),
    callLogsLeadPhoneIdx: index("call_logs_lead_phone_idx").on(t.leadPhone),
    callLogsSalespersonIdx: index("call_logs_salesperson_idx").on(t.salespersonId),
    callLogsStartedAtIdx: index("call_logs_started_at_idx").on(t.startedAt),
    callLogsCreatedAtIdx: index("call_logs_created_at_idx").on(t.createdAt),
    callLogsCompletedIdx: index("call_logs_completed_idx").on(t.completed),
  })
);

// Multi-tenant: tenants registry
export const tenants = pgTable(
  "tenants",
  {
    id: serial("id").primaryKey(),
    subdomain: varchar("subdomain", { length: 255 }).notNull().unique(),
    name: varchar("name", { length: 255 }).notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdateFn(() => dsql`now()`),
  }
);

// Lead lists (saved views) per tenant
export const leadLists = pgTable(
  "lead_lists",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    tenantId: integer("tenant_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  }
);

// Items in a lead list (phones)
export const leadListItems = pgTable(
  "lead_list_items",
  {
    id: serial("id").primaryKey(),
    listId: integer("list_id").notNull(),
    leadPhone: varchar("lead_phone", { length: 32 }).notNull(),
    tenantId: integer("tenant_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    uniq: uniqueIndex("lead_list_items_unique").on(t.listId, t.leadPhone, t.tenantId),
  })
);

// Lead stages - customizable per tenant
export const leadStages = pgTable(
  "lead_stages",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 64 }).notNull(),
    color: varchar("color", { length: 32 }).notNull().default("slate"), // tailwind color name
    order: integer("order").notNull().default(0),
    isDefault: boolean("is_default").default(false), // Can't be deleted if true
    tenantId: integer("tenant_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    stageTenantNameIdx: uniqueIndex("stage_tenant_name_idx").on(t.tenantId, t.name),
  })
);

// Courses - customizable per tenant
export const courses = pgTable(
  "courses",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    price: integer("price").notNull(), // Price in cents to avoid floating point issues
    description: text("description"),
    isActive: boolean("is_active").default(true),
    tenantId: integer("tenant_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    courseTenantNameIdx: uniqueIndex("course_tenant_name_idx").on(t.tenantId, t.name),
  })
);

// Users - migrated from MongoDB
export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 256 }).notNull().unique(),
    password: varchar("password", { length: 255 }).notNull(),
    code: varchar("code", { length: 255 }),
    name: varchar("name", { length: 255 }),
    role: varchar("role", { length: 32 }).notNull().default("sales"), // teamleader | jl | sales | CEO
    phone: varchar("phone", { length: 32 }),
    department: varchar("department", { length: 100 }),
    status: varchar("status", { length: 20 }).default("Active"), // Active | Inactive
    target: integer("target").default(0),
    tenantId: integer("tenant_id"),
    lastLogin: timestamp("last_login", { withTimezone: true }),
    lastLogout: timestamp("last_logout", { withTimezone: true }),
    lastTokenRevocation: timestamp("last_token_revocation", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    usersEmailIdx: uniqueIndex("users_email_idx").on(t.email),
    usersTenantCodeIdx: uniqueIndex("users_tenant_code_idx").on(t.tenantId, t.code),
    usersTenantIdx: index("users_tenant_idx").on(t.tenantId),
    usersRoleIdx: index("users_role_idx").on(t.role),
  })
);

// Sales - migrated from MongoDB
export const sales = pgTable(
  "sales",
  {
    id: serial("id").primaryKey(),
    customerName: varchar("customer_name", { length: 255 }),
    customerPhone: varchar("customer_phone", { length: 32 }).notNull(),
    amount: integer("amount").notNull(), // Amount in base currency units
    courseName: varchar("course_name", { length: 255 }),
    courseId: integer("course_id"), // Reference to courses table
    newAdmission: varchar("new_admission", { length: 10 }).default("Yes"), // Yes | No
    ogaName: varchar("oga_name", { length: 255 }), // Salesperson name
    leadId: integer("lead_id"), // Reference to leads table
    stageNotes: text("stage_notes"),
    tenantId: integer("tenant_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    salesTenantIdx: index("sales_tenant_idx").on(t.tenantId),
    salesCreatedAtIdx: index("sales_created_at_idx").on(t.createdAt),
    salesOgaNameIdx: index("sales_oga_name_idx").on(t.ogaName),
    salesCustomerPhoneIdx: index("sales_customer_phone_idx").on(t.customerPhone),
  })
);

// Team Assignments - migrated from MongoDB
export const teamAssignments = pgTable(
  "team_assignments",
  {
    id: serial("id").primaryKey(),
    salespersonId: integer("salesperson_id").notNull(), // Reference to users.id
    jlId: integer("jl_id").notNull(), // Reference to users.id (Junior Leader)
    status: varchar("status", { length: 20 }).notNull().default("active"), // active | inactive
    assignedBy: integer("assigned_by"), // Reference to users.id
    assignedAt: timestamp("assigned_at", { withTimezone: true }).defaultNow(),
    deactivatedAt: timestamp("deactivated_at", { withTimezone: true }),
    tenantId: integer("tenant_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    teamAssignmentsTenantStatusIdx: index("team_assignments_tenant_status_idx").on(t.tenantId, t.status),
    teamAssignmentsSalespersonIdx: index("team_assignments_salesperson_idx").on(t.salespersonId, t.status),
    teamAssignmentsJlIdx: index("team_assignments_jl_idx").on(t.jlId, t.status),
  })
);

// Daily Reports - migrated from MongoDB
export const dailyReports = pgTable(
  "daily_reports",
  {
    id: serial("id").primaryKey(),
    date: timestamp("date", { withTimezone: true }).notNull(), // Date of the report
    tenantId: integer("tenant_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    dailyReportsTenantDateIdx: uniqueIndex("daily_reports_tenant_date_idx").on(t.tenantId, t.date),
  })
);

// Daily Report Entries - normalized from MongoDB daily_reports.salespersons array
export const dailyReportEntries = pgTable(
  "daily_report_entries",
  {
    id: serial("id").primaryKey(),
    reportId: integer("report_id").notNull(), // Reference to daily_reports.id
    salespersonName: varchar("salesperson_name", { length: 255 }).notNull(),
    prospects: integer("prospects").default(0), // Number of leads assigned
    collection: integer("collection"), // Amount collected (optional)
    sales: integer("sales"), // Number of sales (optional)
    tenantId: integer("tenant_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    dailyReportEntriesReportIdx: index("daily_report_entries_report_idx").on(t.reportId),
    dailyReportEntriesSalespersonIdx: index("daily_report_entries_salesperson_idx").on(t.salespersonName),
  })
);

// JWT Blacklist - migrated from MongoDB
export const jwtBlacklist = pgTable(
  "jwt_blacklist",
  {
    id: serial("id").primaryKey(),
    token: varchar("token", { length: 500 }).notNull().unique(),
    userId: varchar("user_id", { length: 255 }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }).defaultNow(),
  },
  (t) => ({
    jwtBlacklistTokenIdx: uniqueIndex("jwt_blacklist_token_idx").on(t.token),
    jwtBlacklistRevokedAtIdx: index("jwt_blacklist_revoked_at_idx").on(t.revokedAt),
  })
);


