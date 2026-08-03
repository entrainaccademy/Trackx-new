"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useParams, useRouter } from "next/navigation";
import { 
  Users, 
  UserPlus, 
  Key, 
  Mail, 
  Phone, 
  Building, 
  Calendar,
  ArrowLeft,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  Eye,
  EyeOff
} from "lucide-react";
// Clerk handles authentication automatically via cookies - no need for fetch

interface Tenant {
  id: number;
  subdomain: string;
  name: string;
  active: boolean;
  metadata: any;
  createdAt: string;
  updatedAt: string;
}

interface TeamLeader {
  _id?: string;
  code: string;
  name: string;
  email: string;
  phone?: string;
  password?: string;
  role: string;
  tenantSubdomain: string;
  createdAt: string;
  active: boolean;
}

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [teamLeaders, setTeamLeaders] = useState<TeamLeader[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingLeader, setEditingLeader] = useState<TeamLeader | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    code: "",
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  useEffect(() => {
    if (params.id) {
      fetchTenantDetails();
      fetchTeamLeaders();
    }
  }, [params.id]);

  const fetchTenantDetails = async () => {
    try {
      const response = await fetch(`/api/admin/tenants/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setTenant(data.tenant);
      } else {
        setError("Failed to fetch tenant details");
      }
    } catch (err) {
      setError("Network error");
    }
  };

  const fetchTeamLeaders = async () => {
    try {
      const response = await fetch(`/api/admin/tenants/${params.id}/team-leaders`);
      if (response.ok) {
        const data = await response.json();
        setTeamLeaders(data.teamLeaders || []);
      }
    } catch (err) {
      console.error("Failed to fetch team leaders:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      setError("Passwords don't match");
      return;
    }

    try {
      const response = await fetch(`/api/admin/tenants/${params.id}/team-leaders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          role: "teamleader",
          tenantSubdomain: tenant?.subdomain,
        }),
      });

      if (response.ok) {
        setFormData({
          code: "",
          name: "",
          email: "",
          phone: "",
          password: "",
          confirmPassword: "",
        });
        setShowCreateForm(false);
        setShowPassword(false);
        setShowConfirmPassword(false);
        fetchTeamLeaders();
        setError(null);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to create team leader");
      }
    } catch (err) {
      setError("Network error");
    }
  };

  const handleEdit = (leader: TeamLeader) => {
    setEditingLeader(leader);
    setFormData({
      code: leader.code,
      name: leader.name,
      email: leader.email,
      phone: leader.phone || "",
      password: leader.password || "",
      confirmPassword: leader.password || "",
    });
    setShowPassword(true);
    setShowConfirmPassword(true);
    setShowCreateForm(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!editingLeader?._id) return;

    try {
      const response = await fetch(`/api/admin/tenants/${params.id}/team-leaders/${editingLeader._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          role: "teamleader",
          tenantSubdomain: tenant?.subdomain,
        }),
      });

      if (response.ok) {
        setEditingLeader(null);
        setShowCreateForm(false);
        fetchTeamLeaders();
        setError(null);
      } else {
        const data = await response.json();
        setError(data.error || "Failed to update team leader");
      }
    } catch (err) {
      setError("Network error");
    }
  };

  const handleDelete = async (leaderId: string) => {
    if (!confirm("Are you sure you want to delete this team leader?")) return;

    try {
      const response = await fetch(`/api/admin/tenants/${params.id}/team-leaders/${leaderId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchTeamLeaders();
      }
    } catch (err) {
      setError("Failed to delete team leader");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading tenant details...</p>
        </div>
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Error Loading Tenant</h2>
          <p className="text-gray-600 mb-4">{error || "Tenant not found"}</p>
          <button
            onClick={() => router.back()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Header */}
          <div className="bg-white rounded-2xl shadow-lg p-6 mb-8">
            <div className="flex items-center gap-4 mb-6">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-6 h-6 text-gray-600" />
              </button>
              <div className="p-3 bg-blue-100 rounded-xl">
                <Building className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{tenant.name}</h1>
                <p className="text-gray-600">
                  {tenant.subdomain}.leaderboard.proskilledu.com
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Users className="w-6 h-6 text-blue-600" />
                  <div>
                    <p className="text-2xl font-bold text-blue-600">{teamLeaders.length}</p>
                    <p className="text-sm text-blue-600">Team Leaders</p>
                  </div>
                </div>
              </div>

              <div className="bg-indigo-50 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Building className="w-6 h-6 text-indigo-600" />
                  <div>
                    <p className="text-2xl font-bold text-indigo-600">{tenant.metadata?.staffCount ?? "N/A"}</p>
                    <p className="text-sm text-indigo-600">Staff Count</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-green-50 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {teamLeaders.filter(t => t.active).length}
                    </p>
                    <p className="text-sm text-green-600">Active</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-orange-50 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Calendar className="w-6 h-6 text-orange-600" />
                  <div>
                    <p className="text-2xl font-bold text-orange-600">
                      {formatDate(tenant.createdAt).split(',')[0]}
                    </p>
                    <p className="text-sm text-orange-600">Created</p>
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Mail className="w-6 h-6 text-purple-600" />
                  <div>
                    <p className="text-sm font-medium text-purple-600 truncate">
                      {tenant.metadata?.email || "No email"}
                    </p>
                    <p className="text-xs text-purple-600">Contact</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Team Leaders Section */}
          <div className="bg-white text-black rounded-2xl shadow-lg overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">Team Leaders</h2>
              <button
                onClick={() => {
                  setShowCreateForm(true);
                  setEditingLeader(null);
                  setShowPassword(false);
                  setShowConfirmPassword(false);
                  setFormData({
                    code: "",
                    name: "",
                    email: "",
                    phone: "",
                    password: "",
                    confirmPassword: "",
                  });
                }}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <UserPlus className="w-4 h-4" />
                Add Team Leader
              </button>
            </div>

            {/* Create/Edit Form */}
            {showCreateForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="border-b border-gray-200 p-6 text-black"
              >
                <h3 className="text-lg font-semibold mb-4">
                  {editingLeader ? "Edit Team Leader" : "Create New Team Leader"}
                </h3>
                
                <form onSubmit={editingLeader ? handleUpdate : handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Code *
                      </label>
                      <input
                        type="text"
                        name="code"
                        value={formData.code}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="e.g., TL001"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Name *
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Full name"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email *
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="email@company.com"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone
                      </label>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="+1 (555) 123-4567"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Password {editingLeader ? "(leave blank to keep current)" : "*"}
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          name="password"
                          value={formData.password}
                          onChange={handleInputChange}
                          required={!editingLeader}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Confirm Password {editingLeader ? "(leave blank to keep current)" : "*"}
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? "text" : "password"}
                          name="confirmPassword"
                          value={formData.confirmPassword}
                          onChange={handleInputChange}
                          required={!editingLeader}
                          className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="••••••••"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        >
                          {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-100 text-red-800 rounded-lg border border-red-200">
                      {error}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      type="submit"
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {editingLeader ? "Update Team Leader" : "Create Team Leader"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowCreateForm(false);
                        setEditingLeader(null);
                        setError(null);
                      }}
                      className="px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* Team Leaders List */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Team Leader
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Created
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {teamLeaders.map((leader, index) => (
                    <motion.tr
                      key={leader._id || index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{leader.name}</div>
                          <div className="text-sm text-gray-500">Code: {leader.code}</div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{leader.email}</div>
                        {leader.phone && (
                          <div className="text-sm text-gray-500">{leader.phone}</div>
                        )}
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          leader.active
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}>
                          {leader.active ? (
                            <>
                              <CheckCircle className="w-3 h-3 mr-1" />
                              Active
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 mr-1" />
                              Inactive
                            </>
                          )}
                        </span>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatDate(leader.createdAt)}
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleEdit(leader)}
                            className="text-blue-600 hover:text-blue-900 transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => leader._id && handleDelete(leader._id)}
                            className="text-red-600 hover:text-red-900 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
              
              {teamLeaders.length === 0 && (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No team leaders yet</h3>
                  <p className="text-gray-500">Create the first team leader for this tenant.</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
