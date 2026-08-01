"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { Toaster, toast } from "react-hot-toast";
// Clerk handles authentication automatically via cookies - no need for fetch
import Link from "next/link";
import TenantLogo from "@/components/TenantLogo";
import { useTenant } from "@/hooks/useTenant";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Sale {
  _id?: string;
  customerName: string;
  amount: number;
  newAdmission: string; // "Yes" | "No"
  ogaName: string;
  createdAt?: string;
}

interface User {
  name: string;
  code: string;
  email: string;
  role?: string;
  target?: number;
}

// ---------- utils ----------
// getUserFromStorage removed - using Clerk now

function filterSalesByDate(sales: Sale[], date: Date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  const d = date.getDate();
  return sales.filter((sale) => {
    if (!sale.createdAt) return false;
    const sd = new Date(sale.createdAt);
    return sd.getFullYear() === y && sd.getMonth() === m && sd.getDate() === d;
  });
}

function filterSalesByWeek(sales: Sale[], date: Date) {
  const start = new Date(date);
  // Week starts on Sunday (0). Adjust if you prefer Monday start.
  start.setDate(date.getDate() - start.getDay());
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return sales.filter((sale) => {
    if (!sale.createdAt) return false;
    const sd = new Date(sale.createdAt);
    return sd >= start && sd < end;
  });
}

function filterSalesByMonth(sales: Sale[], date: Date) {
  const y = date.getFullYear();
  const m = date.getMonth();
  return sales.filter((sale) => {
    if (!sale.createdAt) return false;
    const sd = new Date(sale.createdAt);
    return sd.getFullYear() === y && sd.getMonth() === m;
  });
}

const INR = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

// Lightweight skeleton block
const Skel = ({ className = "" }: { className?: string }) => (
  <div className={`animate-pulse rounded-xl bg-slate-200/70 ${className}`} />
);

