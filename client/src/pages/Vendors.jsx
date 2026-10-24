import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../api/apiClient";
import { ENDPOINTS } from "../config/api";
import { Plus, Edit, Trash, Search, Eye } from "lucide-react";
import toast from "react-hot-toast";
import VendorForm from "../components/VendorForm";
import VendorDetailModal from "../components/VendorDetailModal";
import Pagination from "../components/Pagination";
import { useDebounce } from "../utils/useDebounce";

const Vendors = () => {
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [showForm, setShowForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [viewingVendorId, setViewingVendorId] = useState(null);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const queryParams = {
    page,
    limit: pageSize,
    ...(debouncedSearch?.trim() ? { search: debouncedSearch.trim() } : {}),
  };

  const {
    data: vendorsData,
    isLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: ["vendors", queryParams],
    queryFn: async () => {
      const res = await apiClient.get(ENDPOINTS.VENDORS, {
        params: queryParams,
      });
      return res.data;
    },
    placeholderData: (previousData) => previousData,
  });

  const vendors = Array.isArray(vendorsData)
    ? vendorsData
    : vendorsData?.data || [];
  const totalVendors = Array.isArray(vendorsData)
    ? vendorsData.length
    : vendorsData?.total || 0;
  const totalPages = Array.isArray(vendorsData)
    ? Math.ceil(vendorsData.length / pageSize) || 1
    : vendorsData?.pages || 1;

  const saveMutation = useMutation({
    mutationFn: async (vendorData) => {
      if (editingVendor) {
        return apiClient.put(
          ENDPOINTS.VENDOR_BY_ID(editingVendor._id),
          vendorData,
        );
      }
      return apiClient.post(ENDPOINTS.VENDORS, vendorData);
    },
    onSuccess: () => {
      toast.success(
        editingVendor
          ? "Vendor updated successfully"
          : "Vendor created successfully",
      );
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    },
    onError: (err) => {
      console.error("Error saving vendor:", err);
      toast.error(err.response?.data?.message || "Error saving vendor");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await apiClient.delete(ENDPOINTS.VENDOR_BY_ID(id));
    },
    onSuccess: () => {
      toast.success("Vendor deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["vendors"] });
    },
    onError: (err) => {
      console.error("Error deleting vendor:", err);
      toast.error(err.response?.data?.message || "Error deleting vendor");
    },
  });

  const handleAdd = () => {
    setEditingVendor(null);
    setShowForm(true);
  };

  const handleEdit = (vendor) => {
    setEditingVendor(vendor);
    setShowForm(true);
  };

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this vendor?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleSave = (vendorData) => {
    saveMutation.mutate(vendorData);
  };

  if (isLoading) return <div className="text-white">Loading vendors...</div>;

  if (error && !vendorsData) {
    return (
      <div className="p-6 bg-red-900/20 border border-red-800 text-red-400 rounded-lg">
        <p className="font-semibold">Failed to load vendors</p>
        <p className="text-sm mt-1">
          {error.response?.data?.message || error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Vendors</h1>
          {isFetching && !isLoading && (
            <span className="text-xs text-blue-400 bg-blue-950/60 border border-blue-800/60 px-2 py-0.5 rounded animate-pulse">
              Refreshing...
            </span>
          )}
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
        >
          <Plus className="mr-2 h-5 w-5" />
          Add Vendor
        </button>
      </div>

      {/* Search */}
      <div className="bg-slate-900 p-4 rounded-lg shadow border border-slate-800 flex items-center">
        <Search className="text-slate-400 mr-2" />
        <input
          type="text"
          placeholder="Search vendors by name or email..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 outline-none bg-transparent text-white placeholder-slate-500"
        />
      </div>

      {/* Vendors Table */}
      <div className="bg-slate-900 shadow rounded-lg overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-950">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Contact Person
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-slate-900 divide-y divide-slate-800">
              {vendors.map((vendor) => (
                <tr key={vendor._id} className="hover:bg-slate-800/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-white">
                      {vendor.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-400">
                      {vendor.contactPerson || "-"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-400">
                      {vendor.email || "-"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-400">
                      {vendor.phone || "-"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => setViewingVendorId(vendor._id)}
                      className="text-green-400 hover:text-green-300 mr-4"
                      title="View details"
                    >
                      <Eye size={18} />
                    </button>
                    <button
                      onClick={() => handleEdit(vendor)}
                      className="text-blue-400 hover:text-blue-300 mr-4"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(vendor._id)}
                      disabled={deleteMutation.isPending}
                      className="text-red-400 hover:text-red-300 disabled:opacity-50"
                    >
                      <Trash size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {vendors.length === 0 && !isLoading && (
          <div className="p-6 text-center text-slate-500">
            No vendors found. Try adjusting your search or add a new vendor.
          </div>
        )}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={totalVendors}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
          itemName="vendors"
        />
      </div>

      {showForm && (
        <VendorForm
          vendor={editingVendor}
          onClose={() => setShowForm(false)}
          onSave={handleSave}
        />
      )}

      {viewingVendorId && (
        <VendorDetailModal
          vendorId={viewingVendorId}
          onClose={() => setViewingVendorId(null)}
        />
      )}
    </div>
  );
};

export default Vendors;
