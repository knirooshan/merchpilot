import { useState, useEffect } from "react";
import axios from "axios";
import { ENDPOINTS } from "../config/api";
import {
  Search,
  Edit,
  Truck,
  Clock,
  PackageCheck,
  AlertCircle,
  FileText,
} from "lucide-react";
import { useSelector } from "react-redux";
import { formatDate } from "../utils/date";
import toast from "react-hot-toast";
import { useLocation } from "react-router-dom";
import Pagination from "../components/Pagination";
import useDebounce from "../utils/useDebounce";

const DeliveryTracking = () => {
  const { user } = useSelector((state) => state.auth);
  const location = useLocation();
  const [activeTab, setActiveTab] = useState("queue"); // "queue" or "search"

  // Queue State
  const [queue, setQueue] = useState([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [queueSearch, setQueueSearch] = useState("");
  const debouncedQueueSearch = useDebounce(queueSearch, 350);
  const [queueStatusFilter, setQueueStatusFilter] = useState("all");
  const [queuePage, setQueuePage] = useState(1);
  const [queuePageSize, setQueuePageSize] = useState(15);
  const [queueTotal, setQueueTotal] = useState(0);
  const [queuePages, setQueuePages] = useState(1);

  // Search State
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResult, setSearchResult] = useState(null);
  const [loadingSearch, setLoadingSearch] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [formData, setFormData] = useState({
    status: "pending",
    trackingNumbers: "",
    note: "",
  });

  useEffect(() => {
    setQueuePage(1);
  }, [debouncedQueueSearch, queueStatusFilter]);

  useEffect(() => {
    if (activeTab === "queue") {
      fetchQueue();
    }
  }, [activeTab, queuePage, queuePageSize, debouncedQueueSearch, queueStatusFilter]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const invoiceParam = params.get("invoice");
    if (invoiceParam) {
      setActiveTab("search");
      setSearchQuery(invoiceParam);
      executeSearch(invoiceParam);
    }
  }, [location.search]);

  const fetchQueue = async () => {
    try {
      setLoadingQueue(true);
      const token = user.token;
      const config = {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          page: queuePage,
          limit: queuePageSize,
          ...(debouncedQueueSearch ? { search: debouncedQueueSearch } : {}),
          ...(queueStatusFilter !== "all" ? { status: queueStatusFilter } : {}),
        },
      };
      const res = await axios.get(ENDPOINTS.DELIVERY_QUEUE, config);
      if (Array.isArray(res.data)) {
        setQueue(res.data);
        setQueueTotal(res.data.length);
        setQueuePages(1);
      } else {
        setQueue(res.data.data || []);
        setQueueTotal(res.data.total ?? 0);
        setQueuePages(res.data.pages ?? 1);
      }
    } catch (error) {
      console.error("Error fetching queue:", error);
      toast.error("Failed to load delivery queue");
    } finally {
      setLoadingQueue(false);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    executeSearch(searchQuery);
  };

  const executeSearch = async (query) => {
    if (!query || !query.trim()) return;

    try {
      setLoadingSearch(true);
      const token = user.token;
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const res = await axios.get(
        ENDPOINTS.DELIVERY_SEARCH(query.trim()),
        config,
      );
      setSearchResult(res.data);
    } catch (error) {
      console.error("Error searching delivery:", error);
      toast.error(error.response?.data?.message || "Invoice not found");
      setSearchResult(null);
    } finally {
      setLoadingSearch(false);
    }
  };

  const openUpdateModal = (deliveryOrInvoice) => {
    // Determine if it's from search (might only have invoice details if pending) or queue
    const isFromSearch = activeTab === "search";

    let currentStatus = "pending";
    let currentTracking = "";

    if (isFromSearch) {
      currentStatus = deliveryOrInvoice.status || "pending";
      currentTracking = deliveryOrInvoice.trackingNumbers?.join(", ") || "";
    } else {
      currentStatus = deliveryOrInvoice.status;
      currentTracking = deliveryOrInvoice.trackingNumbers?.join(", ") || "";
    }

    setFormData({
      status: currentStatus,
      trackingNumbers: currentTracking,
      note: "",
    });

    setSelectedDelivery(deliveryOrInvoice);
    setIsModalOpen(true);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const token = user.token;
      const config = { headers: { Authorization: `Bearer ${token}` } };

      const invoiceId =
        activeTab === "search"
          ? selectedDelivery.invoice._id
          : selectedDelivery.invoice._id;

      const payload = {
        status: formData.status,
        trackingNumbers: formData.trackingNumbers
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t),
        note: formData.note,
        updatedBy: user.name,
      };

      await axios.put(ENDPOINTS.DELIVERY_UPDATE(invoiceId), payload, config);

      toast.success("Delivery status updated successfully");
      setIsModalOpen(false);

      if (activeTab === "queue") {
        fetchQueue();
      } else if (activeTab === "search") {
        // Re-run search to get updated data
        const res = await axios.get(
          ENDPOINTS.DELIVERY_SEARCH(selectedDelivery.invoice.invoiceNumber),
          config,
        );
        setSearchResult(res.data);
      }
    } catch (error) {
      console.error("Error updating delivery:", error);
      toast.error("Failed to update delivery");
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "pending":
        return "bg-slate-800 text-slate-300 border border-slate-700";
      case "preparing":
        return "bg-blue-900/50 text-blue-400 border border-blue-800";
      case "dispatched":
        return "bg-yellow-900/50 text-yellow-400 border border-yellow-800";
      case "delivered":
        return "bg-green-900/50 text-green-400 border border-green-800";
      case "picked_up":
        return "bg-purple-900/50 text-purple-400 border border-purple-800";
      default:
        return "bg-slate-800 text-slate-300 border border-slate-700";
    }
  };

  const isLate = (invoiceDate) => {
    const diffTime = Math.abs(new Date() - new Date(invoiceDate));
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > 2; // Treat as late if > 2 days old and still in queue
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Delivery Tracking</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage invoice deliveries and dispatch status
          </p>
        </div>
      </div>

      <div className="mb-6 border-b border-slate-800">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("queue")}
            className={`${activeTab === "queue"
              ? "border-blue-500 text-blue-500"
              : "border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-700"
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <Clock className="w-4 h-4 mr-2" />
            Delivery Queue
          </button>
          <button
            onClick={() => setActiveTab("search")}
            className={`${activeTab === "search"
              ? "border-blue-500 text-blue-500"
              : "border-transparent text-slate-400 hover:text-slate-300 hover:border-slate-700"
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center`}
          >
            <Search className="w-4 h-4 mr-2" />
            Search by Invoice
          </button>
        </nav>
      </div>

      {activeTab === "queue" && (
        <div className="bg-slate-900 shadow rounded-lg overflow-hidden border border-slate-800">
          <div className="p-4 sm:px-6 flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 bg-slate-950 border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <h3 className="text-lg leading-6 font-medium text-white">
                Active Deliveries
              </h3>
              {queueTotal > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-900/60 text-blue-300 border border-blue-800">
                  {queueTotal} total
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative min-w-[220px] flex-1 sm:flex-none">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search invoice, tracking, customer..."
                  value={queueSearch}
                  onChange={(e) => setQueueSearch(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 text-white rounded-md pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <select
                value={queueStatusFilter}
                onChange={(e) => setQueueStatusFilter(e.target.value)}
                className="bg-slate-900 border border-slate-700 text-slate-300 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">All Active Statuses</option>
                <option value="pending">Pending</option>
                <option value="preparing">Preparing</option>
                <option value="dispatched">Dispatched</option>
              </select>

              <button
                onClick={fetchQueue}
                className="text-sm text-blue-400 hover:text-blue-300 font-medium px-2 py-1.5 border border-slate-700 rounded-md bg-slate-900 hover:bg-slate-800 transition"
              >
                Refresh
              </button>
            </div>
          </div>

          {loadingQueue ? (
            <div className="p-10 text-center text-slate-400">
              Loading queue...
            </div>
          ) : queue.length === 0 ? (
            <div className="p-10 text-center text-slate-400 flex flex-col items-center">
              <PackageCheck className="w-12 h-12 text-slate-600 mb-2" />
              <p>No active deliveries found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-800">
                <thead className="bg-slate-950">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Invoice
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Tracking
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-slate-900 divide-y divide-slate-800">
                  {queue.map((delivery) => (
                    <tr key={delivery._id} className="hover:bg-slate-800/50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {isLate(delivery.invoice.invoiceDate) && (
                            <AlertCircle
                              className="w-4 h-4 text-red-500 mr-2"
                              title="Late Order"
                            />
                          )}
                          <span className="text-sm font-medium text-white">
                            {delivery.invoice.invoiceNumber}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                        {delivery.invoice.customer
                          ? `${delivery.invoice.customer.firstName} ${delivery.invoice.customer.lastName}`
                          : "Walk-in"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                        {formatDate(delivery.invoice.invoiceDate)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(delivery.status)}`}
                        >
                          {delivery.status.replace("_", " ").toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                        {delivery.trackingNumbers &&
                          delivery.trackingNumbers.length > 0
                          ? delivery.trackingNumbers.join(", ")
                          : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => openUpdateModal(delivery)}
                          className="text-blue-600 hover:text-blue-900 flex items-center justify-end w-full"
                        >
                          <Edit className="w-4 h-4 mr-1" /> Update
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <Pagination
                currentPage={queuePage}
                totalPages={queuePages}
                totalItems={queueTotal}
                pageSize={queuePageSize}
                onPageChange={setQueuePage}
                onPageSizeChange={(newSize) => {
                  setQueuePageSize(newSize);
                  setQueuePage(1);
                }}
              />
            </div>
          )}
        </div>
      )}

      {activeTab === "search" && (
        <div>
          <form onSubmit={handleSearch} className="mb-6 flex gap-4">
            <div className="flex-1 relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-slate-500" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-3 border border-slate-700 rounded-md leading-5 bg-slate-950 placeholder-slate-500 text-white focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm shadow-sm"
                placeholder="Enter Invoice Number (e.g. INV-2026-0001)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button
              type="submit"
              disabled={loadingSearch || !searchQuery.trim()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {loadingSearch ? "Searching..." : "Search"}
            </button>
          </form>

          {searchResult && (
            <div className="bg-slate-900 shadow rounded-lg overflow-hidden border border-slate-800">
              <div className="px-4 py-5 sm:px-6 border-b border-slate-800 flex justify-between items-center">
                <div>
                  <h3 className="text-lg leading-6 font-medium text-white">
                    Delivery Details: {searchResult.invoice.invoiceNumber}
                  </h3>
                  <p className="mt-1 max-w-2xl text-sm text-slate-400">
                    Customer:{" "}
                    {searchResult.invoice.customer
                      ? `${searchResult.invoice.customer.firstName} ${searchResult.invoice.customer.lastName}`
                      : "Walk-in"}
                  </p>
                </div>
                <button
                  onClick={() => openUpdateModal(searchResult)}
                  className="inline-flex items-center px-3 py-2 border border-slate-700 shadow-sm text-sm font-medium rounded-md text-slate-300 bg-slate-800 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  <Edit className="h-4 w-4 mr-2 text-slate-400" />
                  Update Status
                </button>
              </div>

              <div className="px-4 py-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
                    Current Status
                  </h4>
                  <div className="bg-slate-950 p-4 rounded-lg border border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-sm font-medium text-slate-400">
                        Status
                      </span>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${getStatusColor(searchResult.status)}`}
                      >
                        {searchResult.status.replace("_", " ").toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-400">
                        Tracking Numbers
                      </span>
                      <span className="text-sm font-mono bg-slate-900 text-slate-300 px-2 py-1 border border-slate-700 rounded">
                        {searchResult.trackingNumbers?.length > 0
                          ? searchResult.trackingNumbers.join(", ")
                          : "Not provided"}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-slate-400 uppercase tracking-wider mb-4">
                    Lifecycle
                  </h4>
                  {searchResult.lifecycle?.length > 0 ? (
                    <div className="flow-root">
                      <ul className="-mb-8">
                        {searchResult.lifecycle
                          .sort(
                            (a, b) =>
                              new Date(b.timestamp) - new Date(a.timestamp),
                          )
                          .map((event, eventIdx) => (
                            <li key={eventIdx}>
                              <div className="relative pb-8">
                                {eventIdx !==
                                  searchResult.lifecycle.length - 1 ? (
                                  <span
                                    className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-slate-800"
                                    aria-hidden="true"
                                  ></span>
                                ) : null}
                                <div className="relative flex space-x-3">
                                  <div>
                                    <span
                                      className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-slate-900 ${getStatusColor(event.status).split(" ")[0]} ${getStatusColor(event.status).split(" ")[1]}`}
                                    >
                                      <Truck
                                        className="h-4 w-4"
                                        aria-hidden="true"
                                      />
                                    </span>
                                  </div>
                                  <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                                    <div>
                                      <p className="text-sm text-slate-400">
                                        Changed to{" "}
                                        <span className="font-medium text-white">
                                          {event.status
                                            .replace("_", " ")
                                            .toUpperCase()}
                                        </span>
                                        {event.note && (
                                          <span className="block mt-1 text-slate-500 italic">
                                            "{event.note}"
                                          </span>
                                        )}
                                      </p>
                                    </div>
                                    <div className="text-right text-sm whitespace-nowrap text-slate-500">
                                      <time dateTime={event.timestamp}>
                                        {formatDate(event.timestamp)}
                                      </time>
                                      <p className="text-xs mt-1">
                                        by {event.updatedBy}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </li>
                          ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-500 italic">
                      No lifecycle events recorded yet.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Update Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-slate-900 rounded-lg shadow-xl w-full max-w-md border border-slate-700">
            <div className="flex justify-between items-center p-4 border-b border-slate-700">
              <h2 className="text-xl font-semibold text-white">
                Update Delivery Status
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>

            <form onSubmit={handleUpdate} className="p-4 space-y-4">
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Status
                </label>
                <select
                  className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-700 bg-slate-950 text-white focus:outline-none focus:ring-blue-600 focus:border-blue-600 sm:text-sm rounded-md shadow-sm border"
                  value={formData.status}
                  onChange={(e) =>
                    setFormData({ ...formData, status: e.target.value })
                  }
                >
                  <option value="pending">Pending</option>
                  <option value="preparing">Preparing</option>
                  <option value="dispatched">Dispatched</option>
                  <option value="delivered">Delivered</option>
                  <option value="picked_up">Customer Picked Up</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Tracking Numbers (comma separated)
                </label>
                <input
                  type="text"
                  className="shadow-sm focus:ring-blue-600 focus:border-blue-600 block w-full sm:text-sm border-slate-700 bg-slate-950 text-white rounded-md border p-2"
                  placeholder="TRK123, TRK456"
                  value={formData.trackingNumbers}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      trackingNumbers: e.target.value,
                    })
                  }
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Note (Optional)
                </label>
                <textarea
                  rows={3}
                  className="shadow-sm focus:ring-blue-600 focus:border-blue-600 block w-full sm:text-sm border-slate-700 bg-slate-950 text-white rounded-md border p-2"
                  placeholder="e.g. Left at front door"
                  value={formData.note}
                  onChange={(e) =>
                    setFormData({ ...formData, note: e.target.value })
                  }
                />
              </div>

              <div className="flex justify-end pt-4 gap-3 border-t border-slate-700 mt-2">
                <button
                  type="button"
                  className="px-4 py-2 border border-slate-600 rounded text-slate-300 hover:bg-slate-800 transition-colors"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DeliveryTracking;
