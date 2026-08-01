"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Toaster, toast } from 'react-hot-toast';
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
// Clerk handles authentication automatically via cookies - no need for fetch
import TenantLogo from "@/components/TenantLogo";
import { useTenant } from "@/hooks/useTenant";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import {
  Users,
  Target,
  TrendingUp,
  Clock,
  Eye,
  EyeOff,
  Plus,
  Edit,
  Trash2,
  LogOut,
  Settings,
  User,
  Search,
  ChevronDown,
  Crown,
  Medal,
  Award
} from "lucide-react";

interface User {
  _id: string;
  name: string;
  code: string;
  email: string;
  role: string;
  target: number;
  password?: string;
}

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


export default function TeamLeaderPage() {
  const { user: clerkUser, isLoaded } = useUser();
  const [analytics, setAnalytics] = useState<Analytics[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [credentials, setCredentials] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddUser, setShowAddUser] = useState(false);
  const [showCredentials, setShowCredentials] = useState(false);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    target: 0
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<keyof Analytics>("name");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState<string | null>(null);
  const [showKPIModal, setShowKPIModal] = useState(false);
  const [selectedSalesPerson, setSelectedSalesPerson] = useState<any>(null);
  const [kpiData, setKpiData] = useState<any[]>([]);
  const [loadingKPI, setLoadingKPI] = useState(false);
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [showProfileDropdown, setShowProfileDropdown] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [activeProfileTab, setActiveProfileTab] = useState("institute");
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    phone: "",
    address: "",
    about: "",
    subdomain: ""
  });
  const router = useRouter();
  const { subdomain } = useTenant();

  useEffect(() => {
    if (!isLoaded) return;
    
    // Layout already handles authentication - just fetch data
    fetchData();
  }, [isLoaded]);

  // Initialize profile data from Clerk user
  useEffect(() => {
    if (clerkUser) {
      const email = clerkUser.emailAddresses[0]?.emailAddress || "";
      setProfileData({
        name: clerkUser.fullName || "",
        email: email,
        phone: "",
        address: "",
        about: "",
        subdomain: subdomain ? `https://${subdomain}.wydex.co` : ""
      });
    }
  }, [clerkUser, subdomain]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showProfileDropdown) {
        const target = event.target as HTMLElement;
        if (!target.closest('.profile-dropdown')) {
          setShowProfileDropdown(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showProfileDropdown]);

  const fetchData = async () => {
    try {
      // Clerk handles authentication via cookies automatically
      const [analyticsRes, usersRes, credentialsRes] = await Promise.all([
        fetch("/api/analytics"),
        fetch("/api/users"),
        fetch("/api/users/credentials")
      ]);

      if (analyticsRes.ok && usersRes.ok && credentialsRes.ok) {
        const analyticsData = await analyticsRes.json();
        const usersData = await usersRes.json();
        const credentialsData = await credentialsRes.json();

        setAnalytics(analyticsData);
        setUsers(usersData.filter((user: User) => user.role !== 'teamleader'));
        setCredentials(credentialsData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load data");
    } finally {
      setLoading(false);
    }
  };
  // Logout is handled by Sidebar component using Clerk

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Get user ID from database
      const email = clerkUser?.emailAddresses[0]?.emailAddress;
      if (!email) {
        toast.error("Email not found");
        return;
      }

      const userResponse = await fetch(`/api/users/current?identifier=${encodeURIComponent(email)}`);
      const userData = await userResponse.json();
      const userId = userData.success ? userData.user?.id : null;

      const response = await fetch("/api/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: userId,
          name: profileData.name,
          email: profileData.email,
          phone: profileData.phone,
          address: profileData.address,
          about: profileData.about
        }),
      });

      if (response.ok) {
        toast.success("Profile updated successfully");
        setIsEditingProfile(false);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update profile");
      }
    } catch (error) {
      toast.error("Failed to update profile");
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate passwords
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("New passwords don't match");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error("New password must be at least 6 characters long");
      return;
    }

    try {
      // Get user ID from database
      const email = clerkUser?.emailAddresses[0]?.emailAddress;
      if (!email) {
        toast.error("Email not found");
        return;
      }

      const userResponse = await fetch(`/api/users/current?identifier=${encodeURIComponent(email)}`);
      const userData = await userResponse.json();
      const userId = userData.success ? userData.user?.id : null;

      const response = await fetch("/api/users/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: userId,
          currentPassword: passwordData.currentPassword,
          newPassword: passwordData.newPassword
        }),
      });

      if (response.ok) {
        toast.success("Password changed successfully");
        setActiveProfileTab("institute");
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: ""
        });
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to change password");
      }
    } catch (error) {
      toast.error("Failed to change password");
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAddingUser(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(newUser),
      });

      if (res.ok) {
        toast.success("User created successfully");
        setShowAddUser(false);
        setNewUser({ name: "", email: "", password: "", target: 0 });
        fetchData();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to create user");
      }
    } catch (error) {
      toast.error("Failed to create user");
    } finally {
      setIsAddingUser(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    setIsUpdatingUser(true);
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(editingUser),
      });

      if (res.ok) {
        toast.success("User updated successfully");
        setEditingUser(null);
        fetchData();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to update user");
      }
    } catch (error) {
      toast.error("Failed to update user");
    } finally {
      setIsUpdatingUser(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user?")) return;

    setIsDeletingUser(userId);
    try {
      const res = await fetch(`/api/users?id=${userId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.success("User deleted successfully");
        fetchData();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to delete user");
      }
    } catch (error) {
      toast.error("Failed to delete user");
    } finally {
      setIsDeletingUser(null);
    }
  };

  const handleSort = (column: keyof Analytics) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("asc");
    }
  };

  const handleSalesPersonClick = async (salesPerson: any) => {
    setSelectedSalesPerson(salesPerson);
    setShowKPIModal(true);
    setLoadingKPI(true);

    try {
      // Find the user ID from the users list
      const userMatch = users.find(u => u.name.toLowerCase() === salesPerson.name.toLowerCase());
      const userId = userMatch?._id || '';

      // Fetch KPI data from backend API
      const params = new URLSearchParams();
      if (userId) {
        params.append('salesPersonIds', userId);
      }

      const response = await fetch(
        `/api/tl/kpis?${params.toString()}`
      );

      if (response.ok) {
        const data = await response.json();

        console.log('📊 KPI Data Received:', {
          kpiDataCount: data.kpiData?.length,
          salesPersonName: salesPerson.name,
          kpiData: data.kpiData,
          teamSummary: data.teamSummary
        });

        // Find the specific salesperson's data
        const userKPIData = data.kpiData.find((kpi: any) =>
          kpi.name.toLowerCase() === salesPerson.name.toLowerCase()
        );

        console.log('🔍 Found User KPI:', {
          found: !!userKPIData,
          userName: userKPIData?.name,
          dailyKPIsCount: userKPIData?.dailyKPIs?.length
        });

        if (userKPIData && userKPIData.dailyKPIs) {
          // Transform the data to match the existing format
          const comprehensiveData = userKPIData.dailyKPIs.map((day: any) => ({
            _id: `kpi_${day.date}`,
            date: day.date,
            dailyAmount: day.dailyAmount,
            salesCount: day.salesCount,
            leadsAssigned: day.leadsAssigned,
            salesConverted: day.salesConverted,
            conversionRate: day.conversionRate
          }));

          console.log('✅ Setting KPI Data:', comprehensiveData.length, 'records');
          setKpiData(comprehensiveData);
        } else {
          console.log('❌ No KPI data found for this salesperson');
          setKpiData([]);
        }
      } else {
        throw new Error('Failed to fetch KPI data');
      }
    } catch (error) {
      console.error('Error fetching KPI data:', error);
      toast.error('Failed to load KPI data');
      setKpiData([]);
    } finally {
      setLoadingKPI(false);
    }
  };

  const filterDataByDateRange = () => {
    if (!dateRange.startDate || !dateRange.endDate) {
      return kpiData;
    }

    const startDate = new Date(dateRange.startDate);
    const endDate = new Date(dateRange.endDate);

    return kpiData.filter((report) => {
      const reportDate = new Date(report.date);
      return reportDate >= startDate && reportDate <= endDate;
    });
  };

  const filteredKpiData = filterDataByDateRange();

  // Calculate total sales for the filtered date range
  const calculateFilteredSales = () => {
    if (filteredKpiData.length === 0) {
      return selectedSalesPerson?.todaySales || 0;
    }

    // Count days with actual sales activity (dailyAmount > 0)
    return filteredKpiData.filter(report => (report.dailyAmount || 0) > 0).length;
  };

  const filteredSales = calculateFilteredSales();

  const togglePasswordVisibility = (userId: string) => {
    const newVisiblePasswords = new Set(visiblePasswords);
    if (newVisiblePasswords.has(userId)) {
      newVisiblePasswords.delete(userId);
    } else {
      newVisiblePasswords.add(userId);
    }
    setVisiblePasswords(newVisiblePasswords);
  };

  const toggleAllPasswords = () => {
    if (visiblePasswords.size === credentials.length) {
      setVisiblePasswords(new Set());
    } else {
      setVisiblePasswords(new Set(credentials.map(user => user._id)));
    }
  };


  const filteredAndSortedAnalytics = analytics
    .filter(user =>
      (user.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (user.code?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (user.email?.toLowerCase() || "").includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortOrder === 'asc'
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }

      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });

  // Sort analytics by achieved target for top performers
  const topPerformers = [...analytics].sort((a, b) => b.achievedTarget - a.achievedTarget);

  const totalTarget = analytics.reduce((sum, user) => sum + user.target, 0);
  const totalAchieved = analytics.reduce((sum, user) => sum + user.achievedTarget, 0);
  const totalPending = analytics.reduce((sum, user) => sum + user.pendingTarget, 0);
  const totalTodayCollection = analytics.reduce((sum, user) => sum + user.todayCollection, 0);
  const totalSales = analytics.reduce((sum, user) => sum + user.totalSales, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Header Skeleton */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div>
                <div className="h-8 bg-gray-200 rounded-lg w-64 mb-2 animate-pulse"></div>
                <div className="h-4 bg-gray-200 rounded w-48 animate-pulse"></div>
              </div>
              <div className="flex items-center space-x-4">
                <div className="h-12 bg-gray-200 rounded-lg w-40 animate-pulse"></div>
                <div className="h-12 bg-gray-200 rounded-lg w-20 animate-pulse"></div>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Summary Stats Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-gray-200 rounded-lg animate-pulse"></div>
                  </div>
                  <div className="ml-4 flex-1">
                    <div className="h-4 bg-gray-200 rounded w-20 mb-2 animate-pulse"></div>
                    <div className="h-6 bg-gray-200 rounded w-16 animate-pulse"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Search Bar Skeleton */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex-1 max-w-md">
                <div className="h-10 bg-gray-200 rounded-md animate-pulse"></div>
              </div>
              <div className="h-4 bg-gray-200 rounded w-48 animate-pulse"></div>
            </div>
          </div>

          {/* Table Skeleton */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {[...Array(8)].map((_, i) => (
                      <th key={i} className="px-6 py-3 text-left">
                        <div className="h-4 bg-gray-200 rounded w-20 animate-pulse"></div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {[...Array(8)].map((_, rowIndex) => (
                    <tr key={rowIndex}>
                      {[...Array(8)].map((_, colIndex) => (
                        <td key={colIndex} className="px-6 py-4 whitespace-nowrap">
                          <div className="h-4 bg-gray-200 rounded w-24 animate-pulse"></div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isLoaded || !clerkUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center">
        <Card className="w-80 border border-slate-200/60 shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="inline-block h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto mb-4"></div>
            <p className="text-slate-700 font-medium">Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
      <Toaster position="top-right" />

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Sales Management</h1>
              <p className="text-sm text-slate-600 mt-1">Revenue analytics and team performance tracking</p>
            </div>
          </div>
        </div>
        {/* Top Performers Stage */}
        <div className="bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 rounded-2xl shadow-2xl mb-8 overflow-hidden relative">
          {/* Background Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 left-10 w-32 h-32 bg-yellow-400 rounded-full"></div>
            <div className="absolute top-32 right-20 w-24 h-24 bg-purple-400 rounded-full"></div>
            <div className="absolute bottom-20 left-1/4 w-40 h-40 bg-blue-400 rounded-full"></div>
          </div>

          <div className="relative z-10 p-8">
            <div className="text-center mb-8">
              <h2 className="text-4xl font-bold text-white mb-2">🏆 Top Performers</h2>
              <p className="text-purple-200 text-lg">This Month's Champions</p>
            </div>

            <div className="flex justify-center items-end space-x-4 md:space-x-8 lg:space-x-12">
              {/* 2nd Place */}
              {topPerformers.length > 1 && (
                <div className="flex flex-col items-center transform translate-y-4">
                  <div className="relative">
                    <div className="w-20 h-20 md:w-24 md:h-24 bg-gradient-to-br from-gray-300 to-gray-500 rounded-full flex items-center justify-center shadow-lg border-4 border-gray-200">
                      <span className="text-2xl md:text-3xl font-bold text-gray-700">🥈</span>
                    </div>
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-gray-400 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-sm">2</span>
                    </div>
                  </div>
                  <div className="mt-4 text-center">
                    <div className="text-white font-semibold text-sm md:text-base">{topPerformers[1].name}</div>
                    <div className="text-purple-200 text-xs md:text-sm">₹{topPerformers[1].achievedTarget.toLocaleString()}</div>
                  </div>
                </div>
              )}

              {/* 1st Place */}
              {topPerformers.length > 0 && (
                <div className="flex flex-col items-center">
                  <div className="relative">
                    <div className="w-24 h-24 md:w-32 md:h-32 bg-gradient-to-br from-yellow-300 to-yellow-500 rounded-full flex items-center justify-center shadow-2xl border-4 border-yellow-200 animate-pulse">
                      <Crown className="w-8 h-8 md:w-10 md:h-10 text-yellow-800" />
                    </div>
                    <Badge className="absolute -top-2 -right-2 w-10 h-10 bg-yellow-400 text-yellow-800 font-bold text-lg p-0 flex items-center justify-center">
                      1
                    </Badge>
                  </div>
                  <div className="mt-4 text-center">
                    <div className="text-white font-bold text-lg md:text-xl">{topPerformers[0].name}</div>
                    <div className="text-yellow-200 text-sm md:text-base font-semibold">₹{topPerformers[0].achievedTarget.toLocaleString()}</div>
                  </div>
                </div>
              )}

              {/* 3rd Place */}
              {topPerformers.length > 2 && (
                <div className="flex flex-col items-center transform translate-y-8">
                  <div className="relative">
                    <div className="w-16 h-16 md:w-20 md:h-20 bg-gradient-to-br from-orange-300 to-orange-500 rounded-full flex items-center justify-center shadow-lg border-4 border-orange-200">
                      <span className="text-xl md:text-2xl font-bold text-orange-700">🥉</span>
                    </div>
                    <div className="absolute -top-2 -right-2 w-6 h-6 bg-orange-400 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold text-xs">3</span>
                    </div>
                  </div>
                  <div className="mt-4 text-center">
                    <div className="text-white font-semibold text-sm md:text-base">{topPerformers[2].name}</div>
                    <div className="text-orange-200 text-xs md:text-sm">₹{topPerformers[2].achievedTarget.toLocaleString()}</div>
                  </div>
                </div>
              )}
            </div>

            {/* Stage Platform */}
            <div className="mt-8 flex justify-center">
              <div className="w-80 h-4 bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 rounded-full shadow-lg"></div>
            </div>
          </div>
        </div>


        {/* Analytics Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
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
                  <p className="text-2xl font-bold text-slate-900">{analytics.length}</p>
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
                  <p className="text-xl font-bold text-slate-900">
                    ₹{(totalTarget - totalPending).toLocaleString()} 
                  </p>
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
                    <div className="w-5 h-5 text-red-600 flex items-center justify-center text-lg font-bold">₹</div>
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

        {/* Search and Filters */}
        <Card className="mb-6 border border-slate-200/60 shadow-sm">
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
              <div className="flex-1 max-w-md">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type="text"
                    placeholder="Search by name, code, or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 border-slate-200"
                  />
                </div>
              </div>
              <div className="text-sm text-slate-600 font-medium">
                {filteredAndSortedAnalytics.length} of {analytics.length} members
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Performance Analytics Table */}
        <Card className="overflow-hidden border border-slate-200/60 shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b border-slate-200/60">
            <CardTitle className="text-lg text-slate-900">Team Performance Analytics</CardTitle>
            <p className="text-sm text-slate-600 mt-1">Comprehensive overview of your sales team's performance metrics</p>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <THead>
                  <TR>
                    <TH
                      className="cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("name")}
                    >
                      <div className="flex items-center gap-2">
                        Sales Person
                        {sortBy === "name" && (
                          <ChevronDown className={`w-4 h-4 ${sortOrder === "asc" ? "rotate-180" : ""}`} />
                        )}
                      </div>
                    </TH>
                    <TH
                      className="cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("target")}
                    >
                      <div className="flex items-center gap-2">
                        Target
                        {sortBy === "target" && (
                          <ChevronDown className={`w-4 h-4 ${sortOrder === "asc" ? "rotate-180" : ""}`} />
                        )}
                      </div>
                    </TH>
                    <TH
                      className="cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("achievedTarget")}
                    >
                      <div className="flex items-center gap-2">
                        Achieved
                        {sortBy === "achievedTarget" && (
                          <ChevronDown className={`w-4 h-4 ${sortOrder === "asc" ? "rotate-180" : ""}`} />
                        )}
                      </div>
                    </TH>
                    <TH
                      className="cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("pendingTarget")}
                    >
                      <div className="flex items-center gap-2">
                        Pending
                        {sortBy === "pendingTarget" && (
                          <ChevronDown className={`w-4 h-4 ${sortOrder === "asc" ? "rotate-180" : ""}`} />
                        )}
                      </div>
                    </TH>
                    <TH
                      className="cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("todayCollection")}
                    >
                      <div className="flex items-center gap-2">
                        Today's Collection
                        {sortBy === "todayCollection" && (
                          <ChevronDown className={`w-4 h-4 ${sortOrder === "asc" ? "rotate-180" : ""}`} />
                        )}
                      </div>
                    </TH>
                    <TH
                      className="cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("lastMonthCollection")}
                    >
                      <div className="flex items-center gap-2">
                        Last Month
                        {sortBy === "lastMonthCollection" && (
                          <ChevronDown className={`w-4 h-4 ${sortOrder === "asc" ? "rotate-180" : ""}`} />
                        )}
                      </div>
                    </TH>
                    <TH
                      className="cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("daysPending")}
                    >
                      <div className="flex items-center gap-2">
                        Days Remaining
                        {sortBy === "daysPending" && (
                          <ChevronDown className={`w-4 h-4 ${sortOrder === "asc" ? "rotate-180" : ""}`} />
                        )}
                      </div>
                    </TH>
                    <TH
                      className="cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort("totalSales")}
                    >
                      <div className="flex items-center gap-2">
                        Total Sales
                        {sortBy === "totalSales" && (
                          <ChevronDown className={`w-4 h-4 ${sortOrder === "asc" ? "rotate-180" : ""}`} />
                        )}
                      </div>
                    </TH>
                  </TR>
                </THead>
                <TBody>
                  {filteredAndSortedAnalytics.map((user, index) => {
                    const achievementPercentage = user.target > 0 ? (user.achievedTarget / user.target) * 100 : 0;
                    const daysRemaining = user.daysPending;
                    const isUrgent = daysRemaining <= 7 && daysRemaining > 0;

                    return (
                      <TR key={user._id} className={`${index % 2 === 0 ? 'bg-white' : 'bg-gray-25'}`}>
                        <TD className="whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10">
                              <div className="h-10 w-10 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                                <span className="text-sm font-medium text-white">
                                  {(user.name || '').split(' ').map(n => n[0]).join('').toUpperCase()}
                                </span>
                              </div>
                            </div>
                            <div className="ml-4">
                              <div
                                className="text-sm font-medium text-gray-900 cursor-pointer hover:text-blue-600 transition-colors"
                                onClick={() => handleSalesPersonClick(user)}
                              >
                                {user.name}
                              </div>
                              <div className="text-sm text-gray-500">{user.code}</div>
                              <div className="text-xs text-gray-400">{user.email}</div>
                            </div>
                          </div>
                        </TD>
                        <TD className="whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900">₹{user.target.toLocaleString()}</div>
                        </TD>
                        <TD className="whitespace-nowrap">
                          <div className="text-sm font-semibold text-green-600">₹{user.achievedTarget.toLocaleString()}</div>
                          <div className="text-xs text-gray-500">{achievementPercentage.toFixed(1)}% achieved</div>
                          <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                            <div
                              className="bg-green-600 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${Math.min(achievementPercentage, 100)}%` }}
                            ></div>
                          </div>
                        </TD>
                        <TD className="whitespace-nowrap">
                          <div className="text-sm font-semibold text-orange-600">₹{user.pendingTarget.toLocaleString()}</div>
                        </TD>
                        <TD className="whitespace-nowrap">
                          <div className="text-sm font-semibold text-blue-600">₹{user.todayCollection.toLocaleString()}</div>
                          <div className="text-xs text-gray-500">{user.todaySales} sales today</div>
                        </TD>
                        <TD className="whitespace-nowrap">
                          <div className="text-sm font-semibold text-gray-900">₹{user.lastMonthCollection.toLocaleString()}</div>
                        </TD>
                        <TD className="whitespace-nowrap">
                          <div className={`text-sm font-semibold ${isUrgent ? 'text-orange-600' : 'text-gray-900'}`}>
                            {daysRemaining} days
                          </div>
                          {isUrgent && (
                            <Badge variant="outline" className="text-xs text-orange-500 mt-1">Urgent</Badge>
                          )}
                          {daysRemaining === 0 && (
                            <Badge variant="outline" className="text-xs mt-1 text-red-600 border-red-600">Month ends today</Badge>
                          )}
                        </TD>
                        <TD className="whitespace-nowrap">
                          <div className="text-sm font-semibold text-slate-900">{user.totalSales}</div>
                          <div className="text-xs text-slate-500">{user.thisMonthSales} this month</div>
                        </TD>
                      </TR>
                    );
                  })}
                </TBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {filteredAndSortedAnalytics.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Users className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No team members found</h3>
              <p className="mt-1 text-sm text-gray-500">Get started by adding a new sales person.</p>
            </CardContent>
          </Card>
        )}
      </div>


      {/* Credentials Modal */}
      <Dialog open={showCredentials} onOpenChange={setShowCredentials}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>Team Credentials</DialogTitle>
            <div className="flex items-center space-x-4">
              <Button
                variant="outline"
                size="sm"
                onClick={toggleAllPasswords}
                className="gap-2"
              >
                {visiblePasswords.size === credentials.length ? (
                  <>
                    <EyeOff className="w-4 h-4" />
                    Hide All
                  </>
                ) : (
                  <>
                    <Eye className="w-4 h-4" />
                    Show All
                  </>
                )}
              </Button>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            <Card className="mb-4">
              <CardContent className="p-4">
                <p className="text-sm text-gray-600">
                  <strong>Note:</strong> These are the login credentials for all team members.
                  Passwords are hidden by default for security. Click the eye icon to reveal passwords.
                </p>
              </CardContent>
            </Card>

            <div className="grid gap-4">
              {credentials.map((user) => (
                <Card key={user._id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-4">
                          <div className="flex-shrink-0 h-12 w-12">
                            <div className="h-12 w-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                              <span className="text-lg font-medium text-white">
                                {(user.name || '').split(' ').map(n => n[0]).join('').toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-lg font-semibold text-gray-900">{user.name}</h3>
                            <p className="text-sm text-gray-500">{user.code}</p>
                            <p className="text-sm text-gray-500">{user.email}</p>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">Login ID</div>
                          <div className="text-sm text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded">
                            {user.email}
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-sm font-medium text-gray-900">Password</div>
                          <div className="flex items-center space-x-2">
                            <div className="text-sm text-gray-600 font-mono bg-gray-100 px-2 py-1 rounded min-w-[120px]">
                              ••••••••
                            </div>
                            <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">
                              Password Set
                            </Badge>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => togglePasswordVisibility(user._id)}
                              className="p-1 h-8 w-8"
                              title={visiblePasswords.has(user._id) ? 'Hide password' : 'Show password'}
                            >
                              {visiblePasswords.has(user._id) ? (
                                <EyeOff className="w-4 h-4 text-gray-500" />
                              ) : (
                                <Eye className="w-4 h-4 text-gray-500" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {credentials.length === 0 && (
              <Card>
                <CardContent className="text-center py-8">
                  <Users className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No team members found</h3>
                  <p className="mt-1 text-sm text-gray-500">Add team members to view their credentials.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Add User Modal */}
      <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add New Sales Person</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddUser} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <Input
                type="text"
                required
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                placeholder="Enter full name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <Input
                type="email"
                required
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="Enter email address"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <Input
                type="password"
                required
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="Enter password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Target (₹)</label>
              <Input
                type="number"
                required
                value={newUser.target}
                onChange={(e) =>
                  setNewUser({ ...newUser, target: parseInt(e.target.value) || 0 })
                }
                placeholder="Enter target amount"
              />
            </div>

            <div className="flex space-x-3 pt-4">
              <Button
                type="submit"
                disabled={isAddingUser}
                className="flex-1"
              >
                {isAddingUser ? (
                  <div className="flex items-center space-x-2">
                    <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                    <span>Adding...</span>
                  </div>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Add User
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowAddUser(false)}
                disabled={isAddingUser}
                className="flex-1"
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Modal */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
          </DialogHeader>
          {editingUser && (
            <form onSubmit={handleUpdateUser} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <Input
                  type="text"
                  required
                  value={editingUser.name}
                  onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  placeholder="Enter full name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Code</label>
                <Input
                  type="text"
                  required
                  value={editingUser.code}
                  onChange={(e) => setEditingUser({ ...editingUser, code: e.target.value })}
                  placeholder="Enter user code"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <Input
                  type="email"
                  required
                  value={editingUser.email}
                  onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  placeholder="Enter email address"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Target (₹)</label>
                <Input
                  type="number"
                  required
                  value={editingUser.target}
                  onChange={(e) => setEditingUser({ ...editingUser, target: parseInt(e.target.value) || 0 })}
                  placeholder="Enter target amount"
                />
              </div>
              <div className="flex space-x-3 pt-4">
                <Button
                  type="submit"
                  disabled={isUpdatingUser}
                  className="flex-1"
                >
                  {isUpdatingUser ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      <span>Updating...</span>
                    </div>
                  ) : (
                    <>
                      <Edit className="w-4 h-4 mr-2" />
                      Update User
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingUser(null)}
                  disabled={isUpdatingUser}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* KPI Modal */}
      <Dialog open={showKPIModal} onOpenChange={setShowKPIModal}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>KPI Dashboard - {selectedSalesPerson?.name}</DialogTitle>
          </DialogHeader>

          {loadingKPI ? (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center space-x-2">
                <div className="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
                <span className="text-lg text-gray-600">Loading KPI data...</span>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Date Range Filter */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row gap-4 items-center">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Date Range Filter</label>
                      <div className="flex gap-2">
                        <Input
                          type="date"
                          value={dateRange.startDate}
                          onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                          className="flex-1 text-sm"
                        />
                        <span className="flex items-center text-gray-500">to</span>
                        <Input
                          type="date"
                          value={dateRange.endDate}
                          onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                          className="flex-1 text-sm"
                        />
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => setDateRange({ startDate: '', endDate: '' })}
                      className="text-sm"
                    >
                      Clear Filter
                    </Button>
                  </div>
                  {dateRange.startDate && dateRange.endDate && (
                    <div className="mt-2 text-sm text-gray-600">
                      Showing data from {new Date(dateRange.startDate).toLocaleDateString()} to {new Date(dateRange.endDate).toLocaleDateString()}
                      <span className="ml-2 text-blue-600 font-medium">
                        ({filteredKpiData.length} records)
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <Card className="bg-gradient-to-r from-blue-500 to-blue-600 border-0">
                  <CardContent className="p-4 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-blue-100 text-sm">Total Leads</p>
                        <p className="text-2xl font-bold">
                          {filteredKpiData.reduce((sum, report) =>
                            sum + (parseInt(report.leadsAssigned) || 0), 0
                          )}
                        </p>
                      </div>
                      <Users className="w-8 h-8 text-blue-200" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-green-500 to-green-600 border-0">
                  <CardContent className="p-4 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-green-100 text-sm">Sales Converted</p>
                        <p className="text-2xl font-bold">
                          {filteredKpiData.reduce((sum, report) =>
                            sum + (parseInt(report.salesConverted) || 0), 0
                          )}
                        </p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-green-200" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-purple-500 to-purple-600 border-0">
                  <CardContent className="p-4 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-purple-100 text-sm">Amount Collected</p>
                        <p className="text-2xl font-bold">
                          ₹{filteredKpiData.reduce((sum, report) => sum + (report.dailyAmount || 0), 0).toLocaleString()}
                        </p>
                      </div>
                      <div className="w-8 h-8 text-purple-200 flex items-center justify-center text-2xl font-bold">₹</div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-orange-500 to-orange-600 border-0">
                  <CardContent className="p-4 text-white">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-orange-100 text-sm">Conversion %</p>
                        <p className="text-2xl font-bold">
                          {(() => {
                            const totalLeads = filteredKpiData.reduce((sum, report) =>
                              sum + (parseInt(report.leadsAssigned) || 0), 0
                            );
                            const totalSales = filteredKpiData.reduce((sum, report) =>
                              sum + (parseInt(report.salesConverted) || 0), 0
                            );
                            return totalLeads > 0 ? ((totalSales / totalLeads) * 100).toFixed(1) : 0;
                          })()}%
                        </p>
                      </div>
                      <Target className="w-8 h-8 text-orange-200" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed KPI Table */}
              <Card className="overflow-hidden">
                <CardHeader>
                  <CardTitle>Daily Performance Breakdown</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <Table>
                      <THead>
                        <TR>
                          <TH>Date</TH>
                          <TH>Leads Assigned</TH>
                          <TH>Sales Converted</TH>
                          <TH>Amount Collected</TH>
                          <TH>Conversion %</TH>
                          <TH>Ad Spend</TH>
                          <TH>Ad Spend %</TH>
                        </TR>
                      </THead>
                      <TBody>
                        {filteredKpiData.length > 0 ? (
                          filteredKpiData.map((report, index) => {
                            const leadsAssigned = parseInt(report.leadsAssigned) || 0;
                            const salesConverted = parseInt(report.salesConverted) || 0;
                            const amountCollected = parseFloat(report.dailyAmount) || 0;
                            const conversionRate = parseFloat(report.conversionRate) || 0;
                            const adSpend = leadsAssigned * 50;
                            const adSpendPercentage = amountCollected > 0 ? ((adSpend / amountCollected) * 100).toFixed(1) : 0;

                            return (
                              <TR key={report._id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                <TD className="font-medium">
                                  {new Date(report.date).toLocaleDateString('en-IN', {
                                    year: 'numeric',
                                    month: 'short',
                                    day: 'numeric'
                                  })}
                                </TD>
                                <TD>{leadsAssigned}</TD>
                                <TD className="text-green-600 font-semibold">{salesConverted}</TD>
                                <TD className="text-blue-600 font-semibold">₹{amountCollected.toLocaleString()}</TD>
                                <TD className="text-purple-600 font-semibold">{conversionRate}%</TD>
                                <TD className="text-orange-600 font-semibold">₹{adSpend.toLocaleString()}</TD>
                                <TD className="text-red-600 font-semibold">{adSpendPercentage}%</TD>
                              </TR>
                            );
                          })
                        ) : (
                          <TR>
                            <TD colSpan={7} className="text-center py-8">
                              <div className="flex flex-col items-center">
                                <Users className="w-12 h-12 text-gray-400 mb-4" />
                                <p className="text-lg font-medium">
                                  {dateRange.startDate && dateRange.endDate ? 'No data found for selected date range' : 'No KPI data available'}
                                </p>
                                <p className="text-sm">
                                  {dateRange.startDate && dateRange.endDate
                                    ? 'Try adjusting your date range or clear the filter.'
                                    : 'No performance data found for this sales person.'
                                  }
                                </p>
                              </div>
                            </TD>
                          </TR>
                        )}
                      </TBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>


      {/* Edit Profile Modal */}
      <Dialog open={showEditProfile} onOpenChange={setShowEditProfile}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex p-0">
          <DialogHeader className="sr-only">
            <DialogTitle>Edit Profile</DialogTitle>
          </DialogHeader>
          <div className="flex w-full">
            {/* Sidebar */}
            <div className="w-64 bg-gray-50 p-6 border-r border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900 mb-6">Manage</h2>
              <nav className="space-y-2">
                <Button
                  variant={activeProfileTab === "institute" ? "default" : "ghost"}
                  onClick={() => setActiveProfileTab("institute")}
                  className="w-full justify-start"
                >
                  Institute Profile
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  Courses
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  Batches
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  Billing
                </Button>
              </nav>

              <h3 className="text-lg font-semibold text-gray-900 mt-8 mb-4">My Profile</h3>
              <nav className="space-y-2">
                <Button variant="ghost" className="w-full justify-start">
                  User Details
                </Button>
                <Button
                  variant={activeProfileTab === "changePassword" ? "default" : "ghost"}
                  onClick={() => setActiveProfileTab("changePassword")}
                  className="w-full justify-start"
                >
                  Change Password
                </Button>
                <Button variant="ghost" className="w-full justify-start">
                  Notifications
                </Button>
              </nav>
            </div>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto">
              {/* Header with background pattern */}
              <div className="h-32 bg-gradient-to-r from-gray-100 to-gray-200 relative">
                <div className="absolute inset-0 bg-white bg-opacity-50"></div>
                <div className="absolute top-4 right-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowEditProfile(false);
                      setIsEditingProfile(false);
                    }}
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Button>
                </div>
              </div>

              <div className="p-8">
                {/* Institute Profile Content */}
                {activeProfileTab === "institute" && (
                  <form onSubmit={handleProfileSave} className="space-y-8">
                    {/* Profile Title and Edit Button */}
                    <div className="flex items-center justify-between">
                      <h1 className="text-2xl font-bold text-gray-900">{profileData.name || 'Profile'}</h1>
                      <button
                        type="button"
                        onClick={() => setIsEditingProfile(!isEditingProfile)}
                        className="text-gray-400 hover:text-gray-600 p-2"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                    </div>

                    {/* Contact Information */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="flex items-center space-x-3">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                        {isEditingProfile ? (
                          <Input
                            type="email"
                            value={profileData.email}
                            onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                            className="flex-1"
                            placeholder="Email"
                          />
                        ) : (
                          <span className="flex-1 text-gray-600">{profileData.email || 'No email provided'}</span>
                        )}
                      </div>

                      <div className="flex items-center space-x-3">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        {isEditingProfile ? (
                          <Input
                            type="tel"
                            value={profileData.phone}
                            onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                            className="flex-1"
                            placeholder="Phone"
                          />
                        ) : (
                          <span className="flex-1 text-gray-600">{profileData.phone || 'No phone provided'}</span>
                        )}
                      </div>
                    </div>

                    {/* Subdomain and Address */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Subdomain:</label>
                        <div className="w-full text-blue-600 bg-transparent">
                          {profileData.subdomain || 'No subdomain configured'}
                        </div>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Address:</label>
                        {isEditingProfile ? (
                          <Textarea
                            value={profileData.address}
                            onChange={(e) => setProfileData({ ...profileData, address: e.target.value })}
                            rows={2}
                            className="w-full resize-none"
                            placeholder="Enter address"
                          />
                        ) : (
                          <div className="w-full text-gray-600">
                            {profileData.address || 'No address provided'}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* About and Social Media */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold text-gray-900">About</h3>
                          <button
                            type="button"
                            onClick={() => setIsEditingProfile(!isEditingProfile)}
                            className="text-gray-400 hover:text-gray-600 p-1"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                          </button>
                        </div>
                        {isEditingProfile ? (
                          <Textarea
                            value={profileData.about}
                            onChange={(e) => setProfileData({ ...profileData, about: e.target.value })}
                            rows={4}
                            className="w-full"
                            placeholder="Tell us about yourself..."
                          />
                        ) : (
                          <div className="w-full text-gray-600 border border-gray-200 rounded-md p-3 min-h-[100px]">
                            {profileData.about || 'No information provided'}
                          </div>
                        )}
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Social Media</h3>
                        <div className="space-y-4">
                          <div className="flex items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded-lg">
                            <div className="text-center">
                              <button
                                type="button"
                                className="text-teal-600 hover:text-teal-700 font-medium"
                              >
                                Add Social Media
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Save Button - Only show when editing */}
                    {isEditingProfile && (
                      <div className="flex justify-end pt-6 border-t border-gray-200">
                        <div className="flex space-x-3">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setIsEditingProfile(false);
                              // Reset form data to original values from Clerk
                              if (clerkUser) {
                                const email = clerkUser.emailAddresses[0]?.emailAddress || "";
                                setProfileData({
                                  name: clerkUser.fullName || "",
                                  email: email,
                                  phone: profileData.phone || "",
                                  address: profileData.address || "",
                                  about: profileData.about || "",
                                  subdomain: subdomain ? `https://${subdomain}.wydex.co` : ""
                                });
                              }
                            }}
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            className="bg-teal-600 hover:bg-teal-700"
                          >
                            Save Changes
                          </Button>
                        </div>
                      </div>
                    )}
                  </form>
                )}

                {/* Change Password Content */}
                {activeProfileTab === "changePassword" && (
                  <div className="space-y-8">
                    <div className="flex items-center justify-between">
                      <h1 className="text-2xl font-bold text-gray-900">Change Password</h1>
                    </div>

                    <form onSubmit={handlePasswordChange} className="max-w-md space-y-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Current Password</label>
                        <Input
                          type="password"
                          required
                          value={passwordData.currentPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                          placeholder="Enter current password"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                        <Input
                          type="password"
                          required
                          minLength={6}
                          value={passwordData.newPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                          placeholder="Enter new password"
                        />
                        <p className="text-sm text-gray-500 mt-1">Password must be at least 6 characters long</p>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Confirm New Password</label>
                        <Input
                          type="password"
                          required
                          minLength={6}
                          value={passwordData.confirmPassword}
                          onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                          placeholder="Confirm new password"
                        />
                      </div>

                      <div className="flex space-x-3 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setActiveProfileTab("institute");
                            setPasswordData({
                              currentPassword: "",
                              newPassword: "",
                              confirmPassword: ""
                            });
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          className="bg-teal-600 hover:bg-teal-700"
                        >
                          Change Password
                        </Button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}