// Generic stat card
function StatCard({
  title,
  value,
  gradient,
  icon,
  hint,
}: {
  title: string;
  value: string | number;
  gradient: string; // Tailwind gradient classes
  icon: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card
      className={`text-white shadow-xl ring-1 ring-black/5 ${gradient} transition-transform duration-200 hover:scale-[1.02] border-0`}
      aria-label={title}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="bg-white/20 rounded-xl p-3">{icon}</div>
          {hint ? <span className="text-xs text-white/80">{hint}</span> : null}
        </div>
        <h3 className="text-white/90 text-sm font-medium mb-1">{title}</h3>
        <p className="text-2xl md:text-3xl font-bold leading-tight">{value}</p>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { subdomain } = useTenant();
  const { user: clerkUser, isLoaded } = useUser();
  const [dbUser, setDbUser] = useState<User | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editData, setEditData] = useState<{
    customerName: string;
    amount: number;
    newAdmission: string;
  } | null>(null);

  // Get user from database
  // Get user from database
  useEffect(() => {
    if (!isLoaded) return;

    const loadUser = async () => {
      try {
        const email = clerkUser?.emailAddresses[0]?.emailAddress || (typeof window !== "undefined" ? localStorage.getItem("trackx_user_email") : null);
        if (!email) {
          setIsLoading(false);
          return;
        }

        const response = await fetch(`/api/users/current?identifier=${encodeURIComponent(email)}`);
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.user) {
            setDbUser({
              name: data.user.name || clerkUser?.fullName || "",
              code: data.user.code || email,
              email: data.user.email || email,
              role: data.user.role,
              target: data.user.target,
            });
          }
        }
      } catch (error) {
        console.error("Error loading user:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUser();
  }, [isLoaded, clerkUser]);

  // Load sales data
  useEffect(() => {
    if (!isLoaded) return;

    const loadSales = async () => {
      try {
        setIsLoading(true);
        const response = await fetch('/api/sales');
        if (response.ok) {
          const data = await response.json();
          // Handle the new API response format: {sales: [], pagination: {}}
          const salesData = data.sales || data;
          setSales(Array.isArray(salesData) ? salesData : []);
        } else {
          toast.error("Failed to load sales data");
        }
      } catch (error) {
        console.error("Error loading sales:", error);
        toast.error("Failed to load sales data");
      } finally {
        setIsLoading(false);
      }
    };

    loadSales();
  }, [isLoaded, clerkUser]);

  // Check if user should be redirected (teamleader goes to team-leader dashboard)
  useEffect(() => {
    if (!isLoaded || !dbUser) return;
    
    if (dbUser.role === "teamleader") {
      router.push("/team-leader");
      return;
    }
  }, [isLoaded, dbUser, router]);

  const today = new Date();

  const daily = useMemo(() => filterSalesByDate(sales, today), [sales, today]);
  const weekly = useMemo(() => filterSalesByWeek(sales, today), [sales, today]);
  const monthly = useMemo(() => filterSalesByMonth(sales, today), [sales, today]);

  const target = dbUser?.target ?? 300000;

  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const daysPending = Math.max(0, lastDayOfMonth.getDate() - today.getDate());

  const achievedTarget = monthly.reduce((sum, s) => sum + (s.amount || 0), 0);
  const pendingTarget = Math.max(0, target - achievedTarget);
  const todayCollection = daily.reduce((sum, s) => sum + (s.amount || 0), 0);

  const prevMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastMonthSales = useMemo(
    () => filterSalesByMonth(sales, prevMonthDate),
    [sales, prevMonthDate]
  );
  const lastMonthAchieved = lastMonthSales.reduce((sum, s) => sum + (s.amount || 0), 0);

  const showLastMonth = useMemo(() => {
    if (!sales.length) return false;
    const firstSaleYear = sales[0]?.createdAt
      ? new Date(sales[0].createdAt).getFullYear()
      : 0;
    return today.getMonth() > 0 || today.getFullYear() > firstSaleYear;
  }, [sales, today]);

  // ------------- handlers -------------
  const refreshSales = () => {
    if (!clerkUser) return;
    fetch("/api/sales")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        // Handle the new API response format: {sales: [], pagination: {}}
        const salesData = data.sales || data; // Fallback to direct array for backward compatibility
        if (Array.isArray(salesData)) {
          setSales(salesData);
        } else {
          console.error('Unexpected sales data format:', data);
          setSales([]);
        }
      })
      .catch((error) => {
        console.error('Failed to refresh sales:', error);
        toast.error("Failed to refresh sales");
      });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this sale?")) return;
    await toast.promise(
      fetch(`/api/sales?id=${id}`, { method: "DELETE" })
        .then(() => refreshSales()),
      {
        loading: "Deleting...",
        success: "Sale deleted",
        error: "Delete failed",
      }
    );
  };

  const handleEdit = (sale: Sale) => {
    setEditingId(sale._id || null);
    setEditData({
      customerName: sale.customerName,
      amount: sale.amount,
      newAdmission: sale.newAdmission,
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingId || !editData) return;
    await toast.promise(
      fetch(`/api/sales`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _id: editingId, ...editData }),
      }).then(() => {
        setEditingId(null);
        setEditData(null);
        refreshSales();
      }),
      { loading: "Updating...", success: "Sale updated", error: "Update failed" }
    );
  };

  const handleLogout = async () => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
      
      if (token) {
        console.log('🔐 Logging out with token');
        try {
          // Wait for the logout API to complete
          const response = await fetch('/api/users/logout', {
            method: 'POST',
            headers: { 
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ token })
          });
          
          const result = await response.json();
          if (response.ok && result.success) {
            console.log('✅ Token successfully blacklisted');
          } else {
            console.warn('⚠️ Logout API warning:', result.error || 'Unknown error');
          }
        } catch (error) {
          console.error('❌ Error calling logout API:', error);
        }
      } else {
        console.log('ℹ️ No token found, skipping API call');
      }
    } catch (error) {
      console.error('❌ Error in logout handler:', error);
    }
    
    // Clean up local storage and navigate after API call
    if (typeof window !== "undefined") {
      localStorage.removeItem("user");
      localStorage.removeItem("token");
    }
    router.push("/login");
  };

  if (!isLoaded || !clerkUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-6">
        <Toaster position="top-center" />
        <div className="max-w-3xl mx-auto">
          <Skel className="h-28 mb-6" />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Skel className="h-28" />
            <Skel className="h-28" />
            <Skel className="h-28" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-3 sm:p-4 md:p-6">
      <Toaster position="top-center" />
      <div className="mx-auto max-w-7xl">
        {/* ---------- header ---------- */}
        <Card className="bg-white/80 backdrop-blur-sm shadow-xl mb-4 sm:mb-8 border border-white/50">
          <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              {/* Tenant Logo */}
              {subdomain && (
                <div className="flex-shrink-0">
                  <TenantLogo 
                    subdomain={subdomain} 
                    className="w-12 h-12 rounded-lg shadow-sm"
                    fallbackText={subdomain.toUpperCase().slice(0, 2)}
                  />
                </div>
              )}
              
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                  Welcome back, {dbUser?.name || clerkUser?.fullName || "User"}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-slate-700">
                  <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs sm:text-sm">
                    {/* badge icon */}
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M10 6H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-5" />
                      <path d="M10 6V5a2 2 0 1 1 4 0v1" />
                    </svg>
                    {dbUser?.email || dbUser?.code || clerkUser?.emailAddresses[0]?.emailAddress || ""}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-xs sm:text-sm">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M3 8l7.89 4.26a2 2 0 0 0 2.22 0L21 8" />
                      <path d="M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2z" />
                    </svg>
                    {dbUser?.email || clerkUser?.emailAddresses[0]?.emailAddress || ""}
                  </span>
                </div>
              </div>
            </div>
            <Button
              onClick={handleLogout}
              className="gap-2 bg-primary hover:bg-primary/90"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <path d="M16 17l5-5-5-5" />
                <path d="M21 12H9" />
              </svg>
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </div>
          </CardContent>
        </Card>

        {/* ---------- actions bar ---------- */}
        <nav aria-label="Quick actions" className="mb-4 sm:mb-6">
          <div className="flex gap-3 overflow-x-auto pb-1">
            <Link href="/dashboard/tasks" className="shrink-0">
              <Button className="gap-2 bg-primary hover:bg-primary/90">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 12h6M9 16h6M9 8h6" />
                  <path d="M5 6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2H5z" />
                </svg>
                Tasks
              </Button>
            </Link>



           
          </div>
        </nav>

        {/* ---------- stats ---------- */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
            <Skel className="h-28" />
            <Skel className="h-28" />
            <Skel className="h-28" />
            <Skel className="h-28" />
            <Skel className="h-28" />
            <Skel className="h-28" />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-6">
            <StatCard
              title="Target"
              value={INR.format(target)}
              gradient="bg-gradient-to-br from-emerald-600 to-emerald-700"
              icon={
                <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 21a9 9 0 1 0-9-9" />
                  <path d="M15 12l-3 3-2-2" />
                </svg>
              }
            />

            <StatCard
              title="Achieved Target"
              value={INR.format(achievedTarget)}
              gradient="bg-gradient-to-br from-blue-600 to-blue-700"
              icon={
                <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 2l2.29 6.86L21 11l-6.71 2.14L12 20l-2.29-6.86L3 11l6.71-2.14L12 2z" />
                </svg>
              }
            />

            <StatCard
              title="Pending Target"
              value={INR.format(pendingTarget)}
              gradient="bg-gradient-to-br from-amber-600 to-amber-700"
              icon={
                <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 8v4l3 3" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
              }
            />

            <StatCard
              title="Sales"
              value={monthly.length}
              gradient="bg-gradient-to-br from-rose-600 to-rose-700"
              icon={
                <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 3h2l.4 2M7 13h10l4-8H5.4m0 0L7 13m0 0l-2.5 5M7 13l2.5 5m0 0L12 21l2.5-5m0 0L17 13" />
                </svg>
              }
            />

            <StatCard
              title="Today's Collection"
              value={INR.format(todayCollection)}
              gradient="bg-gradient-to-br from-yellow-600 to-yellow-700"
              hint={`${daily.length} sale${daily.length !== 1 ? "s" : ""}`}
              icon={
                <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="4" />
                  <path d="M12 2v2m0 16v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2m16 0h2" />
                </svg>
              }
            />

            {showLastMonth && (
              <StatCard
                title="Last Month Collection"
                value={today.getDate() === 1 ? INR.format(lastMonthAchieved) : "₹0"}
                gradient="bg-gradient-to-br from-violet-600 to-violet-700"
                icon={
                  <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M16 2v4M8 2v4M3 10h18" />
                  </svg>
                }
              />
            )}

            <StatCard
              title="Days Pending"
              value={`${daysPending} Days`}
              gradient="bg-gradient-to-br from-slate-600 to-slate-700"
              icon={
                <svg className="h-6 w-6 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M12 8v4l3 3" />
                  <circle cx="12" cy="12" r="9" />
                </svg>
              }
            />
          </div>
        )}

        {/* ---------- data ---------- */}
        <Card className="bg-white/80 backdrop-blur-sm shadow-xl border border-white/50 overflow-hidden">
          <CardContent className="p-0">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between p-4 sm:p-6 border-b border-slate-200">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-800 flex items-center gap-2">
              <svg className="h-6 w-6 text-slate-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 5H7a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-5" />
                <path d="M20.59 7.41a2 2 0 0 1 0 2.83L12 18.83 9 19l.17-3 8.59-8.59a2 2 0 0 1 2.83 0z" />
              </svg>
              All Sales Record
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">{weekly.length} this week • {monthly.length} this month</p>
          </div>

          {/* Table on md+ */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <THead>
                <TR>
                  <TH>Customer</TH>
                  <TH>Amount</TH>
                  <TH>New Admission</TH>
                  <TH>Date</TH>
                  <TH>Actions</TH>
                </TR>
              </THead>
              <TBody>
                {isLoading ? (
                  [...Array(5)].map((_, i) => (
                    <TR key={`sk-${i}`}>
                      <TD><Skel className="h-5 w-40" /></TD>
                      <TD><Skel className="h-5 w-24" /></TD>
                      <TD><Skel className="h-6 w-16 rounded-full" /></TD>
                      <TD><Skel className="h-5 w-24" /></TD>
                      <TD><Skel className="h-8 w-24 rounded-md" /></TD>
                    </TR>
                  ))
                ) : sales.length ? (
                  sales.map((sale, idx) => (
                    <TR
                      key={sale._id || `${sale.customerName}-${idx}`}
                    >
                      <TD>
                        <div className="text-sm font-medium text-slate-900">{sale.customerName}</div>
                      </TD>
                      <TD>
                        <div className="text-sm font-semibold text-green-700">{INR.format(sale.amount)}</div>
                      </TD>
                      <TD>
                        <Badge
                          variant={sale.newAdmission === "Yes" ? "default" : "secondary"}
                          className={sale.newAdmission === "Yes" ? "bg-green-100 text-green-800" : ""}
                        >
                          {sale.newAdmission}
                        </Badge>
                      </TD>
                      <TD className="text-sm text-slate-500">
                        {sale.createdAt ? new Date(sale.createdAt).toLocaleDateString() : "N/A"}
                      </TD>
                      <TD>
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => handleEdit(sale)}
                            variant="outline"
                            size="sm"
                            aria-label="Edit sale"
                          >
                            Edit
                          </Button>
                          <Button
                            onClick={() => sale._id && handleDelete(sale._id)}
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700"
                            aria-label="Delete sale"
                          >
                            Delete
                          </Button>
                        </div>
                      </TD>
                    </TR>
                  ))
                ) : (
                  <TR>
                    <TD colSpan={5} className="px-6 py-10">
                      <div className="flex flex-col items-center justify-center text-center text-slate-500">
                        <svg className="h-10 w-10 mb-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M3 3v18h18" />
                          <path d="M19 17l-8-8-5 5" />
                        </svg>
                        <p className="font-medium">No sales yet</p>
                        <p className="text-sm">Click "Add New Sale" above to get started.</p>
                      </div>
                    </TD>
                  </TR>
                )}
              </TBody>
            </Table>
          </div>

          {/* Cards on mobile */}
          <div className="md:hidden divide-y divide-slate-200">
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <div key={`mob-skel-${i}`} className="p-4">
                  <Skel className="h-5 w-40 mb-2" />
                  <Skel className="h-5 w-24 mb-2" />
                  <Skel className="h-6 w-20 rounded-full mb-2" />
                  <Skel className="h-5 w-24" />
                </div>
              ))
            ) : sales.length ? (
              sales.map((sale, idx) => (
                <article key={sale._id || `${sale.customerName}-${idx}`} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900">{sale.customerName}</h3>
                      <p className="mt-1 text-sm text-green-700 font-semibold">{INR.format(sale.amount)}</p>
                    </div>
                    <Badge
                      variant={sale.newAdmission === "Yes" ? "default" : "secondary"}
                      className={sale.newAdmission === "Yes" ? "bg-green-100 text-green-800" : ""}
                    >
                      {sale.newAdmission}
                    </Badge>
                  </div>
                  <div className="mt-2 text-xs text-slate-500">
                    {sale.createdAt ? new Date(sale.createdAt).toLocaleDateString() : "N/A"}
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Button
                      onClick={() => handleEdit(sale)}
                      variant="outline"
                      size="sm"
                      className="flex-1"
                    >
                      Edit
                    </Button>
                    <Button
                      onClick={() => sale._id && handleDelete(sale._id)}
                      variant="outline"
                      size="sm"
                      className="flex-1 text-red-600 hover:text-red-700"
                    >
                      Delete
                    </Button>
                  </div>
                </article>
              ))
            ) : (
              <div className="p-8 text-center text-slate-500">No sales yet.</div>
            )}
          </div>
          </CardContent>
        </Card>

        {/* ---------- edit modal ---------- */}
        <Dialog open={!!editingId} onOpenChange={() => {
          setEditingId(null);
          setEditData(null);
        }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Sale</DialogTitle>
            </DialogHeader>
            {editData && (
              <form onSubmit={handleEditSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name</label>
                  <Input
                    type="text"
                    required
                    value={editData.customerName}
                    onChange={(e) => setEditData({ ...editData, customerName: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
                  <Input
                    type="number"
                    min={0}
                    required
                    value={editData.amount}
                    onChange={(e) => setEditData({ ...editData, amount: parseInt(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">New Admission</label>
                  <select
                    value={editData.newAdmission}
                    onChange={(e) => setEditData({ ...editData, newAdmission: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button
                    type="submit"
                    className="flex-1 bg-primary hover:bg-primary/90"
                  >
                    Update Sale
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingId(null);
                      setEditData(null);
                    }}
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
