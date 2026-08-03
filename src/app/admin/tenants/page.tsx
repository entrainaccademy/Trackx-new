"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Users, Globe, Calendar, CheckCircle, XCircle, ExternalLink, Trash2, Plus } from "lucide-react";
import toast from "react-hot-toast";
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

export default function AdminTenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingTenant, setDeletingTenant] = useState<number | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);

  useEffect(() => {
    fetchTenants();
  }, []);

  const fetchTenants = async () => {
    try {
      const response = await fetch("/api/admin/tenants");
      if (response.ok) {
        const data = await response.json();
        setTenants(data.tenants || []);
      } else {
        setError("Failed to fetch tenants");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTenant = async (tenantId: number) => {
    try {
      setDeletingTenant(tenantId);
      const toastId = toast.loading("Deleting tenant...");

      const response = await fetch(`/api/admin/tenants/${tenantId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        toast.success("Tenant deleted successfully", { id: toastId });
        // Remove tenant from local state
        setTenants(prev => prev.filter(t => t.id !== tenantId));
        setShowDeleteConfirm(null);
      } else {
        const data = await response.json();
        toast.error(data.error || "Failed to delete tenant", { id: toastId });
      }
    } catch (err) {
      toast.error("Network error while deleting tenant");
    } finally {
      setDeletingTenant(null);
    }
  };

  const confirmDelete = (tenantId: number) => {
    setShowDeleteConfirm(tenantId);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(null);
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
          <p className="text-gray-600">Loading tenants...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-800 mb-2">Error Loading Tenants</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchTenants}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
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
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-blue-100 rounded-xl">
                <Users className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Client Management and Onboardings</h1>
                <p className="text-gray-600">Manage all client environments and their status</p>
              </div>
            </div>
            <div className="flex justify-end mb-4">
              <button
                onClick={() => router.push("/onboarding")}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add New Client
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-blue-50 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Globe className="w-6 h-6 text-blue-600" />
                  <div>
                    <p className="text-2xl font-bold text-blue-600">{tenants.length}</p>
                    <p className="text-sm text-blue-600">Total Tenants</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-green-50 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <div>
                    <p className="text-2xl font-bold text-green-600">
                      {tenants.filter(t => t.active).length}
                    </p>
                    <p className="text-sm text-green-600">Active Tenants</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-orange-50 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <Calendar className="w-6 h-6 text-orange-600" />
                  <div>
                    <p className="text-2xl font-bold text-orange-600">
                      {tenants.filter(t => new Date(t.createdAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length}
                    </p>
                    <p className="text-sm text-orange-600">New This Week</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Tenants List */}
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">All Tenants</h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Tenant
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Contact Info
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
                  {tenants.map((tenant, index) => (
                    <motion.tr
                      key={tenant.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{tenant.name}</div>
                          <div className="text-sm text-gray-500">
                            {tenant.subdomain}.wydex.co
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {tenant.metadata?.contactName || "N/A"}
                        </div>
                        <div className="text-sm text-gray-500">
                          {tenant.metadata?.email || "N/A"}
                        </div>
                        {tenant.metadata?.staffCount !== undefined && (
                          <div className="text-sm text-gray-500 font-medium">
                            Staff Count: {tenant.metadata.staffCount}
                          </div>
                        )}
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          tenant.active
                            ? "bg-green-100 text-green-800"
                            : "bg-red-100 text-red-800"
                        }`}>
                          {tenant.active ? (
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
                        {formatDate(tenant.createdAt)}
                      </td>
                      
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2">
                          <button
                            onClick={() => router.push(`/admin/tenants/${tenant.id}`)}
                            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-900 transition-colors cursor-pointer"
                          >
                            <Users className="w-4 h-4" />
                            Manage
                          </button>
                          <a
                            href={`https://${tenant.subdomain}.wydex.co`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-green-600 hover:text-green-900 transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                            Visit
                          </a>
                          <button
                            onClick={() => confirmDelete(tenant.id)}
                            className="inline-flex items-center gap-2 text-red-600 hover:text-red-900 transition-colors cursor-pointer"
                            disabled={deletingTenant === tenant.id}
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            {tenants.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No tenants yet</h3>
                <p className="text-gray-500">When clients sign up through the onboarding page, they'll appear here.</p>
              </div>
            )}
          </div>
        </motion.div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-2">Confirm Deletion</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete tenant "{tenants.find(t => t.id === showDeleteConfirm)?.name}"?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={cancelDelete}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteTenant(showDeleteConfirm)}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                disabled={deletingTenant === showDeleteConfirm}
              >
                {deletingTenant === showDeleteConfirm ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mx-auto"></div>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div id="toast-container" />
    </div>
  );
}
