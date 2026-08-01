import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db/client";
import { users, sales, dailyReports, dailyReportEntries } from "@/db/schema";
import { eq, and, gte, lte, ne, inArray, sql } from "drizzle-orm";
import { authenticateRequest, createUnauthorizedResponse } from "@/lib/clerkAuth";
import { getTenantContextFromRequest } from "@/lib/mongoTenant";

export async function GET(req: NextRequest) {
  try {
    // Authenticate the request
    const authResult = await authenticateRequest(req);
    
    if (!authResult.success) {
      return createUnauthorizedResponse(authResult.error || 'Authentication failed', authResult.statusCode);
    }
    
    // Get tenant context
    const { tenantId } = await getTenantContextFromRequest(req as any);
    
    if (!tenantId) {
      return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
    }

    // Get database user by email
    if (!authResult.email) {
      return NextResponse.json({ error: "User email not found" }, { status: 400 });
    }

    const dbUserResult = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .where(and(
        eq(users.email, authResult.email),
        eq(users.tenantId, tenantId)
      ))
      .limit(1);
    
    const dbUser = dbUserResult[0];
    
    // Check if user is a team leader
    if (!dbUser || dbUser.role !== "teamleader") {
      return NextResponse.json({ 
        error: `Forbidden - Access denied. Your role is '${dbUser?.role || 'unknown'}' but 'teamleader' is required.` 
      }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const salesPersonIds = searchParams.get("salesPersonIds");

    // Build date filter conditions
    let dateConditions: any[] = [];
    if (startDate) {
      dateConditions.push(gte(sales.createdAt, new Date(startDate)));
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      dateConditions.push(lte(sales.createdAt, end));
    }

    // Fetch all sales data for this tenant
    const salesWhere = dateConditions.length > 0
      ? and(eq(sales.tenantId, tenantId), ...dateConditions)
      : eq(sales.tenantId, tenantId);

    const salesData = await db
      .select()
      .from(sales)
      .where(salesWhere);

    // Fetch all daily reports for this tenant
    let reportsDateConditions: any[] = [];
    if (startDate) {
      reportsDateConditions.push(gte(dailyReports.date, new Date(startDate)));
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      reportsDateConditions.push(lte(dailyReports.date, end));
    }

    const reportsWhere = reportsDateConditions.length > 0
      ? and(eq(dailyReports.tenantId, tenantId), ...reportsDateConditions)
      : eq(dailyReports.tenantId, tenantId);

    const allDailyReports = await db
      .select()
      .from(dailyReports)
      .where(reportsWhere);

    // Get report IDs and fetch entries
    const reportIds = allDailyReports.map((r: any) => r.id);
    let allReportEntries: typeof dailyReportEntries.$inferSelect[] = [];
    if (reportIds.length > 0) {
      allReportEntries = await db
        .select()
        .from(dailyReportEntries)
        .where(sql`${dailyReportEntries.reportId} = ANY(${reportIds})`);
    }

    // Get all users (salespersons) excluding team leaders
    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        code: users.code,
        email: users.email,
        role: users.role,
      })
      .from(users)
      .where(and(
        eq(users.tenantId, tenantId),
        ne(users.role, "teamleader")
      ));

    // Filter by specific salesPersonIds if provided
    let targetUsers = allUsers;
    if (salesPersonIds) {
      const idsArray = salesPersonIds.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
      targetUsers = allUsers.filter((u: any) => idsArray.includes(u.id));
    }

    // Calculate KPIs for each salesperson
    const kpiData = targetUsers.map((user: any) => {
      const userName = (user.name || '').toLowerCase();
      
      // Get sales for this user (match by ogaName)
      const userSales = salesData.filter(
        (sale: any) => sale.ogaName?.toLowerCase() === userName
      );

      // Create a map of daily sales
      const dailySalesMap = new Map<string, number>();
      const dailySalesCountMap = new Map<string, number>();
      
      userSales.forEach((sale: any) => {
        if (sale.createdAt) {
          const saleDate = new Date(sale.createdAt).toISOString().split('T')[0];
          const existingAmount = dailySalesMap.get(saleDate) || 0;
          const existingCount = dailySalesCountMap.get(saleDate) || 0;
          dailySalesMap.set(saleDate, existingAmount + (sale.amount || 0));
          dailySalesCountMap.set(saleDate, existingCount + 1);
        }
      });

      // Get all unique dates from both daily reports and sales data
      const allDates = new Set<string>();
      
      // Add dates from daily reports
      allDailyReports.forEach((report: any) => {
        const entries = allReportEntries.filter(e => e.reportId === report.id);
        const hasEntry = entries.some(e => e.salespersonName?.toLowerCase() === userName);
        if (hasEntry) {
          allDates.add(new Date(report.date).toISOString().split('T')[0]);
        }
      });
      
      // Add dates from sales data
      userSales.forEach((sale: any) => {
        if (sale.createdAt) {
          allDates.add(new Date(sale.createdAt).toISOString().split('T')[0]);
        }
      });

      // Create comprehensive daily data
      const dailyKPIs = Array.from(allDates).map((dateStr) => {
        const date = new Date(dateStr);
        const dailyAmount = dailySalesMap.get(dateStr) || 0;
        const salesCount = dailySalesCountMap.get(dateStr) || 0;
        
        // Find corresponding daily report data
        const reportForDate = allDailyReports.find((report: any) => {
          const reportDate = new Date(report.date).toISOString().split('T')[0];
          return reportDate === dateStr;
        });
        
        const reportEntries = reportForDate 
          ? allReportEntries.filter(e => e.reportId === reportForDate.id)
          : [];
        
        const salesPersonEntry = reportEntries.find((e) => 
          e.salespersonName?.toLowerCase() === userName
        );
        
        const leadsAssigned = salesPersonEntry?.prospects || 0;
        const conversionRate = leadsAssigned > 0 ? ((salesCount / leadsAssigned) * 100).toFixed(1) : '0';
        const adSpend = leadsAssigned * 50;
        const adSpendPercentage = dailyAmount > 0 ? ((adSpend / dailyAmount) * 100).toFixed(1) : '0';

        return {
          date: date.toISOString(),
          dailyAmount,
          salesCount,
          leadsAssigned,
          salesConverted: salesCount,
          conversionRate: parseFloat(conversionRate),
          adSpend,
          adSpendPercentage: parseFloat(adSpendPercentage)
        };
      }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // Calculate totals
      const totalLeads = dailyKPIs.reduce((sum, day) => sum + day.leadsAssigned, 0);
      const totalSales = dailyKPIs.reduce((sum, day) => sum + day.salesConverted, 0);
      const totalAmount = dailyKPIs.reduce((sum, day) => sum + day.dailyAmount, 0);
      const totalAdSpend = dailyKPIs.reduce((sum, day) => sum + day.adSpend, 0);
      const overallConversion = totalLeads > 0 ? ((totalSales / totalLeads) * 100).toFixed(1) : '0';
      const overallAdSpendPercentage = totalAmount > 0 ? ((totalAdSpend / totalAmount) * 100).toFixed(1) : '0';

      return {
        userId: user.id.toString(),
        name: user.name,
        code: user.code,
        email: user.email,
        dailyKPIs,
        summary: {
          totalLeads,
          totalSales,
          totalAmount,
          totalAdSpend,
          overallConversion: parseFloat(overallConversion),
          overallAdSpendPercentage: parseFloat(overallAdSpendPercentage),
          daysActive: dailyKPIs.length
        }
      };
    });

    // Calculate team totals
    const teamSummary: any = {
      totalLeads: kpiData.reduce((sum: number, user: any) => sum + user.summary.totalLeads, 0),
      totalSales: kpiData.reduce((sum: number, user: any) => sum + user.summary.totalSales, 0),
      totalAmount: kpiData.reduce((sum: number, user: any) => sum + user.summary.totalAmount, 0),
      totalAdSpend: kpiData.reduce((sum: number, user: any) => sum + user.summary.totalAdSpend, 0),
      totalSalespeople: kpiData.length,
    };

    teamSummary.overallConversion = teamSummary.totalLeads > 0 
      ? parseFloat(((teamSummary.totalSales / teamSummary.totalLeads) * 100).toFixed(1))
      : 0;

    teamSummary.overallAdSpendPercentage = teamSummary.totalAmount > 0
      ? parseFloat(((teamSummary.totalAdSpend / teamSummary.totalAmount) * 100).toFixed(1))
      : 0;

    return NextResponse.json({
      success: true,
      kpiData,
      teamSummary
    });
  } catch (error) {
    console.error("Error fetching KPI data:", error);
    return NextResponse.json(
      { error: "Failed to fetch KPI data" },
      { status: 500 }
    );
  }
}
