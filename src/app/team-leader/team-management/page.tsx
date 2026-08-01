"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { toast } from "react-hot-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Eye, EyeOff, Settings, Users, Plus, Edit, Trash2, Search, Copy, KeyRound, Lock, ShieldCheck, Check } from "lucide-react";
import { Input } from "@/components/ui/input";

interface User {
  id?: number; // Database ID
  code: string;
  _id?: string;
  name: string;
  email: string;
  phone?: string;
  department?: string;
  status?: string;
  role: string;
  assignedTo?: string;
  password?: string;
  passwordSet?: boolean;
  target?: number;
}

interface JuniorLeader extends User {
  teamMembers: string[];
}

interface SalesPerson extends User {
  assignedTo?: string;
}

interface TeamData {
  allUsers: User[];
  juniorLeaders: JuniorLeader[];
  salesPersons: SalesPerson[];
}

export default function TeamManagementPage() {
  const { user: clerkUser, isLoaded } = useUser();
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);
  const [promotingUser, setPromotingUser] = useState<string | null>(null);
  const [assigningUser, setAssigningUser] = useState<string | null>(null);
  const [demotingUser, setDemotingUser] = useState<string | null>(null);
  const [selectedJl, setSelectedJl] = useState<string>("");
  const [jlSelections, setJlSelections] = useState<Record<string, string>>({});
  const [unassigningUser, setUnassigningUser] = useState<string | null>(null);
  const [showDemoteConfirm, setShowDemoteConfirm] = useState<string | null>(null);
  const [showCredentials, setShowCredentials] = useState(false);
  const [credentials, setCredentials] = useState<User[]>([]);
  const [visiblePasswords, setVisiblePasswords] = useState<Set<string>>(new Set());

  // Add Member State
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    phone: "",
    role: "sales",
    department: "",
    password: "",
    confirmPassword: "",
    status: "Active",
    target: 0
  });

  // Edit Member State
  const [showEditUser, setShowEditUser] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);

  // Reset Password State
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetTargetUser, setResetTargetUser] = useState<User | null>(null);
  const [resetPasswordVal, setResetPasswordVal] = useState("");
  const [confirmResetPasswordVal, setConfirmResetPasswordVal] = useState("");
  const [isResettingPassword, setIsResettingPassword] = useState(false);

  const [isAddingUser, setIsAddingUser] = useState(false);
  const [isUpdatingUser, setIsUpdatingUser] = useState(false);
  const [isDeletingUser, setIsDeletingUser] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!isLoaded) return;
    fetchTeamData();
    fetchCredentials();
  }, [isLoaded]);

  const fetchTeamData = async () => {
    try {
      const response = await fetch(`/api/tl/team-management`);
      if (response.ok) {
        const data = await response.json();
        setTeamData(data.teamData || {
          allUsers: [],
          juniorLeaders: [],
          salesPersons: []
        });
      } else {
        const errorData = await response.json();
        console.error("Team data fetch error:", errorData);
        setTeamData({
          allUsers: [],
          juniorLeaders: [],
          salesPersons: []
        });
        toast.error(errorData.error || "Failed to fetch team data");
      }
    } catch (error) {
      console.error("Error fetching team data:", error);
      setTeamData({
        allUsers: [],
        juniorLeaders: [],
        salesPersons: []
      });
      toast.error("Failed to fetch team data");
    } finally {
      setLoading(false);
    }
  };

  const fetchCredentials = async () => {
    try {
      const response = await fetch("/api/users/credentials");
      if (response.ok) {
        const data = await response.json();
        setCredentials(data);
      }
    } catch (error) {
      console.error("Error fetching credentials:", error);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

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
      setVisiblePasswords(new Set(credentials.map(user => user._id || String(user.id) || user.code)));
    }
  };

  const promoteToJL = async (salespersonCode: string) => {
    try {
      setPromotingUser(salespersonCode);
      const response = await fetch("/api/tl/team-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "promote_to_jl",
          targetUserId: salespersonCode
        })
      });

      if (response.ok) {
        toast.success("User promoted to Junior Leader successfully");
        fetchTeamData();
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to promote user");
      }
    } catch (error) {
      console.error("Error promoting user:", error);
      toast.error("Failed to promote user");
    } finally {
      setPromotingUser(null);
    }
  };

  const assignToJL = async (salespersonCode: string, jlCode: string) => {
    try {
      setAssigningUser(salespersonCode);
      const response = await fetch("/api/tl/team-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "assign_to_jl",
          targetUserId: salespersonCode,
          jlId: jlCode
        })
      });

      if (response.ok) {
        toast.success("User assigned to Junior Leader successfully");
        fetchTeamData();
        setJlSelections(prev => ({ ...prev, [salespersonCode]: "" }));
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to assign user");
      }
    } catch (error) {
      console.error("Error assigning user:", error);
      toast.error("Failed to assign user");
    } finally {
      setAssigningUser(null);
    }
  };

  const unassignFromJL = async (salespersonCode: string) => {
    try {
      setUnassigningUser(salespersonCode);
      const response = await fetch("/api/tl/team-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "unassign_from_jl",
          targetUserId: salespersonCode
        })
      });

      if (response.ok) {
        toast.success("User unassigned successfully");
        fetchTeamData();
        setJlSelections(prev => ({ ...prev, [salespersonCode]: "" }));
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to unassign user");
      }
    } catch (error) {
      console.error("Error unassigning user:", error);
      toast.error("Failed to unassign user");
    } finally {
      setUnassigningUser(null);
    }
  };

  const demoteToSales = async (jlCode: string) => {
    try {
      setDemotingUser(jlCode);
      const response = await fetch("/api/tl/team-management", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "demote_to_sales",
          targetUserId: jlCode
        })
      });

      if (response.ok) {
        toast.success("User demoted to sales successfully");
        fetchTeamData();
        setShowDemoteConfirm(null);
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to demote user");
      }
    } catch (error) {
      console.error("Error demoting user:", error);
      toast.error("Failed to demote user");
    } finally {
      setDemotingUser(null);
    }
  };

  const confirmDemote = (jlCode: string) => {
    setShowDemoteConfirm(jlCode);
  };

  const cancelDemote = () => {
    setShowDemoteConfirm(null);
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.name.trim() || !newUser.email.trim() || !newUser.password) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (newUser.password !== newUser.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newUser.password.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    setIsAddingUser(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newUser),
      });

      if (res.ok) {
        const result = await res.json();
        toast.success(result.message || "Team member created successfully with password!");
        setShowAddUser(false);
        setNewUser({
          name: "",
          email: "",
          phone: "",
          role: "sales",
          department: "",
          password: "",
          confirmPassword: "",
          status: "Active",
          target: 0
        });
        fetchTeamData();
        fetchCredentials();
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingUser),
      });

      if (res.ok) {
        toast.success("User updated successfully");
        setEditingUser(null);
        setShowEditUser(false);
        fetchTeamData();
        fetchCredentials();
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

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTargetUser) return;

    if (!resetPasswordVal || resetPasswordVal.length < 6) {
      toast.error("Password must be at least 6 characters long");
      return;
    }

    if (resetPasswordVal !== confirmResetPasswordVal) {
      toast.error("Passwords do not match");
      return;
    }

    setIsResettingPassword(true);
    try {
      const res = await fetch("/api/users/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: resetTargetUser.id || resetTargetUser._id,
          email: resetTargetUser.email,
          newPassword: resetPasswordVal,
        }),
      });

      if (res.ok) {
        toast.success(`Password for ${resetTargetUser.name} updated successfully!`);
        setShowResetPassword(false);
        setResetTargetUser(null);
        setResetPasswordVal("");
        setConfirmResetPasswordVal("");
        fetchCredentials();
      } else {
        const error = await res.json();
        toast.error(error.error || "Failed to reset password");
      }
    } catch (error) {
      toast.error("Failed to reset password");
    } finally {
      setIsResettingPassword(false);
    }
  };

  const openResetPasswordModal = (user: User) => {
    setResetTargetUser(user);
    setResetPasswordVal("");
    setConfirmResetPasswordVal("");
    setShowResetPassword(true);
  };

  const handleDeleteUser = async (userId: string) => {
    if (!confirm("Are you sure you want to delete this user? This action cannot be undone.")) return;

    setIsDeletingUser(userId);
    try {
      const res = await fetch(`/api/users?id=${userId}`, {
        method: "DELETE"
      });

      if (res.ok) {
        toast.success("User deleted successfully");
        fetchTeamData();
        fetchCredentials();
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

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 flex items-center justify-center">
        <Card className="w-80 border border-slate-200/60 shadow-sm">
          <CardContent className="p-8 text-center">
            <div className="inline-block h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto mb-4"></div>
            <p className="text-slate-700 font-medium">Loading team data...</p>
            <p className="text-xs text-slate-500 mt-2">Please wait</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const displayTeamData = teamData || {
    allUsers: [],
    juniorLeaders: [],
    salesPersons: []
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 py-6">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Team Management</h1>
              <p className="mt-1 text-sm text-slate-600">Manage team members, admin-controlled credentials, and password resets</p>
            </div>
            <div className="flex items-center space-x-3">
              <Button
                onClick={() => setShowCredentials(true)}
                variant="outline"
                size="sm"
                className="gap-2 border-slate-200 hover:bg-slate-50"
              >
                <Settings className="w-4 h-4" />
                Team Credentials
              </Button>
              <Button
                onClick={() => setShowAddUser(true)}
                size="sm"
                className="gap-2 bg-primary hover:bg-primary/90"
              >
                <Plus className="w-4 h-4" />
                Add Member
              </Button>
            </div>
          </div>
        </div>

        {/* Team Hierarchy Overview */}
        <Card className="mb-8 border border-slate-200/60 shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b border-slate-200/60">
            <CardTitle className="text-lg text-slate-900">Team Hierarchy Overview</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="bg-blue-100 rounded-xl w-16 h-16 flex items-center justify-center mx-auto mb-3 shadow-sm">
                  <span className="text-2xl font-bold text-blue-600">{displayTeamData.juniorLeaders.length}</span>
                </div>
                <p className="text-sm font-semibold text-slate-900">Junior Leaders</p>
                <p className="text-xs text-slate-500 mt-1">Team supervisors</p>
              </div>
              <div className="text-center">
                <div className="bg-green-100 rounded-xl w-16 h-16 flex items-center justify-center mx-auto mb-3 shadow-sm">
                  <span className="text-2xl font-bold text-green-600">{displayTeamData.salesPersons.length}</span>
                </div>
                <p className="text-sm font-semibold text-slate-900">Sales Persons</p>
                <p className="text-xs text-slate-500 mt-1">Active agents</p>
              </div>
              <div className="text-center">
                <div className="bg-purple-100 rounded-xl w-16 h-16 flex items-center justify-center mx-auto mb-3 shadow-sm">
                  <span className="text-2xl font-bold text-purple-600">{displayTeamData.allUsers.length}</span>
                </div>
                <p className="text-sm font-semibold text-slate-900">Total Team Members</p>
                <p className="text-xs text-slate-500 mt-1">Entire team</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Junior Leaders Section */}
        <Card className="mb-8 border border-slate-200/60 shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b border-slate-200/60">
            <CardTitle className="text-lg text-slate-900">Junior Leaders</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            {displayTeamData.juniorLeaders.length === 0 ? (
              <p className="text-slate-500 text-center py-4">No Junior Leaders yet</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {displayTeamData.juniorLeaders.map((jl) => (
                  <Card key={jl.code} className="border border-slate-200/60 shadow-sm hover:shadow-md transition-all duration-200">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-slate-900">{jl.name}</h3>
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700">JL</Badge>
                      </div>
                      <p className="text-sm text-slate-600 mb-2">{jl.email}</p>
                      <p className="text-sm text-slate-500 mb-3">Team Members: <span className="font-semibold">{jl.teamMembers.length}</span></p>

                      {showDemoteConfirm === jl.code ? (
                        <div className="space-y-2">
                          <p className="text-xs text-red-600 font-medium">Are you sure?</p>
                          <div className="flex space-x-2">
                            <Button
                              onClick={() => demoteToSales(jl.code)}
                              disabled={demotingUser === jl.code}
                              variant="destructive"
                              size="sm"
                              className="flex-1"
                            >
                              {demotingUser === jl.code ? "Demoting..." : "Yes, Demote"}
                            </Button>
                            <Button onClick={cancelDemote} variant="outline" size="sm" className="flex-1">
                              Cancel
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <Button
                          onClick={() => confirmDemote(jl.code)}
                          disabled={demotingUser === jl.code}
                          variant="outline"
                          size="sm"
                          className="w-full text-slate-700 hover:text-slate-900 border-slate-200"
                        >
                          Demote to Sales
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Sales Persons Section */}
        <Card className="mb-8 border border-slate-200/60 shadow-sm">
          <CardHeader className="bg-slate-50/50 border-b border-slate-200/60 flex flex-row items-center justify-between">
            <CardTitle className="text-lg text-slate-900">All Team Members</CardTitle>
            <div className="w-64 relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                type="text"
                placeholder="Search member..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-sm"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {displayTeamData.salesPersons.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No team members found</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <THead>
                    <TR className="border-b border-slate-200 bg-slate-50/50">
                      <TH className="text-slate-700">Member</TH>
                      <TH className="text-slate-700">Role</TH>
                      <TH className="text-slate-700">Status</TH>
                      <TH className="text-slate-700">Assigned To</TH>
                      <TH className="text-slate-700 text-right">Actions</TH>
                    </TR>
                  </THead>
                  <TBody>
                    {displayTeamData.salesPersons
                      .filter((sp) =>
                        sp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                        sp.email.toLowerCase().includes(searchTerm.toLowerCase())
                      )
                      .map((salesperson) => (
                      <TR key={salesperson.code} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <TD>
                          <div>
                            <div className="font-semibold text-slate-900">{salesperson.name}</div>
                            <div className="text-xs text-slate-500">{salesperson.email}</div>
                          </div>
                        </TD>
                        <TD>
                          <Badge variant="outline" className="capitalize">
                            {salesperson.role || "sales"}
                          </Badge>
                        </TD>
                        <TD>
                          <Badge
                            className={
                              (salesperson.status || "Active").toLowerCase() === "active"
                                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-0"
                                : "bg-slate-100 text-slate-800 hover:bg-slate-100 border-0"
                            }
                          >
                            {salesperson.status || "Active"}
                          </Badge>
                        </TD>
                        <TD>
                          {salesperson.assignedTo ? (
                            <div className="flex items-center space-x-2">
                              <Badge variant="secondary" className="bg-green-100 text-green-700">
                                JL: {salesperson.assignedTo}
                              </Badge>
                              <Button
                                onClick={() => unassignFromJL(salesperson.code)}
                                disabled={unassigningUser === salesperson.code}
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2 text-xs text-slate-500 hover:text-slate-700"
                              >
                                {unassigningUser === salesperson.code ? "Unassigning..." : "Unassign"}
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <select
                                className="text-sm border border-slate-200 rounded px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                                value={jlSelections[salesperson.code] || ""}
                                onChange={(e) =>
                                  setJlSelections((prev) => ({
                                    ...prev,
                                    [salesperson.code]: e.target.value,
                                  }))
                                }
                              >
                                <option value="">Select JL</option>
                                {displayTeamData.juniorLeaders.map((jl) => (
                                  <option key={jl.code} value={jl.code}>
                                    {jl.name}
                                  </option>
                                ))}
                              </select>
                              <Button
                                onClick={() =>
                                  assignToJL(salesperson.code, jlSelections[salesperson.code])
                                }
                                disabled={
                                  !jlSelections[salesperson.code] ||
                                  assigningUser === salesperson.code
                                }
                                size="sm"
                                variant="outline"
                                className="h-8 text-xs bg-white border-slate-200 hover:bg-slate-50"
                              >
                                {assigningUser === salesperson.code ? "Assigning..." : "Assign"}
                              </Button>
                            </div>
                          )}
                        </TD>
                        <TD className="text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openResetPasswordModal(salesperson)}
                              className="text-amber-600 hover:text-amber-700 hover:bg-amber-50 h-8 px-2"
                              title="Reset Password"
                            >
                              <KeyRound className="w-4 h-4 mr-1" />
                              Reset Password
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => promoteToJL(salesperson.code)}
                              disabled={promotingUser === salesperson.code}
                              className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 h-8 px-2"
                            >
                              {promotingUser === salesperson.code ? "Promoting..." : "Promote"}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingUser(salesperson);
                                setShowEditUser(true);
                              }}
                              className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 h-8 px-2"
                            >
                              <Edit className="w-4 h-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                handleDeleteUser(
                                  salesperson.id ? String(salesperson.id) : salesperson.code
                                )
                              }
                              disabled={
                                isDeletingUser ===
                                (salesperson.id ? String(salesperson.id) : salesperson.code)
                              }
                              className="text-red-600 hover:text-red-900 hover:bg-red-50 h-8 px-2"
                            >
                              <Trash2 className="w-4 h-4 mr-1" />
                              Delete
                            </Button>
                          </div>
                        </TD>
                      </TR>
                    ))}
                  </TBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Add User Modal */}
        <Dialog open={showAddUser} onOpenChange={setShowAddUser}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900">Add New Team Member</DialogTitle>
              <p className="text-xs text-slate-500">Create a team member account with an admin-assigned password</p>
            </DialogHeader>
            <form onSubmit={handleAddUser} className="space-y-4 pt-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name *</label>
                <Input
                  type="text"
                  required
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="e.g. John Doe"
                  className="border-slate-200"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email Address *</label>
                  <Input
                    type="email"
                    required
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="john@example.com"
                    className="border-slate-200"
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number (Optional)</label>
                  <Input
                    type="tel"
                    value={newUser.phone}
                    onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                    placeholder="+1 234 567 8900"
                    className="border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role *</label>
                  <select
                    className="w-full text-sm border border-slate-200 rounded-md p-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                  >
                    <option value="sales">Sales Executive</option>
                    <option value="jl">Junior Leader (JL)</option>
                    <option value="teamleader">Team Leader</option>
                    <option value="CEO">Super Admin / CEO</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Department (Optional)</label>
                  <Input
                    type="text"
                    value={newUser.department}
                    onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                    placeholder="e.g. Sales / Support"
                    className="border-slate-200"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password *</label>
                  <Input
                    type="password"
                    required
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="Min 6 characters"
                    className="border-slate-200"
                    autoComplete="new-password"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password *</label>
                  <Input
                    type="password"
                    required
                    value={newUser.confirmPassword}
                    onChange={(e) => setNewUser({ ...newUser, confirmPassword: e.target.value })}
                    placeholder="Re-enter password"
                    className="border-slate-200"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select
                    className="w-full text-sm border border-slate-200 rounded-md p-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary"
                    value={newUser.status}
                    onChange={(e) => setNewUser({ ...newUser, status: e.target.value })}
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Sales Target (₹)</label>
                  <Input
                    type="number"
                    value={newUser.target || ""}
                    onChange={(e) => setNewUser({ ...newUser, target: parseInt(e.target.value) || 0 })}
                    placeholder="Target amount"
                    className="border-slate-200"
                  />
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <Button type="submit" disabled={isAddingUser} className="flex-1 bg-primary hover:bg-primary/90">
                  {isAddingUser ? (
                    <div className="flex items-center space-x-2">
                      <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                      <span>Creating Member...</span>
                    </div>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 mr-2" />
                      Add Member
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAddUser(false)}
                  disabled={isAddingUser}
                  className="flex-1 border-slate-200"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Edit User Modal */}
        <Dialog open={showEditUser} onOpenChange={(open) => (!open && setEditingUser(null)) || setShowEditUser(open)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg text-slate-900">Edit Team Member</DialogTitle>
            </DialogHeader>
            {editingUser && (
              <form onSubmit={handleUpdateUser} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                  <Input
                    type="text"
                    required
                    value={editingUser.name}
                    onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                    placeholder="Enter full name"
                    className="border-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <Input
                    type="email"
                    required
                    value={editingUser.email}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                    placeholder="Enter email address"
                    className="border-slate-200"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                    <Input
                      type="text"
                      value={editingUser.phone || ""}
                      onChange={(e) => setEditingUser({ ...editingUser, phone: e.target.value })}
                      placeholder="Phone number"
                      className="border-slate-200"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Department</label>
                    <Input
                      type="text"
                      value={editingUser.department || ""}
                      onChange={(e) => setEditingUser({ ...editingUser, department: e.target.value })}
                      placeholder="Department"
                      className="border-slate-200"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                    <select
                      className="w-full text-sm border border-slate-200 rounded-md p-2 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                      value={editingUser.role}
                      onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
                    >
                      <option value="sales">Sales Executive</option>
                      <option value="jl">Junior Leader</option>
                      <option value="teamleader">Team Leader</option>
                      <option value="CEO">Super Admin</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                    <select
                      className="w-full text-sm border border-slate-200 rounded-md p-2 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                      value={editingUser.status || "Active"}
                      onChange={(e) => setEditingUser({ ...editingUser, status: e.target.value })}
                    >
                      <option value="Active">Active</option>
                      <option value="Inactive">Inactive</option>
                    </select>
                  </div>
                </div>

                <div className="flex space-x-3 pt-4">
                  <Button type="submit" disabled={isUpdatingUser} className="flex-1">
                    {isUpdatingUser ? "Updating..." : "Update Member"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingUser(null);
                      setShowEditUser(false);
                    }}
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

        {/* Reset Password Modal */}
        <Dialog open={showResetPassword} onOpenChange={setShowResetPassword}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-amber-600" />
                Reset Password
              </DialogTitle>
              {resetTargetUser && (
                <p className="text-sm text-slate-500">
                  Enter new password for <span className="font-semibold text-slate-800">{resetTargetUser.name}</span> ({resetTargetUser.email})
                </p>
              )}
            </DialogHeader>
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4 pt-2">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                <Input
                  type="password"
                  required
                  value={resetPasswordVal}
                  onChange={(e) => setResetPasswordVal(e.target.value)}
                  placeholder="Enter new password (min 6 characters)"
                  className="border-slate-200"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm New Password</label>
                <Input
                  type="password"
                  required
                  value={confirmResetPasswordVal}
                  onChange={(e) => setConfirmResetPasswordVal(e.target.value)}
                  placeholder="Re-enter new password"
                  className="border-slate-200"
                  autoComplete="new-password"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <Button type="submit" disabled={isResettingPassword} className="flex-1 bg-amber-600 hover:bg-amber-700 text-white">
                  {isResettingPassword ? "Saving Password..." : "Save New Password"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowResetPassword(false)}
                  disabled={isResettingPassword}
                  className="flex-1 border-slate-200"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Credentials Modal */}
        <Dialog open={showCredentials} onOpenChange={setShowCredentials}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                    Team Credentials
                  </DialogTitle>
                  <p className="text-xs text-slate-500 mt-1">Admin-managed credentials for team members</p>
                </div>
                <Button variant="outline" size="sm" onClick={toggleAllPasswords} className="gap-2 border-slate-200">
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

            <div className="flex-1 overflow-y-auto pt-2 space-y-4">
              <div className="grid gap-4">
                {credentials.map((user) => {
                  const key = user._id || String(user.id) || user.code;
                  const isVisible = visiblePasswords.has(key);
                  return (
                    <Card key={key} className="border border-slate-200/60 shadow-sm hover:border-slate-300 transition-all">
                      <CardContent className="p-4">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex items-center space-x-4">
                            <div className="h-12 w-12 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                              <span className="text-lg font-bold text-white">
                                {(user.name || "").split(" ").map((n) => n[0]).join("").toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <h3 className="text-base font-semibold text-slate-900">{user.name}</h3>
                                <Badge className="text-xs capitalize bg-slate-100 text-slate-700 border-0">
                                  {user.role || "sales"}
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-500">{user.email}</p>
                              {user.phone && <p className="text-xs text-slate-400">Phone: {user.phone}</p>}
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 md:justify-end">
                            {/* Login ID */}
                            <div className="bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 flex items-center space-x-2">
                              <div>
                                <span className="text-[10px] font-semibold uppercase text-slate-400 block">Login ID</span>
                                <span className="text-xs font-mono text-slate-800">{user.email}</span>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(user.email, "Login ID")}
                                className="h-7 w-7 p-0 text-slate-500 hover:text-slate-800"
                                title="Copy Login ID"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </Button>
                            </div>

                            {/* Password */}
                            <div className="bg-slate-50 border border-slate-200 rounded-md px-3 py-1.5 flex items-center space-x-2 min-w-[170px]">
                              <div className="flex-1">
                                <span className="text-[10px] font-semibold uppercase text-slate-400 block">Password</span>
                                <span className="text-xs font-mono text-slate-800">
                                  {isVisible ? "••••••••" : "••••••••"}
                                </span>
                              </div>
                              <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">
                                Password Set
                              </Badge>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => togglePasswordVisibility(key)}
                                className="h-7 w-7 p-0 text-slate-500 hover:text-slate-800"
                                title={isVisible ? "Hide Password" : "Show Password"}
                              >
                                {isVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => copyToClipboard(user.email, "User Login ID / Email")}
                                className="h-7 w-7 p-0 text-slate-500 hover:text-slate-800"
                                title="Copy Login Email"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </Button>
                            </div>

                            {/* Reset Password Action */}
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openResetPasswordModal(user)}
                              className="gap-1.5 text-xs text-amber-700 border-amber-200 bg-amber-50 hover:bg-amber-100"
                            >
                              <KeyRound className="w-3.5 h-3.5" />
                              Reset Password
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {credentials.length === 0 && (
                <Card className="border border-slate-200/60">
                  <CardContent className="text-center py-8">
                    <Users className="mx-auto h-12 w-12 text-slate-400" />
                    <h3 className="mt-2 text-sm font-medium text-slate-900">No team members found</h3>
                    <p className="mt-1 text-sm text-slate-500">Add team members to manage their credentials.</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}