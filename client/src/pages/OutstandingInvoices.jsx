import { useState, useEffect } from "react";
import axios from "axios";
import { ENDPOINTS } from "../config/api";
import {
  AlertTriangle,
  Clock,
  DollarSign,
  Download,
  RefreshCw,
  Users,
  TrendingDown,
  ChevronDown,
  ChevronUp,
  FileText,
} from "lucide-react";
import { useSelector } from "react-redux";
import { formatCurrency } from "../utils/currency";
import { formatDate } from "../utils/date";
import StatsCard from "../components/StatsCard";
import SearchBar from "../components/SearchBar";
import FilterBar from "../components/FilterBar";
import Pagination from "../components/Pagination";
import useDebounce from "../utils/useDebounce";

const statusStyles = {
  overdue: "bg-red-900/50 text-red-400 border border-red-800",
  partially_paid: "bg-amber-900/50 text-amber-400 border border-amber-800",
  sent: "bg-blue-900/50 text-blue-400 border border-blue-800",
  draft: "bg-slate-800 text-slate-400 border border-slate-700",
};

const statusLabels = {
  overdue: "Overdue",
  partially_paid: "Partial",
  sent: "Sent",
  draft: "Draft",
};

const StatusBadge = ({ status }) => (
  <span
    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${statusStyles[status] || "bg-slate-800 text-slate-400 border border-slate-700"}`}
  >
    {statusLabels[status] || status}
  </span>
);

const DaysOverdueBadge = ({ days }) => {
  if (!days || days <= 0)
    return <span className="text-slate-500 text-xs">—</span>;
  const cls =
    days > 60
      ? "bg-red-900/50 text-red-300"
      : days > 30
        ? "bg-orange-900/50 text-orange-300"
        : "bg-amber-900/50 text-amber-300";
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${cls}`}
    >
      <Clock size={11} />
      {days}d
    </span>
  );
};

