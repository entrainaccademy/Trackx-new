"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
// Clerk handles authentication automatically via cookies - no need for authenticatedFetch
import { Users, Target, TrendingUp, Clock, DollarSign, Crown, Trophy, ArrowRight } from "lucide-react";

type Sale = {
  ogaName: string;
  amount: number;
  newAdmission: string;
  createdAt?: string;
};

interface Analytics {
  _id: string;
  name: string;
  code: string;
  email: string;
  target: number;
  achievedTarget: number;
  pendingTarget: number;
  todayCollection: number;
  lastMonthCollection: number;
  daysPending: number;
  totalSales: number;
  todaySales: number;
  thisMonthSales: number;
}

export default function LeadManagementOverviewPage() {
  const { user, isLoaded } = useUser();
  const [widgets, setWidgets] = useState<{ slaAtRisk: number; leadsToday: number; qualifiedRate: number; totalTeamMembers?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [activities, setActivities] = useState<Array<{ id: number; at: string; title: string; detail: string; color: string }>>([]);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [analytics, setAnalytics] = useState<Analytics[]>([]);
  const [todayLeaderboard, setTodayLeaderboard] = useState<Array<{ name: string; total: number; count: number }>>([]);

  // Get user name from Clerk
  const teamLeaderName = user?.fullName || user?.firstName || "Team Leader";

  useEffect(() => {
    if (!isLoaded) return;

    let isCancelled = false;

    const loadData = async () => {
      // 1. Fetch overview
      try {
        const res = await fetch("/api/tl/overview");
        if (res.ok) {
          const d = await res.json();
          if (!isCancelled) {
            setWidgets(d.widgets || { slaAtRisk: 0, leadsToday: 0, qualifiedRate: 0 });
          }
        } else {
          if (!isCancelled) {
            setWidgets({ slaAtRisk: 0, leadsToday: 0, qualifiedRate: 0 });
          }
        }
      } catch (error) {
        console.error("Failed to fetch overview:", error);
        if (!isCancelled) {
          setWidgets({ slaAtRisk: 0, leadsToday: 0, qualifiedRate: 0 });
        }
      }

      // 2. Fetch sales analytics
      try {
        const res = await fetch("/api/analytics");
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled) {
            if (Array.isArray(data)) {
              setAnalytics(data);
            } else {
              console.error("Analytics data is not an array:", data);
              setAnalytics([]);
            }
          }
        } else {
          if (!isCancelled) {
            setAnalytics([]);
          }
        }
      } catch (error) {
        console.error("Failed to fetch analytics:", error);
        if (!isCancelled) {
          setAnalytics([]);
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }

      // 3. Fetch today's sales for leaderboard
      try {
        const res = await fetch("/api/public/leaderboard");
        if (res.ok) {
          const data = await res.json();
          if (!isCancelled) {
            const sales: Sale[] = Array.isArray(data) ? data : [];
            const today = new Date();
            const targetDay = today.toISOString().split("T")[0];
            const todaySales = sales.filter((sale) => {
              if (!sale.createdAt) return false;
              const saleDay = new Date(sale.createdAt).toISOString().split("T")[0];
              return saleDay === targetDay;
            });

            const leaderboard: Record<string, { name: string; total: number; count: number }> = {};
            for (const sale of todaySales) {
              if (!leaderboard[sale.ogaName]) {
                leaderboard[sale.ogaName] = { name: sale.ogaName, total: 0, count: 0 };
              }
              leaderboard[sale.ogaName].total += Number(sale.amount);
              if (((sale.newAdmission ?? "") + "").trim().toLowerCase() === "yes") {
                leaderboard[sale.ogaName].count += 1;
              }
            }

            const sortedLeaderboard = Object.values(leaderboard)
              .sort((a, b) => b.total - a.total)
              .slice(0, 3);

            setTodayLeaderboard(sortedLeaderboard);
          }
        } else {
          if (!isCancelled) setTodayLeaderboard([]);
        }
      } catch (error) {
        console.error("Failed to fetch leaderboard:", error);
        if (!isCancelled) setTodayLeaderboard([]);
      }

      // 4. Fetch activity
      try {
        const res = await fetch("/api/tl/activity?limit=20");
        if (res.ok) {
          const d = await res.json();
          if (!isCancelled) {
            if (d?.success && Array.isArray(d.items)) {
              setActivities(
                d.items.map((it: any) => ({
                  id: it.id,
                  at: it.at,
                  title: it.title,
                  detail: it.detail,
                  color: it.color || "indigo",
                }))
              );
            } else {
              setActivities([]);
            }
          }
        } else {
          if (!isCancelled) setActivities([]);
        }
      } catch (error) {
        console.error("Failed to fetch activity:", error);
        if (!isCancelled) setActivities([]);
      }
    };

    loadData();

    return () => {
      isCancelled = true;
    };
  }, [isLoaded]);

  // Calculate sales metrics (with safe fallbacks)
  const totalTarget = Array.isArray(analytics) ? analytics.reduce((sum, user) => sum + (user.target || 0), 0) : 0;
  const totalAchieved = Array.isArray(analytics) ? analytics.reduce((sum, user) => sum + (user.achievedTarget || 0), 0) : 0;
  const totalPending = Array.isArray(analytics) ? analytics.reduce((sum, user) => sum + (user.pendingTarget || 0), 0) : 0;
  const totalTodayCollection = Array.isArray(analytics) ? analytics.reduce((sum, user) => sum + (user.todayCollection || 0), 0) : 0;
  const topPerformers = Array.isArray(analytics) ? [...analytics].sort((a, b) => (b.achievedTarget || 0) - (a.achievedTarget || 0)) : [];

  // Dynamic greeting based on local time
  const greeting = (() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 12) return "Good morning";
    if (h >= 12 && h < 18) return "Good afternoon";
    return "Good evening";
  })();

  const timeAgo = (iso: string) => {
    const now = Date.now();
    const t = new Date(iso).getTime();
    const diff = Math.max(0, Math.floor((now - t) / 1000));
    if (diff < 60) return `${diff}s ago`;
    const m = Math.floor(diff / 60);
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    return `${d}d ago`;
  };

  const dotColor = (c: string) => {
    switch (c) {
      case "green":
        return "bg-emerald-600";
      case "blue":
        return "bg-blue-600";
      case "amber":
        return "bg-amber-600";
      case "slate":
        return "bg-slate-600";
      case "purple":
        return "bg-violet-600";
      case "cyan":
        return "bg-cyan-600";
      default:
        return "bg-primary";
    }
  };

  return (
    <div className="p-6 bg-gradient-to-br from-slate-50 via-white to-slate-50 min-h-screen">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {greeting}, {teamLeaderName}! 👋
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              Lead Management & Sales Revenue Dashboard
            </p>
          </div>
          <div className="text-right bg-white px-4 py-2 rounded-lg border border-slate-200 shadow-sm">
            <div className="text-xs text-slate-500">Last updated</div>
            <div className="text-xs font-semibold text-slate-900">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        </div>
      </div>

      {/* Sales Performance Summary */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <Card className="border border-slate-200/60 hover:shadow-md transition-all duration-200">
          <CardContent className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-slate-600">Team Members</p>
                <p className="text-2xl font-bold text-slate-900">{loading ? "..." : (widgets?.totalTeamMembers ?? analytics.length)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/60 hover:shadow-md transition-all duration-200">
          <CardContent className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <Target className="w-5 h-5 text-green-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-slate-600">Total Target</p>
                <p className="text-xl font-bold text-slate-900">₹{totalTarget.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/60 hover:shadow-md transition-all duration-200">
          <CardContent className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <TrendingUp className="w-5 h-5 text-purple-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-slate-600">Achieved</p>
                <p className="text-xl font-bold text-slate-900">₹{totalAchieved.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/60 hover:shadow-md transition-all duration-200">
          <CardContent className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Clock className="w-5 h-5 text-orange-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-slate-600">Pending</p>
                <p className="text-xl font-bold text-slate-900">₹{totalPending.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/60 hover:shadow-md transition-all duration-200">
          <CardContent className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                  <DollarSign className="w-5 h-5 text-red-600" />
                </div>
              </div>
              <div className="ml-3">
                <p className="text-xs font-medium text-slate-600">Today's Collection</p>
                <p className="text-xl font-bold text-slate-900">₹{totalTodayCollection.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Performers */}
      {topPerformers.length > 0 && (
        <Card className="mb-6 border border-slate-200/60 shadow-sm">
          <CardContent className="p-6">
            <div className="flex items-center gap-2.5 mb-6">
              <div className="bg-gradient-to-br from-amber-600 to-amber-700 text-white p-2 rounded-lg shadow-sm">
                <Crown className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Top Performers of the Month</h2>
                <p className="text-xs text-slate-500">This month's champions</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* 1st Place */}
              {topPerformers.length > 0 && (
                <Card className="border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-white shadow-md hover:shadow-lg transition-all duration-200">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <Badge className="bg-yellow-400 text-yellow-900 font-bold">
                        🥇 #1
                      </Badge>
                      <div className="bg-yellow-100 p-2 rounded-lg">
                        <Crown className="w-5 h-5 text-yellow-700" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-slate-900">{topPerformers[0].name}</h3>
                      <div className="text-sm text-slate-600">{topPerformers[0].email}</div>
                      <div className="pt-2 border-t border-yellow-200">
                        <div className="text-xs text-slate-500">Achieved</div>
                        <div className="text-2xl font-bold text-yellow-700">₹{topPerformers[0].achievedTarget.toLocaleString()}</div>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Target: ₹{(topPerformers[0].target || 0).toLocaleString()}</span>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          {topPerformers[0].target > 0 ? ((topPerformers[0].achievedTarget / topPerformers[0].target) * 100).toFixed(1) : 0}%
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 2nd Place */}
              {topPerformers.length > 1 && (
                <Card className="border-2 border-slate-300 bg-gradient-to-br from-slate-50 to-white shadow-md hover:shadow-lg transition-all duration-200">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <Badge className="bg-slate-300 text-slate-700 font-bold">
                        🥈 #2
                      </Badge>
                      <div className="bg-slate-100 p-2 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-slate-600" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-slate-900">{topPerformers[1].name}</h3>
                      <div className="text-sm text-slate-600">{topPerformers[1].email}</div>
                      <div className="pt-2 border-t border-slate-200">
                        <div className="text-xs text-slate-500">Achieved</div>
                        <div className="text-2xl font-bold text-slate-700">₹{topPerformers[1].achievedTarget.toLocaleString()}</div>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Target: ₹{(topPerformers[1].target || 0).toLocaleString()}</span>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          {topPerformers[1].target > 0 ? ((topPerformers[1].achievedTarget / topPerformers[1].target) * 100).toFixed(1) : 0}%
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* 3rd Place */}
              {topPerformers.length > 2 && (
                <Card className="border-2 border-orange-300 bg-gradient-to-br from-orange-50 to-white shadow-md hover:shadow-lg transition-all duration-200">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <Badge className="bg-orange-300 text-orange-800 font-bold">
                        🥉 #3
                      </Badge>
                      <div className="bg-orange-100 p-2 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-orange-600" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg font-bold text-slate-900">{topPerformers[2].name}</h3>
                      <div className="text-sm text-slate-600">{topPerformers[2].email}</div>
                      <div className="pt-2 border-t border-orange-200">
                        <div className="text-xs text-slate-500">Achieved</div>
                        <div className="text-2xl font-bold text-orange-700">₹{topPerformers[2].achievedTarget.toLocaleString()}</div>
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-slate-500">Target: ₹{(topPerformers[2].target || 0).toLocaleString()}</span>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          {topPerformers[2].target > 0 ? ((topPerformers[2].achievedTarget / topPerformers[2].target) * 100).toFixed(1) : 0}%
                        </Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lead Management Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="border border-slate-200/60 hover:shadow-md transition-all duration-200 overflow-hidden">
            <CardContent className="p-0">
            <div className="bg-gradient-to-br from-rose-600 to-rose-400 p-4">
                <div className="flex items-center justify-between text-white">
                  <div>
                  <p className="text-xs font-medium opacity-90">SLA at Risk</p>
                    <div className="text-3xl font-bold mt-1">
                      {loading ? (
                        <div className="animate-pulse bg-white/20 h-10 w-20 rounded"></div>
                      ) : (
                      widgets?.slaAtRisk || 0
                      )}
                    </div>
                  </div>
                  <div className="bg-white/20 p-2.5 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-white">
                <div className="flex items-center justify-between">
                {widgets?.slaAtRisk && widgets.slaAtRisk > 0 ? (
                    <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px]">
                      ⚠️ Critical
                    </Badge>
                ) : (
                    <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                      ✓ Good
                    </Badge>
                  )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/60 hover:shadow-md transition-all duration-200 overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-gradient-to-br from-blue-600 to-blue-400 p-4">
              <div className="flex items-center justify-between text-white">
                <div>
                  <p className="text-xs font-medium opacity-90">Leads Today</p>
                  <div className="text-3xl font-bold mt-1">
                    {loading ? (
                      <div className="animate-pulse bg-white/20 h-10 w-20 rounded"></div>
                    ) : (
                      widgets?.leadsToday || 0
                    )}
                  </div>
                </div>
                <div className="bg-white/20 p-2.5 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="p-3 bg-white">
                    <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-[10px]">
                      • Tracking
                    </Badge>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/60 hover:shadow-md transition-all duration-200 overflow-hidden">
          <CardContent className="p-0">
            <div className="bg-gradient-to-br from-primary to-primary/80 p-4">
              <div className="flex items-center justify-between text-white">
                <div>
                  <p className="text-xs font-medium opacity-90">Qualified Rate</p>
                  <div className="text-3xl font-bold mt-1">
                    {loading ? (
                      <div className="animate-pulse bg-white/20 h-10 w-20 rounded"></div>
                    ) : (
                      `${widgets?.qualifiedRate || 0}%`
                    )}
                  </div>
                </div>
                <div className="bg-white/20 p-2.5 rounded-lg">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 00-2 2z" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="p-3 bg-white">
              {(widgets?.qualifiedRate || 0) >= 70 ? (
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                  ✓ Good
                </Badge>
              ) : (widgets?.qualifiedRate || 0) >= 50 ? (
                <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-[10px]">
                  • Tracking
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px]">
                  ⚠️ Needs Attention
                </Badge>
              )}
              </div>
            </CardContent>
          </Card>
      </div>

      {/* Quick Actions, Recent Activity & Today's Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        <Card className="border border-slate-200/60 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="bg-gradient-to-br from-violet-600 to-violet-700 text-white p-2 rounded-lg shadow-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-sm font-semibold text-slate-900">Quick Actions</h2>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Link href="/team-leader/leads" className="flex items-center gap-2 p-3 border border-slate-200/60 rounded-lg hover:bg-slate-50 hover:border-primary/30 transition-all text-xs font-medium text-slate-700 hover:text-primary">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Add Lead
              </Link>
              <Link href="/team-leader/sales" className="flex items-center gap-2 p-3 border border-slate-200/60 rounded-lg hover:bg-slate-50 hover:border-primary/30 transition-all text-xs font-medium text-slate-700 hover:text-primary">
                <TrendingUp className="w-4 h-4" />
                Sales Analytics
              </Link>
              <Link href="/team-leader/analytics" className="flex items-center gap-2 p-3 border border-slate-200/60 rounded-lg hover:bg-slate-50 hover:border-primary/30 transition-all text-xs font-medium text-slate-700 hover:text-primary">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 00-2 2z" />
                </svg>
                Lead Analytics
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/60 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="bg-gradient-to-br from-amber-600 to-amber-700 text-white p-2 rounded-lg shadow-sm">
                  <Trophy className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-semibold text-slate-900">Today's Top 3</h2>
              </div>
              <Link href="/team-leader/daily-leaderboard">
                <Button variant="ghost" size="sm" className="h-7 text-xs text-primary hover:text-primary/80">
                  View All <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            </div>
            <div className="space-y-2">
              {todayLeaderboard.length === 0 ? (
                <div className="text-xs text-slate-500 text-center py-4">No sales yet today</div>
              ) : (
                todayLeaderboard.map((seller, index) => {
                  const badges = [
                    { icon: "🥇", color: "bg-yellow-100 text-yellow-700 border-yellow-200" },
                    { icon: "🥈", color: "bg-slate-200 text-slate-700 border-slate-300" },
                    { icon: "🥉", color: "bg-orange-200 text-orange-700 border-orange-300" }
                  ];
                  const badge = badges[index];
                  
                  return (
                    <div key={`${seller.name}-${index}`} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <Badge variant="outline" className={`${badge.color} font-bold text-[10px] px-1.5`}>
                          {badge.icon} #{index + 1}
                        </Badge>
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-semibold text-slate-900 truncate">{seller.name}</div>
                          <div className="text-[10px] text-slate-500">{seller.count} sales</div>
                        </div>
                      </div>
                      <div className="text-xs font-bold text-green-600">₹{seller.total.toLocaleString()}</div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border border-slate-200/60 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="bg-gradient-to-br from-blue-600 to-blue-700 text-white p-2 rounded-lg shadow-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h2 className="text-sm font-semibold text-slate-900">Recent Activity</h2>
            </div>
            <div className="space-y-2">
              {activities.length === 0 ? (
                <div className="text-xs text-slate-500 text-center py-4">No recent activity</div>
              ) : (
                <>
                  {(showAllActivities ? activities : activities.slice(0, 3)).map((a, idx) => (
                    <div key={`${a.id}-${idx}`} className="flex items-start gap-2.5 p-2.5 bg-slate-50 rounded-lg hover:bg-slate-100 transition-colors">
                      <div className={`w-2 h-2 rounded-full ${dotColor(a.color)} mt-1.5 flex-shrink-0`}></div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs">
                          <span className="font-semibold text-slate-900">{a.title}</span>{" "}
                          <span className="text-slate-600">{a.detail}</span>
                        </div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{timeAgo(a.at)}</div>
                      </div>
                    </div>
                  ))}
                  {activities.length > 3 && (
                    <Button
                      onClick={() => setShowAllActivities((v) => !v)}
                      variant="ghost"
                      className="w-full text-center text-primary hover:text-white text-xs py-2 mt-1"
                    >
                      {showAllActivities ? "Show less" : "Show more"}
                    </Button>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alerts Section */}
      <Card className="border border-slate-200/60 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="bg-gradient-to-br from-rose-600 to-rose-700 text-white p-2 rounded-lg shadow-sm">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
            </div>
            <h2 className="text-sm font-semibold text-slate-900">Alerts & Notifications</h2>
          </div>
          
          {widgets?.slaAtRisk && widgets.slaAtRisk > 0 ? (
            <div className="bg-rose-50 border border-rose-200/60 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <div className="text-rose-600 mt-0.5">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-rose-900">SLA Alert</h3>
                  <p className="text-xs text-rose-700 mt-1">
                    {widgets.slaAtRisk} lead{widgets.slaAtRisk !== 1 ? 's are' : ' is'} at risk of missing SLA targets. Immediate attention required.
                  </p>
                  <Link href="/team-leader/leads">
                  <Button variant="ghost" className="mt-2 p-0 h-auto text-xs text-rose-700 hover:text-rose-800 font-medium">
                    View Details →
                  </Button>
                  </Link>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-primary mb-3">
                <svg className="w-10 h-10 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-xs text-slate-600 font-medium">All good! No alerts at the moment.</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
