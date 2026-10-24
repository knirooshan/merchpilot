import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../api/apiClient";
import { ENDPOINTS } from "../config/api";
import { Plus, Edit, Trash2, Eye } from "lucide-react";
import toast from "react-hot-toast";
import CustomerForm from "../components/CustomerForm";
import CustomerDetailModal from "../components/CustomerDetailModal";
import SearchBar from "../components/SearchBar";
import Pagination from "../components/Pagination";
import { useDebounce } from "../utils/useDebounce";

const Customers = () => {
  const { user } = useSelector((state) => state.auth);
  const queryClient = useQueryClient();

  const [showModal, setShowModal] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [viewingCustomerId, setViewingCustomerId] = useState(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const queryParams = {
    page,
    limit: pageSize,
    ...(debouncedSearch?.trim() ? { search: debouncedSearch.trim() } : {}),
  };

  const {
    data: customersData,
    isLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: ["customers", queryParams],
    queryFn: async () => {
      const res = await apiClient.get(ENDPOINTS.CUSTOMERS, {
        params: queryParams,
      });
      return res.data;
    },
    placeholderData: (previousData) => previousData,
  });

  const customers = Array.isArray(customersData)
    ? customersData
    : customersData?.data || [];
  const totalCustomers = Array.isArray(customersData)
    ? customersData.length
    : customersData?.total || 0;
  const totalPages = Array.isArray(customersData)
    ? Math.ceil(customersData.length / pageSize) || 1
    : customersData?.pages || 1;

  const saveMutation = useMutation({
    mutationFn: async (formData) => {
      if (editingCustomer) {
        return apiClient.put(
          ENDPOINTS.CUSTOMER_BY_ID(editingCustomer._id),
          formData,
        );
      }
      return apiClient.post(ENDPOINTS.CUSTOMERS, formData);
    },
    onSuccess: () => {
      toast.success(
        editingCustomer
          ? "Customer updated successfully"
          : "Customer created successfully",
      );
      closeModal();
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (err) => {
      console.error("Error saving customer:", err);
      toast.error(err.response?.data?.message || "Error saving customer");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await apiClient.delete(ENDPOINTS.CUSTOMER_BY_ID(id));
    },
    onSuccess: () => {
      toast.success("Customer deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
    onError: (err) => {
      console.error("Error deleting customer:", err);
      toast.error(err.response?.data?.message || "Error deleting customer");
    },
  });

  const openModal = (customer = null) => {
    setEditingCustomer(customer);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCustomer(null);
  };

  const handleSaveCustomer = (formData) => {
    saveMutation.mutate(formData);
  };

  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this customer?")) {
      deleteMutation.mutate(id);
    }
  };

  if (isLoading) return <div className="text-white">Loading customers...</div>;

  if (error && !customersData) {
    return (
      <div className="p-6 bg-red-900/20 border border-red-800 text-red-400 rounded-lg">
        <p className="font-semibold">Failed to load customers</p>
        <p className="text-sm mt-1">
          {error.response?.data?.message || error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Customers</h1>
          {isFetching && !isLoading && (
            <span className="text-xs text-blue-400 bg-blue-950/60 border border-blue-800/60 px-2 py-0.5 rounded animate-pulse">
              Refreshing...
            </span>
          )}
        </div>
        <button
          onClick={() => openModal()}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          <Plus className="mr-2 h-5 w-5" />
          Add Customer
        </button>
      </div>

      {/* Search */}
      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Search customers by name, email, or phone..."
      />

      <div className="bg-slate-900 shadow rounded-lg overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-950">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Company
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Phone
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-slate-900 divide-y divide-slate-800">
              {customers.map((customer) => (
                <tr key={customer._id} className="hover:bg-slate-800/50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-white">
                    {customer.firstName || customer.lastName
                      ? `${customer.firstName || ""} ${customer.lastName || ""
                        }`.trim()
                      : customer.billing?.company || "Unnamed"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                    {customer.billing?.company || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                    {customer.email || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                    {customer.billing?.phone || "-"}
                  </td>
                  <td className="px-6 py-4 text-slate-400">
                    {[
                      customer.billing?.address_1,
                      customer.billing?.city,
                      customer.billing?.postcode,
                    ]
                      .filter(Boolean)
                      .join(", ") || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => setViewingCustomerId(customer._id)}
                      className="text-green-400 hover:text-green-300 mr-3"
                      title="View details"
                    >
                      <Eye className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => openModal(customer)}
                      className="text-blue-400 hover:text-blue-300 mr-3"
                    >
                      <Edit className="h-5 w-5" />
                    </button>
                    {user?.role === "admin" && (
                      <button
                        onClick={() => handleDelete(customer._id)}
                        disabled={deleteMutation.isPending}
                        className="text-red-400 hover:text-red-300 disabled:opacity-50"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {customers.length === 0 && !isLoading && (
          <div className="p-6 text-center text-slate-500">
            No customers found. Try adjusting your search or add a new customer.
          </div>
        )}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={totalCustomers}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
          itemName="customers"
        />
      </div>

      {/* Modal */}
      {showModal && (
        <CustomerForm
          customer={editingCustomer}
          onClose={closeModal}
          onSave={handleSaveCustomer}
        />
      )}

      {/* Customer Detail Modal */}
      {viewingCustomerId && (
        <CustomerDetailModal
          customerId={viewingCustomerId}
          onClose={() => setViewingCustomerId(null)}
        />
      )}
    </div>
  );
};

export default Customers;
