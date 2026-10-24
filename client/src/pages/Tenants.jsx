import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../api/apiClient";
import { ENDPOINTS } from "../config/api";
import { toast } from "react-hot-toast";
import { Plus, Key, Power, Trash, Mail, Copy } from "lucide-react";
import Pagination from "../components/Pagination";
import SearchBar from "../components/SearchBar";
import useDebounce from "../utils/useDebounce";

const Tenants = () => {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearchTerm = useDebounce(searchTerm, 350);
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const [modalOpen, setModalOpen] = useState(false);
  const [passkeyModal, setPasskeyModal] = useState(null);
  const [formData, setFormData] = useState({
    name: "",
    subdomain: "",
    email: "",
  });

  useEffect(() => {
    setPage(1);
  }, [debouncedSearchTerm, statusFilter]);

  const queryParams = {
    page,
    limit: pageSize,
    ...(debouncedSearchTerm ? { search: debouncedSearchTerm } : {}),
    ...(statusFilter !== "all" ? { status: statusFilter } : {}),
  };

  const {
    data: queryResult,
    isLoading: loading,
    isFetching,
  } = useQuery({
    queryKey: ["tenants", queryParams],
    queryFn: async () => {
      const { data } = await apiClient.get(ENDPOINTS.TENANTS, { params: queryParams });
      return data;
    },
    placeholderData: (previousData) => previousData,
  });

  const tenants = Array.isArray(queryResult)
    ? queryResult
    : queryResult?.data || [];
  const totalTenants = Array.isArray(queryResult)
    ? queryResult.length
    : (queryResult?.total ?? 0);
  const totalPages = Array.isArray(queryResult)
    ? 1
    : (queryResult?.pages ?? 1);

  const createTenantMutation = useMutation({
    mutationFn: async (data) => {
      return apiClient.post(ENDPOINTS.TENANTS, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast.success("Tenant created successfully");
      setFormData({ name: "", subdomain: "", email: "" });
      setModalOpen(false);
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to create tenant");
    },
  });

  const generatePasskeyMutation = useMutation({
    mutationFn: async (tenant) => {
      const { data } = await apiClient.post(ENDPOINTS.TENANT_PASSKEY(tenant._id));
      return { data, tenant };
    },
    onSuccess: ({ data, tenant }) => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      setPasskeyModal({
        passkey: data.setupPasskey,
        tenant,
      });
    },
    onError: () => {
      toast.error("Failed to generate passkey");
    },
  });

  const toggleStatusMutation = useMutation({
    mutationFn: async (tenant) => {
      await apiClient.put(ENDPOINTS.TENANT_BY_ID(tenant._id), {
        isActive: !tenant.isActive,
      });
      return tenant;
    },
    onSuccess: (tenant) => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast.success(`Tenant ${tenant.isActive ? "disabled" : "enabled"}`);
    },
    onError: () => {
      toast.error("Failed to update status");
    },
  });

  const resendEmailMutation = useMutation({
    mutationFn: async (id) => {
      const { data } = await apiClient.post(ENDPOINTS.TENANT_RESEND_WELCOME(id));
      return data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "Email sent successfully");
    },
    onError: (error) => {
      toast.error(error.response?.data?.message || "Failed to send email");
    },
  });

  const deleteTenantMutation = useMutation({
    mutationFn: async (id) => {
      return apiClient.delete(ENDPOINTS.TENANT_BY_ID(id));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tenants"] });
      toast.success("Tenant deleted successfully");
    },
    onError: () => {
      toast.error("Failed to delete tenant");
    },
  });

  const handleCreate = (e) => {
    e.preventDefault();
    createTenantMutation.mutate(formData);
  };

  const generatePasskey = (tenant) => {
    if (
      !window.confirm("Generate new passkey? This will invalidate the old one.")
    )
      return;
    generatePasskeyMutation.mutate(tenant);
  };

  const toggleStatus = (tenant) => {
    toggleStatusMutation.mutate(tenant);
  };

  const handleResendEmail = (id) => {
    if (!window.confirm("Resend the welcome email to this tenant?")) return;
    resendEmailMutation.mutate(id);
  };

  const handleDeleteTenant = (id) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this tenant? This action cannot be undone."
      )
    )
      return;
    deleteTenantMutation.mutate(id);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Tenants</h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage all organizations and their access.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setModalOpen(true)}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            <Plus className="mr-2 h-5 w-5" />
            Add Tenant
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between">
        <div className="flex-1 max-w-md">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Search name, subdomain, email, dbName..."
          />
        </div>
        <div className="flex items-center gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-white rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
          {isFetching && !loading && (
            <span className="text-xs text-blue-400 animate-pulse bg-blue-500/10 px-2 py-1 rounded">
              Updating...
            </span>
          )}
          {totalTenants > 0 && (
            <span className="text-xs text-slate-400 bg-slate-800 px-2.5 py-1.5 rounded-md border border-slate-700">
              {totalTenants} {totalTenants === 1 ? "tenant" : "tenants"}
            </span>
          )}
        </div>
      </div>

      <div className="bg-slate-900 shadow rounded-lg overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-950">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Subdomain
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Setup
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-slate-900 divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mb-2"></div>
                      <p>Loading tenants...</p>
                    </div>
                  </td>
                </tr>
              ) : tenants.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-slate-400">
                    No tenants found matching your criteria.
                  </td>
                </tr>
              ) : (
                tenants.map((tenant) => (
                  <tr key={tenant._id} className="hover:bg-slate-800/50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">
                        {tenant.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <a
                        href={`https://${tenant.subdomain}.merchpilot.xyz`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-400 hover:text-blue-300 hover:underline"
                      >
                        {tenant.subdomain}
                      </a>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-400">
                        {tenant.email || "-"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${tenant.isActive
                          ? "bg-green-900/50 text-green-400 border border-green-800"
                          : "bg-red-900/50 text-red-400 border border-red-800"
                          }`}
                      >
                        {tenant.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {tenant.isSetupComplete ? (
                        <span className="text-sm text-green-400">Complete</span>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-yellow-500">Pending</span>
                          {tenant.setupPasskey && (
                            <span className="text-xs font-mono bg-slate-800 text-slate-300 px-1 rounded border border-slate-700">
                              {tenant.setupPasskey}
                            </span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          onClick={() => handleResendEmail(tenant._id)}
                          className="text-yellow-500 hover:text-yellow-400"
                          title="Resend Welcome Email"
                        >
                          <Mail className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => generatePasskey(tenant)}
                          className="text-blue-400 hover:text-blue-300"
                          title="Generate Passkey"
                        >
                          <Key className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => toggleStatus(tenant)}
                          className={`${tenant.isActive
                            ? "text-green-400 hover:text-green-300"
                            : "text-slate-500 hover:text-slate-400"
                            }`}
                          title={tenant.isActive ? "Disable" : "Enable"}
                        >
                          <Power className="h-5 w-5" />
                        </button>
                        <button
                          onClick={() => handleDeleteTenant(tenant._id)}
                          className="text-red-400 hover:text-red-300"
                          title="Delete Tenant"
                        >
                          <Trash className="h-5 w-5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )))
              }
            </tbody>
          </table>
        </div>

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={totalTenants}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
        />
      </div>

      {modalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-lg w-full max-w-lg overflow-y-auto border border-slate-800 shadow-xl">
            <div className="flex justify-between items-center p-6 border-b border-slate-800">
              <h3 className="text-xl font-bold text-white">Create Tenant</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <Plus className="h-6 w-6 rotate-45" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Organization Name
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-600 placeholder-slate-500"
                  placeholder="ABC Company"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Subdomain
                </label>
                <div className="flex rounded-md shadow-sm">
                  <input
                    type="text"
                    required
                    value={formData.subdomain}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        subdomain: e.target.value,
                      })
                    }
                    className="flex-1 bg-slate-950 border border-r-0 border-slate-700 rounded-l-md p-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-600 placeholder-slate-500"
                    placeholder="abc"
                  />
                  <span className="inline-flex items-center px-3 rounded-r-md border border-l-0 border-slate-700 bg-slate-800 text-slate-400 text-sm">
                    .merchpilot.xyz
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Admin Email
                </label>
                <input
                  type="email"
                  required
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-md p-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-600 placeholder-slate-500"
                  placeholder="admin@example.com"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-slate-700 rounded-md text-slate-300 hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Create Tenant
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Passkey Modal */}
      {passkeyModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-slate-900 rounded-lg w-full max-w-md border border-slate-800 shadow-xl p-6">
            <div className="text-center mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-blue-900/50 mb-4">
                <Key className="h-6 w-6 text-blue-400" />
              </div>
              <h3 className="text-xl font-bold text-white">
                Passkey Generated
              </h3>
              <p className="text-slate-400 text-sm mt-2">
                A new setup passkey has been generated for{" "}
                <span className="text-white font-medium">
                  {passkeyModal.tenant.name}
                </span>
                .
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-md border border-slate-800 mb-6">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
                Setup Passkey
              </label>
              <div className="flex items-center gap-2">
                <code className="flex-1 font-mono text-2xl text-blue-400 tracking-wider">
                  {passkeyModal.passkey}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(passkeyModal.passkey);
                    toast.success("Copied to clipboard");
                  }}
                  className="p-2 text-slate-400 hover:text-white transition-colors"
                  title="Copy to clipboard"
                >
                  <Copy className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="bg-blue-900/20 border border-blue-900/50 rounded p-3 mb-6 flex items-start gap-3">
              <Mail className="h-5 w-5 text-blue-400 mt-0.5" />
              <p className="text-sm text-blue-200">
                An email containing this passkey has been sent to{" "}
                <span className="font-medium text-white">
                  {passkeyModal.tenant.email}
                </span>
                .
              </p>
            </div>

            <button
              onClick={() => setPasskeyModal(null)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-md transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tenants;
