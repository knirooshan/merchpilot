import { useState, useEffect } from "react";
import axios from "axios";
import { useSelector } from "react-redux";
import { formatCurrency } from "../utils/currency";
import { formatDate } from "../utils/date";
import { Edit, Trash2, Plus } from "lucide-react";
import PaymentModal from "../components/PaymentModal";
import ReasonModal from "../components/ReasonModal";
import SearchBar from "../components/SearchBar";
import FilterBar from "../components/FilterBar";
import Pagination from "../components/Pagination";
import { useDebounce } from "../utils/useDebounce";
import { ENDPOINTS } from "../config/api";

const Payments = () => {
  const { user } = useSelector((state) => state.auth);
  const { data: settings } = useSelector((state) => state.settings);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [pages, setPages] = useState(1);
  const [totalPayments, setTotalPayments] = useState(0);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [pendingPaymentData, setPendingPaymentData] = useState(null);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [filters, setFilters] = useState({
    method: "all",
    source: "all",
    startDate: "",
    endDate: "",
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const token = user.token;
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
      });
      if (debouncedSearch && debouncedSearch.trim()) {
        params.append("search", debouncedSearch.trim());
      }
      if (filters.method !== "all") params.append("method", filters.method);
      if (filters.source !== "all") params.append("source", filters.source);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);

      const paymentsRes = await axios.get(
        `${ENDPOINTS.PAYMENTS}?${params.toString()}`,
        config
      );

      const data = paymentsRes.data;
      if (Array.isArray(data)) {
        setPayments(data);
        setTotalPayments(data.length);
        setPages(Math.ceil(data.length / pageSize) || 1);
      } else {
        setPayments(data.data || []);
        setTotalPayments(data.total || 0);
        setPages(data.pages || 1);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters]);

  useEffect(() => {
    fetchData();
  }, [page, pageSize, debouncedSearch, filters]);

  const resetFilters = () => {
    setSearch("");
    setFilters({
      method: "all",
      source: "all",
      startDate: "",
      endDate: "",
    });
  };

  const hasActiveFilters = () => {
    return (
      search ||
      filters.method !== "all" ||
      filters.source !== "all" ||
      filters.startDate ||
      filters.endDate
    );
  };

  const handleDelete = async (id) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this payment? This will revert the invoice balance."
      )
    )
      return;
    try {
      const token = user.token;
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(ENDPOINTS.PAYMENT_BY_ID(id), config);
      fetchData();
    } catch (error) {
      console.error("Error deleting payment:", error);
      alert("Failed to delete payment");
    }
  };

  const handleEdit = (payment) => {
    setSelectedPayment(payment);
    setSelectedInvoice({
      _id: payment.invoice?._id,
      customer: payment.customer,
    });
    setIsPaymentModalOpen(true);
  };

  const handleCreate = () => {
    setSelectedPayment(null);
    setSelectedInvoice({
      _id: null,
      customer: null,
    });
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSave = async (paymentData) => {
    if (selectedPayment) {
      // For edits, show reason modal
      setPendingPaymentData(paymentData);
      setShowReasonModal(true);
    } else {
      // For new payments, save directly
      try {
        const token = user.token;
        const config = { headers: { Authorization: `Bearer ${token}` } };
        await axios.post(ENDPOINTS.PAYMENTS, paymentData, config);
        setIsPaymentModalOpen(false);
        setSelectedPayment(null);
        setSelectedInvoice(null);
        fetchData();
      } catch (error) {
        console.error("Error saving payment:", error);
        alert("Failed to save payment");
      }
    }
  };

  const handleConfirmEdit = async (reason) => {
    try {
      const token = user.token;
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.put(
        ENDPOINTS.PAYMENT_BY_ID(selectedPayment._id),
        {
          ...pendingPaymentData,
          editReason: reason,
          editedBy: user.name,
        },
        config
      );
      setIsPaymentModalOpen(false);
      setShowReasonModal(false);
      setSelectedPayment(null);
      setSelectedInvoice(null);
      setPendingPaymentData(null);
      fetchData();
    } catch (error) {
      console.error("Error updating payment:", error);
      alert("Failed to update payment");
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "active":
        return "bg-green-900/50 text-green-400 border border-green-800";
      case "refunded":
        return "bg-yellow-900/50 text-yellow-400 border border-yellow-800";
      case "deleted":
        return "bg-red-900/50 text-red-400 border border-red-800";
      default:
        return "bg-slate-800 text-slate-400 border border-slate-700";
    }
  };

  if (loading) return <div className="text-white">Loading payments...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Payments</h1>
        <button
          onClick={handleCreate}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          <Plus className="mr-2 h-5 w-5" />
          Create Payment
        </button>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search payments..."
        />

        <FilterBar showReset={hasActiveFilters()} onReset={resetFilters}>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">Method:</label>
            <select
              value={filters.method}
              onChange={(e) =>
                setFilters({ ...filters, method: e.target.value })
              }
              className="bg-slate-950 border border-slate-700 text-white rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="all">All Methods</option>
              <option value="Cash">Cash</option>
              <option value="Card">Card</option>
              <option value="Bank Transfer">Bank Transfer</option>
              <option value="Cheque">Cheque</option>
              <option value="Check">Check</option>
              <option value="Other">Other</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">Source:</label>
            <select
              value={filters.source}
              onChange={(e) =>
                setFilters({ ...filters, source: e.target.value })
              }
              className="bg-slate-950 border border-slate-700 text-white rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="all">All Sources</option>
              <option value="Manual">Manual</option>
              <option value="WooCommerce">WooCommerce</option>
              <option value="POS">POS</option>
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
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Method
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-slate-900 divide-y divide-slate-800">
              {payments.map((payment) => (
                <tr key={payment._id} className="hover:bg-slate-800/50">
                  <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                    {formatDate(payment.date, settings)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-blue-400">
                    {payment.invoice?.invoiceNumber || "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-white">
                    {payment.customer?.firstName || payment.customer?.lastName
                      ? `${payment.customer.firstName || ""} ${payment.customer.lastName || ""
                        }`.trim()
                      : payment.customer?.billing?.company || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                    {payment.method}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-300">
                    {payment.source}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-white">
                    {formatCurrency(payment.amount, settings)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                        payment.status
                      )}`}
                    >
                      {payment.status.charAt(0).toUpperCase() +
                        payment.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-2">
                    <button
                      onClick={() => handleEdit(payment)}
                      className="text-blue-400 hover:text-blue-300"
                    >
                      <Edit className="h-5 w-5" />
                    </button>
                    {user?.role === "admin" && (
                      <button
                        onClick={() => handleDelete(payment._id)}
                        className="text-red-400 hover:text-red-300"
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
        {payments.length === 0 && !loading && (
          <div className="p-6 text-center text-slate-500">
            No payments found. Try adjusting your search or filters.
          </div>
        )}
        <Pagination
          currentPage={page}
          totalPages={pages}
          totalItems={totalPayments}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
          itemName="payments"
        />
      </div>

      {/* Reuse PaymentModal for editing, but we might need to tweak it to pre-fill data */}
      {/* Since PaymentModal is simple, let's just use it. We need to pass initial values though. */}
      {/* The current PaymentModal doesn't accept initial values for editing. We need to update it. */}
      {/* Let's update PaymentModal first to accept initialData */}

      {selectedInvoice && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setSelectedPayment(null);
            setSelectedInvoice(null);
          }}
          onSave={handlePaymentSave}
          invoice={selectedInvoice}
          totalDue={1000000} // Allow editing to any amount for now
          initialData={selectedPayment}
        />
      )}

      <ReasonModal
        isOpen={showReasonModal}
        onClose={() => {
          setShowReasonModal(false);
          setPendingPaymentData(null);
        }}
        onConfirm={handleConfirmEdit}
        title="Edit Payment Reason"
        message="Please provide a reason for editing this payment."
      />
    </div>
  );
};

export default Payments;
