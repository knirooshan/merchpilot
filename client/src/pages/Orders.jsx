import { useState, useEffect } from "react";
import { useSelector } from "react-redux";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../api/apiClient";
import toast from "react-hot-toast";
import { ENDPOINTS } from "../config/api";
import { Eye, ExternalLink, RefreshCcw } from "lucide-react";
import { formatCurrency } from "../utils/currency";
import { formatDate } from "../utils/date";
import SearchBar from "../components/SearchBar";
import FilterBar from "../components/FilterBar";
import Pagination from "../components/Pagination";
import { useDebounce } from "../utils/useDebounce";

const Orders = () => {
  const { data: settings } = useSelector((state) => state.settings);
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [filters, setFilters] = useState({
    status: "all",
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters]);

  const queryParams = {
    page,
    limit: pageSize,
    ...(debouncedSearch?.trim() ? { search: debouncedSearch.trim() } : {}),
    ...(filters.status !== "all" ? { status: filters.status } : {}),
    ...(filters.startDate ? { startDate: filters.startDate } : {}),
    ...(filters.endDate ? { endDate: filters.endDate } : {}),
  };

  const {
    data: ordersData,
    isLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: ["orders", queryParams],
    queryFn: async () => {
      const res = await apiClient.get(ENDPOINTS.ORDERS, {
        params: queryParams,
      });
      return res.data;
    },
    placeholderData: (previousData) => previousData,
  });

  const orders = Array.isArray(ordersData)
    ? ordersData
    : ordersData?.data || [];
  const totalOrders = Array.isArray(ordersData)
    ? ordersData.length
    : ordersData?.total || 0;
  const totalPages = Array.isArray(ordersData)
    ? Math.ceil(ordersData.length / pageSize) || 1
    : ordersData?.pages || 1;

  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(ENDPOINTS.ORDERS_SYNC, {});
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Successfully synced ${data.orders?.length || 0} orders!`);
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
    onError: (err) => {
      console.error("Error syncing orders:", err);
      toast.error(
        err.response?.data?.message ||
        "Failed to sync orders. Please check your WooCommerce settings.",
      );
    },
  });

  const refundMutation = useMutation({
    mutationFn: async ({ orderId }) => {
      await apiClient.put(`${ENDPOINTS.ORDERS}/${orderId}/refund`, {});
    },
    onSuccess: () => {
      toast.success("Order refunded successfully");
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: (err) => {
      console.error("Error refunding order:", err);
      toast.error(err.response?.data?.message || "Failed to refund order");
    },
  });

  const resetFilters = () => {
    setSearch("");
    setFilters({
      status: "all",
      startDate: "",
      endDate: "",
    });
  };

  const hasActiveFilters = () => {
    return (
      search || filters.status !== "all" || filters.startDate || filters.endDate
    );
  };

  const handleSync = () => {
    if (
      window.confirm("Sync orders from WooCommerce? This may take a moment.")
    ) {
      syncMutation.mutate();
    }
  };

  const handleRefund = (orderId, orderNumber) => {
    if (
      window.confirm(
        `Are you sure you want to refund order ${orderNumber}?\n\nThis will:\n- Mark the order as 'Refunded'\n- Mark associated invoice as 'Refunded'\n- Mark all payment records as 'Refunded'\n\nThis action cannot be undone.`,
      )
    ) {
      refundMutation.mutate({ orderId, orderNumber });
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "completed":
      case "paid":
        return "bg-green-900/50 text-green-400 border border-green-800";
      case "processing":
        return "bg-blue-900/50 text-blue-400 border border-blue-800";
      case "pending":
      case "on-hold":
        return "bg-yellow-900/50 text-yellow-400 border border-yellow-800";
      case "cancelled":
      case "refunded":
      case "failed":
      case "overdue":
        return "bg-red-900/50 text-red-400 border border-red-800";
      default:
        return "bg-slate-800 text-slate-400 border border-slate-700";
    }
  };

  if (isLoading) return <div className="text-white">Loading orders...</div>;

  if (error && !ordersData) {
    return (
      <div className="p-6 bg-red-900/20 border border-red-800 text-red-400 rounded-lg">
        <p className="font-semibold">Failed to load orders</p>
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
          <h1 className="text-2xl font-bold text-white">Orders</h1>
          {isFetching && !isLoading && (
            <span className="text-xs text-blue-400 bg-blue-950/60 border border-blue-800/60 px-2 py-0.5 rounded animate-pulse">
              Refreshing...
            </span>
          )}
        </div>
        <div className="flex gap-3 items-center">
          <div className="text-sm text-slate-400">
            {orders.length} total orders
          </div>
          {!(settings?.modules?.woocommerce === false) && (
            <button
              onClick={handleSync}
              disabled={syncMutation.isPending}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {syncMutation.isPending ? "Syncing..." : "Sync from WooCommerce"}
            </button>
          )}
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search orders..."
        />

        <FilterBar showReset={hasActiveFilters()} onReset={resetFilters}>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">Status:</label>
            <select
              value={filters.status}
              onChange={(e) =>
                setFilters({ ...filters, status: e.target.value })
              }
              className="bg-slate-950 border border-slate-700 text-white rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="processing">Processing</option>
              <option value="pending">Pending</option>
              <option value="on-hold">On Hold</option>
              <option value="cancelled">Cancelled</option>
              <option value="refunded">Refunded</option>
              <option value="failed">Failed</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">From:</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) =>
                setFilters({ ...filters, startDate: e.target.value })
              }
              className="bg-slate-950 border border-slate-700 text-white rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">To:</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) =>
                setFilters({ ...filters, endDate: e.target.value })
              }
              className="bg-slate-950 border border-slate-700 text-white rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>
        </FilterBar>
      </div>

      <div className="bg-slate-900 shadow rounded-lg overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-950">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Order #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-slate-900 divide-y divide-slate-800">
              {orders.map((order) => (
                <tr key={order._id} className="hover:bg-slate-800/50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-blue-400">
                    {order.orderNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-white">
                      {order.customerInfo?.firstName ||
                        order.customerInfo?.lastName ||
                        order.customer?.firstName ||
                        order.customer?.lastName
                        ? `${order.customerInfo?.firstName ||
                          order.customer?.firstName ||
                          ""
                          } ${order.customerInfo?.lastName ||
                          order.customer?.lastName ||
                          ""
                          }`.trim()
                        : order.customer?.billing?.company || "N/A"}
                    </div>
                    <div className="text-sm text-slate-400">
                      {order.customerInfo?.email || order.customer?.email}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                    {formatDate(order.dateCreated || order.createdAt, settings)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-white">
                    {formatCurrency(order.total, settings)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                        order.status
                      )}`}
                    >
                      {order.status.charAt(0).toUpperCase() +
                        order.status.slice(1).replace("-", " ")}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end gap-3">
                      {order.invoice ? (
                        <a
                          href={`/invoices/${order.invoice}`}
                          className="text-blue-400 hover:text-blue-300 inline-flex items-center"
                        >
                          <Eye className="h-5 w-5 mr-1" />
                          View Invoice
                        </a>
                      ) : (
                        <span className="text-slate-500 text-xs">
                          No invoice
                        </span>
                      )}
                      <button
                        onClick={() =>
                          handleRefund(order._id, order.orderNumber)
                        }
                        disabled={refundMutation.isPending}
                        className="text-orange-400 hover:text-orange-300 disabled:opacity-50"
                        title="Refund order"
                      >
                        <RefreshCcw className="h-5 w-5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {orders.length === 0 && !isLoading && (
          <div className="p-6 text-center text-slate-500">
            No orders found. Try adjusting your search or filters.
          </div>
        )}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={totalOrders}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
          itemName="orders"
        />
      </div>

      {!(
        settings &&
        settings.modules &&
        settings.modules.woocommerce === false
      ) && (
          <div className="bg-blue-900/20 border border-blue-800 rounded-lg p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <ExternalLink className="h-5 w-5 text-blue-400" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-blue-400">
                  WooCommerce Orders
                </h3>
                <div className="mt-2 text-sm text-slate-400">
                  <p>
                    This page displays orders synced from your WooCommerce store.
                    Click "Sync from WooCommerce" to fetch the latest orders. Make
                    sure your WooCommerce credentials are configured in the server
                    settings.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
    </div>
  );
};

export default Orders;
