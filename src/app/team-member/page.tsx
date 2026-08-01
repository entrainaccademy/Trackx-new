"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser, useClerk } from "@clerk/nextjs";
import { toast } from "react-hot-toast";
import { 
  User, DollarSign, Target, Award, LogOut, TrendingUp, 
  PhoneCall, CheckCircle, Calendar, Plus, RefreshCw, Layers, Users,
  Search, Edit3, MessageSquare, Clock, Filter, Eye
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Sale {
  id?: number;
  _id?: string;
  customerName: string;
  customerPhone?: string;
  amount: number;
  courseName?: string;
  newAdmission?: string;
  ogaName?: string;
  createdAt?: string;
}

interface AssignedLead {
  id: number;
  name?: string;
  phone: string;
  email?: string;
  stage: string;
  source?: string;
  needFollowup?: boolean;
  followupDate?: string;
  followupNotes?: string;
  createdAt?: string;
}

interface UserProfile {
  id?: number;
  name: string;
  code: string;
  email: string;
  role: string;
  phone?: string;
  department?: string;
  status?: string;
  target?: number;
}

interface TeamMemberData {
  profile: UserProfile;
  stats: {
    totalRevenue: number;
    totalSales: number;
    assignedLeadsCount: number;
    target: number;
    targetProgress: number;
  };
  sales: Sale[];
  assignedLeads: AssignedLead[];
}

const STAGES = [
  "Not contacted",
  "Attempt to contact",
  "Did not Connect",
  "Connected",
  "Qualified",
  "Interested",
  "Follow Up",
  "Closed Won",
  "Closed Lost"
];

export default function TeamMemberPage() {
  const router = useRouter();
  const { user: clerkUser, isLoaded } = useUser();
  const { signOut } = useClerk();

  const [data, setData] = useState<TeamMemberData | null>(null);
  const [loading, setLoading] = useState(true);
  const [leadSearch, setLeadSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");

  // Selected Lead Modal State
  const [selectedLead, setSelectedLead] = useState<AssignedLead | null>(null);
  const [leadEvents, setLeadEvents] = useState<any[]>([]);
  const [updatingLead, setUpdatingLead] = useState(false);
  const [editStage, setEditStage] = useState("");
  const [needFollowup, setNeedFollowup] = useState(false);
  const [followupDate, setFollowupDate] = useState("");
  const [followupNotes, setFollowupNotes] = useState("");
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  // Add Sale Modal state
  const [showAddSale, setShowAddSale] = useState(false);
  const [isAddingSale, setIsAddingSale] = useState(false);
  const [newSale, setNewSale] = useState({
    customerName: "",
    customerPhone: "",
    amount: "",
    courseName: "",
    newAdmission: "Yes"
  });

  useEffect(() => {
    if (!isLoaded) return;
    fetchTeamMemberData();
  }, [isLoaded, clerkUser]);

  const fetchTeamMemberData = async () => {
    try {
      setLoading(true);
      const email =
        clerkUser?.emailAddresses[0]?.emailAddress ||
        (typeof window !== "undefined" ? localStorage.getItem("trackx_user_email") : null);

      const url = email ? `/api/team-member?email=${encodeURIComponent(email)}` : "/api/team-member";
      const response = await fetch(url);

      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setData(result);
          return;
        }
      }
      
      toast.error("Failed to load team member data");
    } catch (err) {
      console.error("Error fetching team member data:", err);
      toast.error("Error connecting to server");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenLeadModal = async (lead: AssignedLead) => {
    setSelectedLead(lead);
    setEditStage(lead.stage || "Not contacted");
    setNeedFollowup(Boolean(lead.needFollowup));
    setFollowupDate(lead.followupDate ? new Date(lead.followupDate).toISOString().split("T")[0] : "");
    setFollowupNotes(lead.followupNotes || "");
    setNewNote("");

    // Fetch lead details and events timeline
    try {
      const res = await fetch(`/api/tl/leads/${encodeURIComponent(lead.phone)}`);
      if (res.ok) {
        const leadRes = await res.json();
        if (leadRes.success && leadRes.lead) {
          setSelectedLead(leadRes.lead);
          setLeadEvents(leadRes.events || []);
        }
      }
    } catch (err) {
      console.error("Failed to load lead details:", err);
    }
  };

  const handleUpdateLeadStage = async (phone: string, newStage: string) => {
    try {
      const res = await fetch(`/api/tl/leads/${encodeURIComponent(phone)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage: newStage }),
      });

      if (res.ok) {
        toast.success(`Stage updated to ${newStage}`);
        fetchTeamMemberData();
        if (selectedLead && selectedLead.phone === phone) {
          setSelectedLead({ ...selectedLead, stage: newStage });
        }
      } else {
        toast.error("Failed to update lead stage");
      }
    } catch (err) {
      toast.error("Error updating stage");
    }
  };

  const handleSaveLeadDetails = async () => {
    if (!selectedLead) return;
    setUpdatingLead(true);
    try {
      const res = await fetch(`/api/tl/leads/${encodeURIComponent(selectedLead.phone)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: editStage,
          needFollowup,
          followupDate: followupDate ? new Date(followupDate) : null,
          followupNotes,
        }),
      });

      if (res.ok) {
        toast.success("Lead details updated!");
        fetchTeamMemberData();
      } else {
        toast.error("Failed to update lead");
      }
    } catch (err) {
      toast.error("Error saving lead details");
    } finally {
      setUpdatingLead(false);
    }
  };

  const handleAddNote = async () => {
    if (!selectedLead || !newNote.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch("/api/tl/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leadPhone: selectedLead.phone,
          type: "NOTE_ADDED",
          data: { note: newNote.trim() },
        }),
      });

      if (res.ok) {
        toast.success("Note added!");
        setNewNote("");
        // Reload events
        const eventRes = await fetch(`/api/tl/leads/${encodeURIComponent(selectedLead.phone)}`);
        if (eventRes.ok) {
          const leadRes = await eventRes.json();
          if (leadRes.success) setLeadEvents(leadRes.events || []);
        }
      } else {
        toast.error("Failed to add note");
      }
    } catch (err) {
      toast.error("Error posting note");
    } finally {
      setAddingNote(false);
    }
  };

  const handleAddSaleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSale.customerName || !newSale.amount) {
      toast.error("Customer name and amount are required");
      return;
    }

    setIsAddingSale(true);
    try {
      const res = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: newSale.customerName,
          customerPhone: newSale.customerPhone || "N/A",
          amount: parseFloat(newSale.amount),
          courseName: newSale.courseName || "General",
          newAdmission: newSale.newAdmission,
          ogaName: data?.profile.name || clerkUser?.fullName || "Team Member"
        }),
      });

      if (res.ok) {
        toast.success("Sale recorded successfully!");
        setShowAddSale(false);
        setNewSale({ customerName: "", customerPhone: "", amount: "", courseName: "", newAdmission: "Yes" });
        fetchTeamMemberData();
      } else {
        const errorData = await res.json();
        toast.error(errorData.error || "Failed to record sale");
      }
    } catch (err) {
      toast.error("Error submitting sale");
    } finally {
      setIsAddingSale(false);
    }
  };

  const handleLogout = async () => {
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("trackx_user_email");
        localStorage.removeItem("trackx_user_role");
        localStorage.removeItem("trackx_user_name");
        document.cookie = "trackx_user_email=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        document.cookie = "trackx_user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      }
      if (signOut) {
        await signOut();
      }
      router.push("/login");
    } catch (e) {
      router.push("/login");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center">
        <div className="text-center p-8">
          <div className="inline-block h-10 w-10 rounded-full border-4 border-emerald-600 border-t-transparent animate-spin mb-4"></div>
          <p className="text-slate-700 font-medium">Loading Team Member Portal...</p>
        </div>
      </div>
    );
  }

  const profile = data?.profile || {
    name: clerkUser?.fullName || "Team Member",
    email: clerkUser?.emailAddresses[0]?.emailAddress || "member@company.com",
    role: "sales",
    target: 50000,
    status: "Active"
  };

  const stats = data?.stats || {
    totalRevenue: 0,
    totalSales: 0,
    assignedLeadsCount: 0,
    target: 50000,
    targetProgress: 0
  };

  const salesList = data?.sales || [];
  const rawLeadsList = data?.assignedLeads || [];

  // Filter assigned leads by search term and stage filter
  const filteredLeads = rawLeadsList.filter((lead) => {
    const matchesSearch =
      (lead.name || "").toLowerCase().includes(leadSearch.toLowerCase()) ||
      lead.phone.includes(leadSearch) ||
      (lead.email || "").toLowerCase().includes(leadSearch.toLowerCase());
    const matchesStage = stageFilter === "all" || lead.stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="bg-white/90 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-600 text-white flex items-center justify-center font-bold text-lg shadow-md">
              TX
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">Team Member Portal</h1>
              <p className="text-xs text-slate-500">TrackX CRM Dedicated Workspace</p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden sm:flex items-center space-x-3 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200">
              <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-semibold text-xs">
                {profile.name.split(" ").map(n => n[0]).join("").toUpperCase()}
              </div>
              <div className="text-left">
                <p className="text-xs font-bold text-slate-800 leading-none">{profile.name}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{profile.email}</p>
              </div>
              <Badge className="bg-emerald-100 text-emerald-800 border-0 text-[10px] px-2 capitalize">
                {profile.role || "Team Member"}
              </Badge>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleLogout}
              className="gap-2 border-slate-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-xs"
            >
              <LogOut className="w-3.5 h-3.5" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-6 py-6 space-y-6">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-700 rounded-2xl p-6 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <span className="bg-white/20 text-white text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider">
              Sales Workspace
            </span>
            <h2 className="text-2xl font-bold mt-2">Welcome back, {profile.name}! 👋</h2>
            <p className="text-emerald-100 text-sm mt-1">
              Manage your assigned leads, log call activities, and record conversions.
            </p>
          </div>
          <Button
            onClick={() => setShowAddSale(true)}
            className="bg-white text-emerald-800 hover:bg-emerald-50 font-semibold shadow-md gap-2"
          >
            <Plus className="w-4 h-4" />
            Record New Sale
          </Button>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Total Sales Revenue</span>
                <div className="p-2 rounded-lg bg-emerald-100 text-emerald-700">
                  <DollarSign className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900">₹{stats.totalRevenue.toLocaleString()}</p>
              <p className="text-xs text-slate-500 mt-1 flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                <span>Total booked conversions</span>
              </p>
            </CardContent>
          </Card>

          <Card className="border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Total Conversions</span>
                <div className="p-2 rounded-lg bg-blue-100 text-blue-700">
                  <Award className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900">{stats.totalSales}</p>
              <p className="text-xs text-slate-500 mt-1">Confirmed transactions</p>
            </CardContent>
          </Card>

          <Card className="border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Assigned Leads</span>
                <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700">
                  <Users className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-900">{stats.assignedLeadsCount}</p>
              <p className="text-xs text-slate-500 mt-1">Leads assigned to you</p>
            </CardContent>
          </Card>

          <Card className="border border-slate-200/80 shadow-sm hover:shadow-md transition-all">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Target Achieved</span>
                <div className="p-2 rounded-lg bg-amber-100 text-amber-700">
                  <CheckCircle className="w-5 h-5" />
                </div>
              </div>
              <p className="text-2xl font-bold text-emerald-600">{stats.targetProgress}%</p>
              <div className="w-full bg-slate-100 rounded-full h-1.5 mt-2">
                <div className="bg-emerald-600 h-1.5 rounded-full transition-all duration-500" style={{ width: `${stats.targetProgress}%` }}></div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* My Assigned Leads Section */}
        <Card className="border border-slate-200/80 shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b border-slate-200/80 py-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Users className="w-4 h-4 text-emerald-600" />
                  My Assigned Leads ({filteredLeads.length})
                </CardTitle>
                <p className="text-xs text-slate-500 mt-0.5">Leads assigned specifically to {profile.name}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <Input
                    placeholder="Search assigned leads..."
                    value={leadSearch}
                    onChange={(e) => setLeadSearch(e.target.value)}
                    className="pl-9 text-xs w-48 bg-white border-slate-200 h-9"
                  />
                </div>

                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value)}
                  className="text-xs border border-slate-200 rounded-md px-3 py-2 bg-white text-slate-700 focus:ring-1 focus:ring-emerald-500 h-9"
                >
                  <option value="all">All Stages</option>
                  {STAGES.map((st) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>

                <Button variant="ghost" size="sm" onClick={fetchTeamMemberData} className="gap-1 text-xs text-slate-600 h-9">
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {filteredLeads.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No leads found</p>
                <p className="text-xs text-slate-500 mt-1">
                  {rawLeadsList.length === 0
                    ? "You currently have no leads assigned by your Team Leader."
                    : "No leads match your current search/filter."}
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TR className="bg-slate-50 border-b border-slate-200">
                      <TH className="text-xs text-slate-700">Lead Name</TH>
                      <TH className="text-xs text-slate-700">Phone</TH>
                      <TH className="text-xs text-slate-700">Email</TH>
                      <TH className="text-xs text-slate-700">Stage Update</TH>
                      <TH className="text-xs text-slate-700">Source</TH>
                      <TH className="text-xs text-slate-700 text-right">Actions</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {filteredLeads.map((lead) => (
                      <TR key={lead.id} className="border-b border-slate-100 hover:bg-slate-50/60">
                        <TD className="font-semibold text-slate-900">{lead.name || "Unnamed Lead"}</TD>
                        <TD className="text-slate-700 text-xs font-mono">{lead.phone}</TD>
                        <TD className="text-slate-500 text-xs">{lead.email || "—"}</TD>
                        <TD>
                          <select
                            value={lead.stage}
                            onChange={(e) => handleUpdateLeadStage(lead.phone, e.target.value)}
                            className="text-xs border border-slate-200 rounded px-2 py-1 bg-white text-slate-800 font-medium focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                          >
                            {STAGES.map((st) => (
                              <option key={st} value={st}>{st}</option>
                            ))}
                          </select>
                        </TD>
                        <TD className="text-xs text-slate-500">{lead.source || "Direct"}</TD>
                        <TD className="text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenLeadModal(lead)}
                            className="text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50 gap-1.5 h-8"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            View & Notes
                          </Button>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Conversions & Sales */}
        <Card className="border border-slate-200/80 shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b border-slate-200/80 flex flex-row items-center justify-between py-4">
            <div>
              <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                My Conversions & Sales Log
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">Records of sales logged by you</p>
            </div>
            <Button variant="ghost" size="sm" onClick={fetchTeamMemberData} className="gap-1.5 text-xs text-slate-600">
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh Data
            </Button>
          </CardHeader>

          <CardContent className="p-0">
            {salesList.length === 0 ? (
              <div className="text-center py-12">
                <DollarSign className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No sales recorded yet</p>
                <p className="text-xs text-slate-500 mt-1">Click "Record New Sale" to add your first transaction</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TR className="bg-slate-50 border-b border-slate-200">
                      <TH className="text-xs text-slate-700">Customer Name</TH>
                      <TH className="text-xs text-slate-700">Phone</TH>
                      <TH className="text-xs text-slate-700">Course / Product</TH>
                      <TH className="text-xs text-slate-700">New Admission</TH>
                      <TH className="text-xs text-slate-700">Amount (₹)</TH>
                      <TH className="text-xs text-slate-700 text-right">Date</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {salesList.map((sale, idx) => (
                      <TR key={sale.id || sale._id || idx} className="border-b border-slate-100 hover:bg-slate-50/60">
                        <TD className="font-semibold text-slate-900">{sale.customerName}</TD>
                        <TD className="text-slate-600 text-xs font-mono">{sale.customerPhone || "N/A"}</TD>
                        <TD className="text-slate-700 text-xs">{sale.courseName || "General"}</TD>
                        <TD>
                          <Badge variant="outline" className={sale.newAdmission === "Yes" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-slate-50 text-slate-700"}>
                            {sale.newAdmission || "Yes"}
                          </Badge>
                        </TD>
                        <TD className="font-bold text-emerald-700">₹{(sale.amount || 0).toLocaleString()}</TD>
                        <TD className="text-right text-xs text-slate-500">
                          {sale.createdAt ? new Date(sale.createdAt).toLocaleDateString() : "Today"}
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Lead Details & Notes Modal */}
      <Dialog open={Boolean(selectedLead)} onOpenChange={(open) => !open && setSelectedLead(null)}>
        <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center justify-between">
              <span className="flex items-center gap-2">
                <User className="w-5 h-5 text-emerald-600" />
                Lead Details: {selectedLead?.name || selectedLead?.phone}
              </span>
              <Badge className="bg-emerald-100 text-emerald-800 border-0 text-xs">
                {selectedLead?.stage}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {selectedLead && (
            <div className="space-y-5 pt-2">
              {/* Basic Details */}
              <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200/80 text-xs">
                <div>
                  <span className="text-slate-500 block">Phone</span>
                  <span className="font-semibold text-slate-900 font-mono">{selectedLead.phone}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Email</span>
                  <span className="font-semibold text-slate-900">{selectedLead.email || "—"}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Source</span>
                  <span className="font-semibold text-slate-900">{selectedLead.source || "Direct"}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">Assigned Owner</span>
                  <span className="font-semibold text-emerald-700">{profile.name}</span>
                </div>
              </div>

              {/* Update Stage & Followup */}
              <div className="space-y-3 bg-white p-4 rounded-lg border border-slate-200">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">Update Lead Status & Followup</h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Lead Stage</label>
                    <select
                      value={editStage}
                      onChange={(e) => setEditStage(e.target.value)}
                      className="w-full border border-slate-200 rounded-md p-2 text-xs bg-white focus:ring-1 focus:ring-emerald-500"
                    >
                      {STAGES.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-700 mb-1">Followup Date</label>
                    <Input
                      type="date"
                      value={followupDate}
                      onChange={(e) => setFollowupDate(e.target.value)}
                      className="text-xs h-9 border-slate-200"
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="needFollowupCheck"
                    checked={needFollowup}
                    onChange={(e) => setNeedFollowup(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <label htmlFor="needFollowupCheck" className="text-xs font-medium text-slate-700 cursor-pointer">
                    Requires Follow-up Reminder
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Follow-up Notes</label>
                  <Textarea
                    placeholder="Notes for next follow-up call..."
                    value={followupNotes}
                    onChange={(e) => setFollowupNotes(e.target.value)}
                    rows={2}
                    className="text-xs border-slate-200 resize-none"
                  />
                </div>

                <Button
                  onClick={handleSaveLeadDetails}
                  disabled={updatingLead}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
                >
                  {updatingLead ? "Saving Updates..." : "Save Lead Updates"}
                </Button>
              </div>

              {/* Add Note Section */}
              <div className="space-y-3 bg-white p-4 rounded-lg border border-slate-200">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  Add Activity Note
                </h4>

                <div className="flex gap-2">
                  <Input
                    placeholder="Type note about conversation or call details..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    className="text-xs border-slate-200 flex-1"
                  />
                  <Button
                    onClick={handleAddNote}
                    disabled={addingNote || !newNote.trim()}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                  >
                    {addingNote ? "Adding..." : "Add Note"}
                  </Button>
                </div>
              </div>

              {/* Timeline / Events History */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-slate-500" />
                  Activity History
                </h4>

                {leadEvents.length === 0 ? (
                  <p className="text-xs text-slate-400 italic">No activity recorded yet.</p>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                    {leadEvents.map((evt, i) => (
                      <div key={evt.id || i} className="bg-slate-50 p-2.5 rounded border border-slate-100 text-xs">
                        <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                          <span className="font-semibold text-slate-700 capitalize">{evt.type}</span>
                          <span>{evt.at ? new Date(evt.at).toLocaleString() : ""}</span>
                        </div>
                        {evt.data?.note && <p className="text-slate-800 font-medium">{evt.data.note}</p>}
                        {evt.data?.to && <p className="text-slate-600">Stage changed: {evt.data.from} → {evt.data.to}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Record Sale Modal */}
      <Dialog open={showAddSale} onOpenChange={setShowAddSale}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Plus className="w-5 h-5 text-emerald-600" />
              Record New Sale
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddSaleSubmit} className="space-y-4 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Full Name *</label>
              <Input
                type="text"
                required
                value={newSale.customerName}
                onChange={(e) => setNewSale({ ...newSale, customerName: e.target.value })}
                placeholder="e.g. Rahul Sharma"
                className="border-slate-200"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Phone</label>
                <Input
                  type="tel"
                  value={newSale.customerPhone}
                  onChange={(e) => setNewSale({ ...newSale, customerPhone: e.target.value })}
                  placeholder="+91 9876543210"
                  className="border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Amount (₹) *</label>
                <Input
                  type="number"
                  required
                  value={newSale.amount}
                  onChange={(e) => setNewSale({ ...newSale, amount: e.target.value })}
                  placeholder="e.g. 15000"
                  className="border-slate-200"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Course / Product</label>
                <Input
                  type="text"
                  value={newSale.courseName}
                  onChange={(e) => setNewSale({ ...newSale, courseName: e.target.value })}
                  placeholder="Course name"
                  className="border-slate-200"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">New Admission</label>
                <select
                  className="w-full text-sm border border-slate-200 rounded-md p-2 bg-white focus:ring-1 focus:ring-emerald-500"
                  value={newSale.newAdmission}
                  onChange={(e) => setNewSale({ ...newSale, newAdmission: e.target.value })}
                >
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            </div>

            <div className="flex space-x-3 pt-4">
              <Button type="submit" disabled={isAddingSale} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">
                {isAddingSale ? "Saving Sale..." : "Record Sale"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowAddSale(false)} disabled={isAddingSale} className="flex-1">
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
