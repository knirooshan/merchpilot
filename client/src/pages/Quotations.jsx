import { useState, useEffect } from "react";
import axios from "axios";
import { ENDPOINTS } from "../config/api";
import { Plus, FileText, Eye, Edit, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { formatCurrency } from "../utils/currency";
import { formatDate } from "../utils/date";
import SearchBar from "../components/SearchBar";
import FilterBar from "../components/FilterBar";
import Pagination from "../components/Pagination";
import { useDebounce } from "../utils/useDebounce";

const Quotations = () => {
  const { user } = useSelector((state) => state.auth);
  const { data: settings } = useSelector((state) => state.settings);
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalQuotations, setTotalQuotations] = useState(0);
  const [filters, setFilters] = useState({
    status: "all",
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
      if (filters.status !== "all") params.append("status", filters.status);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);

      const quotationsRes = await axios.get(
        `${ENDPOINTS.QUOTATIONS}?${params.toString()}`,
        config
      );

      const data = quotationsRes.data;
      if (Array.isArray(data)) {
        setQuotations(data);
        setTotalQuotations(data.length);
        setTotalPages(Math.ceil(data.length / pageSize) || 1);
      } else {
        setQuotations(data.quotations || data.data || []);
        setTotalQuotations(data.total || 0);
        setTotalPages(data.pages || 1);
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

  const handleConvertToInvoice = (quotation) => {
    navigate("/invoices/create", {
      state: { quotationData: quotation },
    });
  };

  const handleDelete = async (quotationId) => {
    if (!window.confirm("Are you sure you want to delete this quotation?")) {
      return;
    }
    try {
      const token = user.token;
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(ENDPOINTS.QUOTATION_BY_ID(quotationId), config);
      fetchData(); // Refresh data
      alert("Quotation deleted successfully");
    } catch (error) {
      console.error("Error deleting quotation:", error);
      alert("Failed to delete quotation");
    }
  };

  if (loading) return <div className="text-white">Loading quotations...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Quotations</h1>
        <Link
          to="/quotations/create"
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          <Plus className="mr-2 h-5 w-5" />
          Create Quotation
        </Link>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search quotations..."
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
              <option value="sent">Sent</option>
              <option value="accepted">Accepted</option>
              <option value="declined">Declined</option>
              <option value="expired">Expired</option>
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
                  Expiry Date
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
              {quotations.map((quotation) => (
                <tr key={quotation._id} className="hover:bg-slate-800/50">
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-blue-400">
                    {quotation.quotationNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-white">
                    {quotation.customer?.firstName ||
                      quotation.customer?.lastName
                      ? `${quotation.customer.firstName || ""} ${quotation.customer.lastName || ""
                        }`.trim()
                      : quotation.customer?.billing?.company || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                    {quotation.quotationDate
                      ? formatDate(quotation.quotationDate, settings)
                      : formatDate(quotation.createdAt, settings)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-slate-400">
                    {quotation.validUntil
                      ? formatDate(quotation.validUntil, settings)
                      : "-"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-white">
                    {formatCurrency(quotation.total, settings)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${quotation.status === "sent"
                        ? "bg-blue-900/50 text-blue-400 border border-blue-800"
                        : quotation.status === "accepted"
                          ? "bg-green-900/50 text-green-400 border border-green-800"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                        }`}
                    >
                      {quotation.status.charAt(0).toUpperCase() +
                        quotation.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-2">
                    <button
                      onClick={() =>
                        navigate(`/quotations/edit/${quotation._id}`)
                      }
                      className="text-yellow-400 hover:text-yellow-300"
                      title="Edit Quotation"
                    >
                      <Edit className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleConvertToInvoice(quotation)}
                      className="text-green-400 hover:text-green-300"
                      title="Convert to Invoice"
                    >
                      <FileText className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(quotation._id)}
                      className="text-red-400 hover:text-red-300"
                      title="Delete Quotation"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                    <Link
                      to={`/quotations/${quotation._id}`}
                      className="text-blue-400 hover:text-blue-300"
                      title="View Quotation"
                    >
                      <Eye className="h-5 w-5" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {quotations.length === 0 && !loading && (
          <div className="p-6 text-center text-slate-500">
            No quotations found. Try adjusting your search or create one to get started.
          </div>
        )}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={totalQuotations}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
          itemName="quotations"
        />
      </div>
    </div>
  );
};

export default Quotations;
