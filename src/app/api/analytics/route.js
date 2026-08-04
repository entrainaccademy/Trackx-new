import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { users, sales, dailyReports, dailyReportEntries } from '@/db/schema';
import { eq, and, ne, gte, lte, sql } from 'drizzle-orm';
import { getTenantContextFromRequest } from '@/lib/mongoTenant';
import { authenticateRequest, createUnauthorizedResponse } from '@/lib/clerkAuth';

// Helper functions for date filtering
function filterSalesByDate(sales, date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  return sales.filter(sale => {
    if (!sale.createdAt) return false;
    const saleDate = new Date(sale.createdAt);
    return saleDate.getFullYear() === y && saleDate.getMonth() === m && saleDate.getDate() === d;
  });
}

function filterSalesByMonth(sales, date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  return sales.filter(sale => {
    if (!sale.createdAt) return false;
    const saleDate = new Date(sale.createdAt);
    return saleDate.getFullYear() === y && saleDate.getMonth() === m;
  });
}

function getLastMonthDate() {
  const date = new Date();
  date.setMonth(date.getMonth() - 1);
  return date;
}

// Get analytics for team leader
export async function GET(request) {
  try {
    // Authenticate the request
    const authResult = await authenticateRequest(request);
    if (!authResult.success) {
      return createUnauthorizedResponse(authResult.error, authResult.statusCode);
    }

    const { tenantId } = await getTenantContextFromRequest(request);
    
    if (!tenantId) {
      console.warn('[AnalyticsAPI] No tenantId resolved for authenticated user');
      return NextResponse.json([]);
    }

    // Get all users (excluding team leaders)
    const allUsers = await db
      .select()
      .from(users)
      .where(and(
        eq(users.tenantId, tenantId),
        ne(users.role, 'teamleader')
      ));

    console.log(`[AnalyticsAPI] Resolved tenantId: ${tenantId}, users found: ${allUsers.length}`);

    // Get all sales for the tenant
    const allSalesData = await db
      .select()
      .from(sales)
      .where(eq(sales.tenantId, tenantId));

    // Get all daily reports for the current month
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    
    const allReportsData = await db
      .select()
      .from(dailyReports)
      .where(and(
        eq(dailyReports.tenantId, tenantId),
        gte(dailyReports.date, firstDayOfMonth),
        lte(dailyReports.date, lastDayOfMonth)
      ));

    // Get daily report entries
    const reportIds = allReportsData.map(r => r.id);
    let allReportEntries = [];
    if (reportIds.length > 0) {
      allReportEntries = await db
        .select()
        .from(dailyReportEntries)
        .where(sql`${dailyReportEntries.reportId} = ANY(${reportIds})`);
    }

    const today = new Date();
    const lastMonth = getLastMonthDate();

    const analytics = allUsers.map(user => {
      const userSales = allSalesData.filter(sale => {
        const exactMatch = sale.ogaName === user.name;
        const caseInsensitiveMatch = sale.ogaName?.toLowerCase() === user.name?.toLowerCase();
        const partialMatch = sale.ogaName?.toLowerCase().includes(user.name?.toLowerCase() || '') || 
                           user.name?.toLowerCase().includes(sale.ogaName?.toLowerCase() || '');
        return exactMatch || caseInsensitiveMatch || partialMatch;
      });
      
      const todaySales = filterSalesByDate(userSales, today);
      const thisMonthSales = filterSalesByMonth(userSales, today);
      const lastMonthSales = filterSalesByMonth(userSales, lastMonth);

      const todayCollection = todaySales.reduce((sum, sale) => sum + (sale.amount || 0), 0);
      const thisMonthCollection = thisMonthSales.reduce((sum, sale) => sum + (sale.amount || 0), 0);
      const lastMonthCollection = lastMonthSales.reduce((sum, sale) => sum + (sale.amount || 0), 0);

      // Count only new admissions for sales count
      const newAdmissionSales = userSales.filter(sale => 
        (String(sale.newAdmission || '').trim().toLowerCase() === 'yes') || sale.newAdmission === 'Yes'
      );
      const todayNewSales = todaySales.filter(sale => 
        (String(sale.newAdmission || '').trim().toLowerCase() === 'yes') || sale.newAdmission === 'Yes'
      );
      const thisMonthNewSales = thisMonthSales.filter(sale => 
        (String(sale.newAdmission || '').trim().toLowerCase() === 'yes') || sale.newAdmission === 'Yes'
      );

      // Calculate days remaining in the current month
      const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const daysRemaining = lastDayOfMonth.getDate() - today.getDate();

      // Calculate target achievement
      const target = user.target || 0;
      const achievedTarget = thisMonthCollection;
      const pendingTarget = Math.max(0, target - achievedTarget);

      // Calculate total leads assigned this month from daily reports
      let totalLeads = 0;
      for (const report of allReportsData) {
        const entries = allReportEntries.filter(e => e.reportId === report.id);
        const entry = entries.find(e => e.salespersonName?.toLowerCase() === user.name?.toLowerCase());
        if (entry && entry.prospects) {
          totalLeads += entry.prospects || 0;
        }
      }

      return {
        id: user.id,
        name: user.name,
        code: user.code,
        email: user.email,
        target: target,
        achievedTarget: achievedTarget,
        pendingTarget: pendingTarget,
        todayCollection: todayCollection,
        lastMonthCollection: lastMonthCollection,
        daysPending: daysRemaining,
        totalSales: newAdmissionSales.length,
        todaySales: todayNewSales.length,
        thisMonthSales: thisMonthNewSales.length,
        totalLeads: totalLeads,
      };
    });

    const totalTarget = analytics.reduce((sum, u) => sum + (u.target || 0), 0);
    console.log(`[AnalyticsAPI] Total users processed: ${analytics.length}, totalTarget: ₹${totalTarget}`);

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('[AnalyticsAPI] Error fetching analytics:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