const OutstandingInvoices = () => {
  const { user } = useSelector((state) => state.auth);
  const { data: settings } = useSelector((state) => state.settings);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState("invoices"); // "invoices" | "customers"
  const [expandedCustomers, setExpandedCustomers] = useState({});
  const [filters, setFilters] = useState({
    customer: "",
    startDate: "",
    endDate: "",
    status: "",
  });
  const [customerSearch, setCustomerSearch] = useState("");
  const [invoiceSearch, setInvoiceSearch] = useState("");
  const debouncedInvoiceSearch = useDebounce(invoiceSearch, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalInvoices, setTotalInvoices] = useState(0);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    setPage(1);
  }, [debouncedInvoiceSearch, filters]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const config = {
        headers: { Authorization: `Bearer ${user.token}` },
        params: {
          page,
          limit: pageSize,
        },
      };
      if (debouncedInvoiceSearch) config.params.search = debouncedInvoiceSearch;
      if (filters.startDate) config.params.startDate = filters.startDate;
      if (filters.endDate) config.params.endDate = filters.endDate;
      if (filters.status) config.params.status = filters.status;
      if (filters.customer) config.params.customer = filters.customer;

      const res = await axios.get(ENDPOINTS.REPORTS_OUTSTANDING, config);
      setData(res.data);
      setTotalInvoices(res.data.total ?? res.data.totalInvoices ?? (res.data.invoices?.length || 0));
      setTotalPages(res.data.pages ?? 1);
    } catch (err) {
      console.error("Error fetching outstanding invoices:", err);
      setError("Failed to load outstanding invoices.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters, page, pageSize, debouncedInvoiceSearch]);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
  };

  const clearFilters = () => {
    setFilters({ customer: "", startDate: "", endDate: "", status: "" });
    setCustomerSearch("");
    setInvoiceSearch("");
  };

  const hasActiveFilters = () => {
    return filters.startDate || filters.endDate || filters.status;
  };

  const handleDownloadPDF = async () => {
    try {
      setDownloading(true);
      const config = {
        headers: { Authorization: `Bearer ${user.token}` },
        responseType: "blob",
      };
      const params = {};
      if (filters.startDate) params.startDate = filters.startDate;
      if (filters.endDate) params.endDate = filters.endDate;
      if (filters.status) params.status = filters.status;

      const response = await axios.post(
        ENDPOINTS.PDF_OUTSTANDING_REPORT,
        params,
        config,
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", "Outstanding_Invoices_Report.pdf");
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error("Error downloading outstanding report PDF:", err);
      alert("Failed to download outstanding report PDF");
    } finally {
      setDownloading(false);
    }
  };

  const toggleCustomer = (id) => {
    setExpandedCustomers((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const invoices = data?.invoices || [];
  const customerSummary = data?.customerSummary || [];
  const summary = data?.summary || {};

  // Local customer-search filter (client-side)
  const filteredCustomerSummary = customerSearch
    ? customerSummary.filter(
      (c) =>
        c.customerName.toLowerCase().includes(customerSearch.toLowerCase()) ||
        c.email?.toLowerCase().includes(customerSearch.toLowerCase()),
    )
    : customerSummary;

  // Group invoices by customer ID for expanding
  const invoicesByCustomer = {};
  for (const inv of invoices) {
    const id = inv.customer?._id || "unknown";
    if (!invoicesByCustomer[id]) invoicesByCustomer[id] = [];
    invoicesByCustomer[id].push(inv);
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Outstanding Invoices</h1>
        <div className="flex items-center gap-3">
          <button
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="flex items-center px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-700 border border-slate-700 transition-colors disabled:opacity-50"
            id="outstanding-download-pdf-btn"
          >
            <Download className="mr-2 h-5 w-5" />
            {downloading ? "Generating..." : "Download PDF"}
          </button>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors disabled:opacity-50"
            id="outstanding-refresh-btn"
          >
            <RefreshCw
              className={`mr-2 h-5 w-5 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 flex items-center justify-between">
          <span className="text-red-400 text-sm">{error}</span>
          <button
            onClick={fetchData}
            className="text-xs text-red-400 hover:text-red-300 underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title="Total Outstanding"
          value={formatCurrency(summary.totalOutstanding || 0, settings)}
          icon={DollarSign}
          color="text-red-500 bg-red-500"
        />
        <StatsCard
          title="Overdue Invoices"
          value={summary.overdueCount || 0}
          icon={AlertTriangle}
          color="text-orange-500 bg-orange-500"
        />
        <StatsCard
          title="Partially Paid"
          value={summary.partiallyPaidCount || 0}
          icon={TrendingDown}
          color="text-amber-500 bg-amber-500"
        />
        <StatsCard
          title="Customers Owing"
          value={summary.customersWithDebt || 0}
          icon={Users}
          color="text-blue-500 bg-blue-500"
        />
      </div>

      {/* Filters */}
      <FilterBar showReset={hasActiveFilters()} onReset={clearFilters}>
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-400">Status:</label>
          <select
            name="status"
            value={filters.status}
            onChange={handleFilterChange}
            id="outstanding-status-filter"
            className="bg-slate-950 border border-slate-700 text-white rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="">All Statuses</option>
            <option value="overdue">Overdue</option>
            <option value="partially_paid">Partially Paid</option>
            <option value="sent">Sent</option>
            <option value="draft">Draft</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-400">From:</label>
          <input
            type="date"
            name="startDate"
            value={filters.startDate}
            onChange={handleFilterChange}
            id="outstanding-start-date"
            className="bg-slate-950 border border-slate-700 text-white rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-400">To:</label>
          <input
            type="date"
            name="endDate"
            value={filters.endDate}
            onChange={handleFilterChange}
            id="outstanding-end-date"
            className="bg-slate-950 border border-slate-700 text-white rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
      </FilterBar>

      {/* View mode toggle */}
      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-1 w-fit">
        <button
          onClick={() => setViewMode("invoices")}
          id="outstanding-view-invoices-btn"
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === "invoices"
              ? "bg-blue-600 text-white"
              : "text-slate-400 hover:text-white"
            }`}
        >
          <FileText size={15} />
          Invoice View
        </button>
        <button
          onClick={() => setViewMode("customers")}
          id="outstanding-view-customers-btn"
          className={`flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === "customers"
              ? "bg-blue-600 text-white"
              : "text-slate-400 hover:text-white"
            }`}
        >
          <Users size={15} />
          Customer View
        </button>
      </div>

      {/* ====== INVOICE VIEW ====== */}
      {viewMode === "invoices" && (
        <div className="bg-slate-900 shadow rounded-lg overflow-hidden border border-slate-800">
          <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-950">
            <div className="flex-1 max-w-md">
              <SearchBar
                value={invoiceSearch}
                onChange={setInvoiceSearch}
                placeholder="Search by invoice #, tax #, customer..."
              />
            </div>
            {totalInvoices > 0 && (
              <span className="text-xs text-slate-400 bg-slate-900 px-2.5 py-1.5 rounded-md border border-slate-700 self-start sm:self-auto">
                {totalInvoices} {totalInvoices === 1 ? "invoice" : "invoices"}
              </span>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-800">
              <thead className="bg-slate-950">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Invoice #
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Invoice Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Due Date
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Paid
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Balance Due
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Overdue By
                  </th>
                </tr>
              </thead>
              <tbody className="bg-slate-900 divide-y divide-slate-800">
                {invoices.map((inv) => (
                  <tr key={inv._id} className="hover:bg-slate-800/50">
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-blue-400">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-white">
                      {inv.customer
                        ? `${inv.customer.firstName || ""} ${inv.customer.lastName || ""}`.trim() ||
                        inv.customerInfo?.company ||
                        "Unknown"
                        : inv.customerInfo?.firstName
                          ? `${inv.customerInfo.firstName} ${inv.customerInfo.lastName || ""}`.trim()
                          : "Unknown"}
                      {(inv.customer?.email || inv.customerInfo?.email) && (
                        <div className="text-slate-500 text-xs">
                          {inv.customer?.email || inv.customerInfo?.email}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                      {formatDate(inv.invoiceDate, settings) || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                      {formatDate(inv.dueDate, settings) || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-white">
                      {formatCurrency(inv.total, settings)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-medium text-green-400">
                      {formatCurrency(inv.amountPaid, settings)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right font-bold text-red-400">
                      {formatCurrency(inv.balanceDue, settings)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <DaysOverdueBadge days={inv.daysOverdue} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {invoices.length === 0 && (
            <div className="p-6 text-center text-slate-500">
              {loading
                ? "Loading outstanding invoices..."
                : "No outstanding invoices found matching your criteria."}
            </div>
          )}

          {invoices.length > 0 && (
            <div className="border-t border-slate-800 bg-slate-950/50 px-6 py-3 flex flex-wrap items-center justify-end gap-6 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Total Invoiced:</span>
                <span className="font-semibold text-white">
                  {formatCurrency(
                    invoices.reduce((s, i) => s + i.total, 0),
                    settings,
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Total Collected:</span>
                <span className="font-semibold text-green-400">
                  {formatCurrency(
                    invoices.reduce((s, i) => s + i.amountPaid, 0),
                    settings,
                  )}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-slate-400 font-medium">
                  Total Outstanding:
                </span>
                <span className="font-bold text-red-400 text-base">
                  {formatCurrency(summary.totalOutstanding, settings)}
                </span>
              </div>
            </div>
          )}

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={totalInvoices}
            pageSize={pageSize}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
          />
        </div>
      )}

      {/* ====== CUSTOMER VIEW ====== */}
      {viewMode === "customers" && (
        <div className="bg-slate-900 shadow rounded-lg overflow-hidden border border-slate-800">
          <div className="p-4 border-b border-slate-800">
            <SearchBar
              value={customerSearch}
              onChange={setCustomerSearch}
              placeholder="Search customers..."
            />
          </div>

          {filteredCustomerSummary.length === 0 ? (
            <div className="p-6 text-center text-slate-500">
              {loading
                ? "Loading customer balances..."
                : customerSearch
                  ? "No customers match your search."
                  : "No outstanding balances found."}
            </div>
          ) : (
            <div className="divide-y divide-slate-800">
              {filteredCustomerSummary.map((cust) => {
                const custInvoices = invoicesByCustomer[cust.customerId] || [];
                const isExpanded = expandedCustomers[cust.customerId];
                const pct = summary.totalOutstanding
                  ? Math.min(
                    (cust.totalOutstanding / summary.totalOutstanding) * 100,
                    100,
                  )
                  : 0;

                return (
                  <div key={cust.customerId}>
                    {/* Customer row */}
                    <div
                      className="flex items-center gap-4 px-6 py-4 hover:bg-slate-800/50 cursor-pointer transition-colors"
                      onClick={() => toggleCustomer(cust.customerId)}
                      id={`outstanding-customer-${cust.customerId}`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-white text-sm truncate">
                            {cust.customerName}
                          </span>
                          {cust.overdueCount > 0 && (
                            <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-red-900/50 text-red-400 border border-red-800">
                              {cust.overdueCount} overdue
                            </span>
                          )}
                        </div>
                        {cust.email && (
                          <div className="text-slate-500 text-xs truncate mt-0.5">
                            {cust.email}
                          </div>
                        )}
                        {/* Progress bar */}
                        <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden w-full max-w-xs">
                          <div
                            className="h-full bg-red-500/60 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-6 shrink-0">
                        <div className="text-right">
                          <div className="text-xs text-slate-500">Invoices</div>
                          <div className="font-semibold text-slate-200">
                            {cust.invoiceCount}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-slate-500">
                            Balance Due
                          </div>
                          <div className="font-bold text-red-400">
                            {formatCurrency(cust.totalOutstanding, settings)}
                          </div>
                        </div>
                        {isExpanded ? (
                          <ChevronUp size={16} className="text-slate-500" />
                        ) : (
                          <ChevronDown size={16} className="text-slate-500" />
                        )}
                      </div>
                    </div>

                    {/* Expanded invoices */}
                    {isExpanded && custInvoices.length > 0 && (
                      <div className="bg-slate-950/50 border-t border-slate-800 px-6 pb-2">
                        <table className="w-full text-xs mt-2">
                          <thead>
                            <tr className="text-slate-500 uppercase tracking-wider">
                              <th className="text-left py-2 font-medium">
                                Invoice #
                              </th>
                              <th className="text-left py-2 font-medium">
                                Date
                              </th>
                              <th className="text-left py-2 font-medium">
                                Due Date
                              </th>
                              <th className="text-right py-2 font-medium">
                                Total
                              </th>
                              <th className="text-right py-2 font-medium">
                                Paid
                              </th>
                              <th className="text-right py-2 font-medium text-red-400">
                                Balance
                              </th>
                              <th className="text-left py-2 font-medium">
                                Status
                              </th>
                              <th className="text-left py-2 font-medium">
                                Overdue
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/50">
                            {custInvoices.map((inv) => (
                              <tr
                                key={inv._id}
                                className="hover:bg-slate-800/30 transition-colors"
                              >
                                <td className="py-2 font-medium text-blue-400">
                                  {inv.invoiceNumber}
                                </td>
                                <td className="py-2 text-slate-400">
                                  {formatDate(inv.invoiceDate, settings) || "-"}
                                </td>
                                <td className="py-2 text-slate-400">
                                  {formatDate(inv.dueDate, settings) || "-"}
                                </td>
                                <td className="py-2 text-right text-slate-200">
                                  {formatCurrency(inv.total, settings)}
                                </td>
                                <td className="py-2 text-right text-green-400">
                                  {formatCurrency(inv.amountPaid, settings)}
                                </td>
                                <td className="py-2 text-right font-bold text-red-400">
                                  {formatCurrency(inv.balanceDue, settings)}
                                </td>
                                <td className="py-2">
                                  <StatusBadge status={inv.status} />
                                </td>
                                <td className="py-2">
                                  <DaysOverdueBadge days={inv.daysOverdue} />
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {filteredCustomerSummary.length > 0 && (
            <div className="border-t border-slate-800 bg-slate-950/50 px-6 py-3 flex items-center justify-end gap-4 text-sm">
              <span className="text-slate-400">Grand Total Outstanding:</span>
              <span className="font-bold text-red-400 text-base">
                {formatCurrency(summary.totalOutstanding, settings)}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OutstandingInvoices;
