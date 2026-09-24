import { useState, useEffect } from "react";
import axios from "axios";
import { ENDPOINTS } from "../config/api";
import {
  Plus,
  FileText,
  Eye,
  DollarSign,
  Trash2,
  Edit,
  Truck,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { formatCurrency } from "../utils/currency";
import { formatDate } from "../utils/date";
import PaymentModal from "../components/PaymentModal";
import SearchBar from "../components/SearchBar";
import FilterBar from "../components/FilterBar";
import DeliveryUpdateModal from "../components/DeliveryUpdateModal";
import ErrorBoundary from "../ErrorBoundary";

const STATUS_STYLES = {
  draft: "bg-slate-800 text-slate-400 border border-slate-700",
  pending: "bg-blue-900/50 text-blue-400 border border-blue-800",
  sent: "bg-blue-900/50 text-blue-400 border border-blue-800",
  partially_paid: "bg-amber-900/50 text-amber-400 border border-amber-800",
  paid: "bg-green-900/50 text-green-400 border border-green-800",
  overdue: "bg-red-900/50 text-red-400 border border-red-800",
  cancelled: "bg-slate-700/50 text-slate-300 border border-slate-600",
  "written-off": "bg-purple-900/50 text-purple-400 border border-purple-800",
  refunded: "bg-pink-900/50 text-pink-400 border border-pink-800",
  deleted: "bg-slate-800 text-slate-500 border border-slate-700",
};

const Invoices = () => {
  const { user } = useSelector((state) => state.auth);
  const { data: settings } = useSelector((state) => state.settings);
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isDeliveryModalOpen, setIsDeliveryModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [selectedDeliveryInvoiceNo, setSelectedDeliveryInvoiceNo] =
    useState(null);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({
    status: "all",
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    fetchData();
  }, [search, filters]);

  const fetchData = async () => {
    try {
      const token = user.token;
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (filters.status !== "all") params.append("status", filters.status);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);

      const invoicesRes = await axios.get(
        `${ENDPOINTS.INVOICES}?${params.toString()}`,
        config,
      );

      setInvoices(invoicesRes.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching data:", error);
      setLoading(false);
    }
  };

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

  const handleRecordPayment = (invoice) => {
    setSelectedInvoice(invoice);
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSave = async (paymentData) => {
    try {
      const token = user.token;
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.post(ENDPOINTS.PAYMENTS, paymentData, config);
      setIsPaymentModalOpen(false);
      setSelectedInvoice(null);
      fetchData(); // Refresh data to show updated status
    } catch (error) {
      console.error("Error saving payment:", error);
      alert("Failed to save payment");
    }
  };

  const handleDelete = async (invoiceId) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this invoice? This will also delete all associated payment records.",
      )
    ) {
      return;
    }
    try {
      const token = user.token;
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(ENDPOINTS.INVOICE_BY_ID(invoiceId), config);
      fetchData(); // Refresh data
      alert("Invoice deleted successfully");
    } catch (error) {
      console.error("Error deleting invoice:", error);
      alert("Failed to delete invoice");
    }
  };

  if (loading) return <div className="text-white">Loading invoices...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Invoices</h1>
        <Link
          to="/invoices/create"
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          <Plus className="mr-2 h-5 w-5" />
          Create Invoice
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search invoices..."
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
              <option value="draft">Draft</option>
              <option value="pending">Pending</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
              <option value="written-off">Written Off</option>
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
                  Number
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Due Date
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
              {invoices.map((invoice) => (
                <tr key={invoice._id} className="hover:bg-slate-800/50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-blue-400">
                    {invoice.invoiceNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-white">
                    {invoice.customer?.firstName || invoice.customer?.lastName
                      ? `${invoice.customer.firstName || ""} ${
                          invoice.customer.lastName || ""
                        }`.trim()
                      : invoice.customer?.billing?.company ||
                        invoice.customerInfo?.company ||
                        (invoice.customerInfo?.firstName ||
                        invoice.customerInfo?.lastName
                          ? `${invoice.customerInfo.firstName || ""} ${
                              invoice.customerInfo.lastName || ""
                            }`.trim()
                          : "N/A")}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                    {invoice.invoiceDate
                      ? formatDate(invoice.invoiceDate, settings)
                      : formatDate(invoice.createdAt, settings)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                    {invoice.dueDate
                      ? formatDate(invoice.dueDate, settings)
                      : "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-white">
                    {formatCurrency(invoice.total, settings)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        STATUS_STYLES[invoice.status] ||
                        "bg-slate-800 text-slate-400 border border-slate-700"
                      }`}
                    >
                      {invoice.status
                        .replace("_", " ")
                        .charAt(0)
                        .toUpperCase() +
                        invoice.status.replace("_", " ").slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-2">
                    <button
                      onClick={() => navigate(`/invoices/edit/${invoice._id}`)}
                      className="text-yellow-400 hover:text-yellow-300"
                      title="Edit Invoice"
                    >
                      <Edit className="h-5 w-5" />
                    </button>
                    {invoice.status !== "paid" &&
                      invoice.status !== "written-off" && (
                        <button
                          onClick={() => handleRecordPayment(invoice)}
                          className="text-green-400 hover:text-green-300"
                          title="Record Payment"
                        >
                          <DollarSign className="h-5 w-5" />
                        </button>
                      )}
                    {user?.role === "admin" && (
                      <button
                        onClick={() => handleDelete(invoice._id)}
                        className="text-red-400 hover:text-red-300"
                        title="Delete Invoice"
                      >
                        <Trash2 className="h-5 w-5" />
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setSelectedDeliveryInvoiceNo(invoice.invoiceNumber);
                        setIsDeliveryModalOpen(true);
                      }}
                      className="text-purple-400 hover:text-purple-300"
                      title="Update Delivery"
                    >
                      <Truck className="h-5 w-5" />
                    </button>
                    <Link
                      to={`/invoices/${invoice._id}`}
                      className="text-blue-400 hover:text-blue-300"
                      title="View Invoice"
                    >
                      <Eye className="h-5 w-5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {invoices.length === 0 && (
          <div className="p-6 text-center text-slate-500">
            No invoices found. Create one to get started.
          </div>
        )}
      </div>

      {selectedInvoice && (
        <PaymentModal
          isOpen={isPaymentModalOpen}
          onClose={() => {
            setIsPaymentModalOpen(false);
            setSelectedInvoice(null);
          }}
          onSave={handlePaymentSave}
          invoice={selectedInvoice}
          totalDue={
            selectedInvoice.balanceDue !== undefined
              ? selectedInvoice.balanceDue
              : selectedInvoice.total - (selectedInvoice.amountPaid || 0)
          }
        />
      )}

      {isDeliveryModalOpen && (
        <ErrorBoundary>
          <DeliveryUpdateModal
            isOpen={isDeliveryModalOpen}
            onClose={() => {
              setIsDeliveryModalOpen(false);
              setSelectedDeliveryInvoiceNo(null);
            }}
            invoiceNumber={selectedDeliveryInvoiceNo}
          />
        </ErrorBoundary>
      )}
    </div>
  );
};

export default Invoices;
