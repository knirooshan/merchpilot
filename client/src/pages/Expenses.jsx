import { useState, useEffect } from "react";
import axios from "axios";
import { Plus, Trash, DollarSign, Edit, X, Eye } from "lucide-react";
import ReasonModal from "../components/ReasonModal";
import VendorForm from "../components/VendorForm";
import SearchBar from "../components/SearchBar";
import FilterBar from "../components/FilterBar";
import { useSelector } from "react-redux";
import { formatCurrency } from "../utils/currency";
import { formatDate } from "../utils/date";
import DateInput from "../components/DateInput";
import Pagination from "../components/Pagination";
import { useDebounce } from "../utils/useDebounce";
import { ENDPOINTS } from "../config/api";
import SearchableSelect from "../components/SearchableSelect";
import {
  searchVendorsApi,
  fetchVendorByIdApi,
  formatVendorOption,
} from "../utils/selectHelpers";

const Expenses = () => {
  const { user } = useSelector((state) => state.auth);
  const { data: settings } = useSelector((state) => state.settings);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [viewingExpense, setViewingExpense] = useState(null);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [pendingUpdate, setPendingUpdate] = useState(null);
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [filters, setFilters] = useState({
    category: "all",
    vendor: "all",
    startDate: "",
    endDate: "",
  });
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    category: "General",
    date: new Date().toISOString().split("T")[0],
    vendor: "",
    paymentMethod: "Cash",
    reference: "",
    notes: "",
    attachmentUrl: "",
  });
  const [uploadFile, setUploadFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [selectedVendorOpt, setSelectedVendorOpt] = useState(null);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, filters]);

  useEffect(() => {
    fetchExpenses();
  }, [page, pageSize, debouncedSearch, filters, user.token]);

  const fetchExpenses = async () => {
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
      if (filters.category !== "all")
        params.append("category", filters.category);
      if (filters.vendor !== "all") params.append("vendor", filters.vendor);
      if (filters.startDate) params.append("startDate", filters.startDate);
      if (filters.endDate) params.append("endDate", filters.endDate);

      const expensesRes = await axios.get(
        `${ENDPOINTS.EXPENSES}?${params.toString()}`,
        config,
      );

      const data = expensesRes.data;
      if (Array.isArray(data)) {
        setExpenses(data);
        setTotalExpenses(data.length);
        setTotalPages(Math.ceil(data.length / pageSize) || 1);
      } else {
        setExpenses(data.data || []);
        setTotalExpenses(data.total || 0);
        setTotalPages(data.pages || 1);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error fetching expenses:", error);
      setLoading(false);
    }
  };

  const resetFilters = () => {
    setSearch("");
    setFilters({
      category: "all",
      vendor: "all",
      startDate: "",
      endDate: "",
    });
  };

  const hasActiveFilters = () => {
    return (
      search ||
      filters.category !== "all" ||
      filters.vendor !== "all" ||
      filters.startDate ||
      filters.endDate
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const submissionData = {
      ...formData,
      vendor: formData.vendor === "" ? null : formData.vendor,
    };

    setUploading(true);
    try {
      if (uploadFile) {
        const formDataUpload = new FormData();
        formDataUpload.append("file", uploadFile);
        const token = user.token;
        const config = {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        };
        const uploadRes = await axios.post(
          ENDPOINTS.EXPENSE_UPLOAD,
          formDataUpload,
          config,
        );
        submissionData.attachmentUrl = uploadRes.data.url;
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      alert("Error uploading file. Please try again.");
      setUploading(false);
      return;
    }

    if (editingExpense) {
      // For edits, show reason modal
      setPendingUpdate(submissionData);
      setShowReasonModal(true);
    } else {
      // For new expenses, save directly
      try {
        const token = user.token;
        const config = { headers: { Authorization: `Bearer ${token}` } };
        await axios.post(ENDPOINTS.EXPENSES, submissionData, config);
        setShowForm(false);
        resetForm();
        fetchExpenses();
      } catch (error) {
        console.error("Error creating expense:", error);
      } finally {
        setUploading(false);
      }
    }
  };

  const handleConfirmEdit = async (reason) => {
    try {
      const token = user.token;
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.put(
        ENDPOINTS.EXPENSE_BY_ID(editingExpense._id),
        {
          ...pendingUpdate,
          editReason: reason,
          editedBy: user.name,
        },
        config,
      );
      setShowForm(false);
      setShowReasonModal(false);
      setEditingExpense(null);
      setPendingUpdate(null);
      resetForm();
      fetchExpenses();
    } catch (error) {
      console.error("Error updating expense:", error);
    } finally {
      setUploading(false);
    }
  };

  const handleSaveVendor = async (vendorData) => {
    try {
      const token = user.token;
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const { data } = await axios.post(ENDPOINTS.VENDORS, vendorData, config);
      const opt = formatVendorOption(data);
      setSelectedVendorOpt(opt);
      setFormData({ ...formData, vendor: data._id });
      setShowVendorModal(false);
    } catch (error) {
      console.error("Error creating vendor:", error);
      alert("Error creating vendor");
    }
  };

  const resetForm = () => {
    setFormData({
      description: "",
      amount: "",
      category: "General",
      date: new Date().toISOString().split("T")[0],
      vendor: "",
      paymentMethod: "Cash",
      reference: "",
      notes: "",
      attachmentUrl: "",
    });
    setSelectedVendorOpt(null);
    setUploadFile(null);
  };

  const handleEdit = (expense) => {
    setEditingExpense(expense);
    setSelectedVendorOpt(
      expense.vendor ? formatVendorOption(expense.vendor) : null
    );
    setFormData({
      description: expense.description,
      amount: expense.amount,
      category: expense.category,
      date: expense.date.split("T")[0],
      vendor: expense.vendor?._id || "",
      paymentMethod: expense.paymentMethod || "Cash",
      reference: expense.reference || "",
      notes: expense.notes || "",
      attachmentUrl: expense.attachmentUrl || "",
    });
    setUploadFile(null);
    setShowForm(true);
  };

  const handleCancelEdit = () => {
    setShowForm(false);
    setEditingExpense(null);
    setSelectedVendorOpt(null);
    resetForm();
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this expense?"))
      return;
    try {
      const token = user.token;
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.delete(ENDPOINTS.EXPENSE_BY_ID(id), config);
      fetchExpenses();
    } catch (error) {
      console.error("Error deleting expense:", error);
    }
  };

  if (loading) return <div className="text-white">Loading expenses...</div>;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-white">Expenses</h1>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          <Plus className="mr-2 h-5 w-5" />
          {"Add Expense"}
        </button>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search expenses..."
        />

        <FilterBar showReset={hasActiveFilters()} onReset={resetFilters}>
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">Category:</label>
            <select
              value={filters.category}
              onChange={(e) =>
                setFilters({ ...filters, category: e.target.value })
              }
              className="bg-slate-950 border border-slate-700 text-white rounded px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="all">All Categories</option>
              <option value="General">General</option>
              <option value="Rent">Rent</option>
              <option value="Utilities">Utilities</option>
              <option value="Supplies">Supplies</option>
              <option value="Salary">Salary</option>
              <option value="Marketing">Marketing</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">Vendor:</label>
            <SearchableSelect
              value={filters.vendor}
              onChange={(val) =>
                setFilters({ ...filters, vendor: val || "all" })
              }
              loadOptions={(q) => searchVendorsApi(user.token, q, 10)}
              fixedOptions={[{ value: "all", label: "All Vendors" }]}
              placeholder="All Vendors"
              searchPlaceholder="Search vendors..."
              isClearable={false}
              className="w-48"
              buttonClassName="py-1 px-3 text-sm h-8"
            />
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

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-slate-900 rounded-lg shadow-xl w-full max-w-lg border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-5 border-b border-slate-700">
              <h2 className="text-xl font-semibold text-white">
                {editingExpense ? "Edit Expense" : "New Expense"}
              </h2>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Description
                  </label>
                  <input
                    type="text"
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Amount
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="General">General</option>
                    <option value="Rent">Rent</option>
                    <option value="Utilities">Utilities</option>
                    <option value="Supplies">Supplies</option>
                    <option value="Salary">Salary</option>
                    <option value="Marketing">Marketing</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Payment Method
                  </label>
                  <select
                    value={formData.paymentMethod}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        paymentMethod: e.target.value,
                      })
                    }
                    className="w-full bg-slate-950 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Card">Card</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                    <option value="Cheque">Cheque</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <DateInput
                    label="Date"
                    name="date"
                    value={formData.date}
                    onChange={(e) =>
                      setFormData({ ...formData, date: e.target.value })
                    }
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Vendor
                  </label>
                  <div className="flex gap-2">
                    <SearchableSelect
                      value={formData.vendor}
                      onChange={(val, opt) => {
                        setFormData({ ...formData, vendor: val });
                        setSelectedVendorOpt(opt);
                      }}
                      loadOptions={(q) => searchVendorsApi(user.token, q, 10)}
                      fetchOptionById={(id) => fetchVendorByIdApi(user.token, id)}
                      selectedOption={selectedVendorOpt}
                      initialLabel={
                        editingExpense?.vendor?.name ||
                        selectedVendorOpt?.label ||
                        ""
                      }
                      placeholder="Select Vendor"
                      searchPlaceholder="Search vendors by name, email, phone..."
                      isClearable
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => setShowVendorModal(true)}
                      className="bg-slate-800 hover:bg-slate-700 text-white rounded px-3 border border-slate-700 shrink-0"
                      title="Add New Vendor"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Reference
                  </label>
                  <input
                    type="text"
                    value={formData.reference}
                    onChange={(e) =>
                      setFormData({ ...formData, reference: e.target.value })
                    }
                    className="w-full bg-slate-950 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Notes
                  </label>
                  <textarea
                    value={formData.notes}
                    onChange={(e) =>
                      setFormData({ ...formData, notes: e.target.value })
                    }
                    rows="2"
                    className="w-full bg-slate-950 border border-slate-600 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Proof of Expense (Image)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setUploadFile(e.target.files[0])}
                    className="w-full bg-slate-950 border border-slate-600 rounded px-3 py-2 text-slate-300 focus:outline-none focus:border-blue-500"
                  />
                  {formData.attachmentUrl && !uploadFile && (
                    <div className="mt-2 text-sm text-slate-400">
                      Current attachment:{" "}
                      <a
                        href={formData.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline"
                      >
                        View Image
                      </a>
                    </div>
                  )}
                  {uploadFile && (
                    <div className="mt-2 text-sm text-slate-400">
                      File selected: {uploadFile.name}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors disabled:opacity-50"
                >
                  {uploading
                    ? "Saving..."
                    : editingExpense
                      ? "Update Expense"
                      : "Save Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-slate-900 shadow rounded-lg overflow-hidden border border-slate-800">
        <table className="min-w-full divide-y divide-slate-800">
          <thead className="bg-slate-950">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Description
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Category
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Vendor
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Payment
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                Amount
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-slate-900 divide-y divide-slate-800">
            {expenses.map((expense) => (
              <tr key={expense._id} className="hover:bg-slate-800/50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                  {formatDate(expense.date, settings)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-white">
                  {expense.description}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                  <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-slate-800 text-slate-400 border border-slate-700">
                    {expense.category}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                  {expense.vendor?.name || "-"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-400">
                  {expense.paymentMethod || "Cash"}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-red-600">
                  -{formatCurrency(expense.amount, settings)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium flex justify-end gap-2">
                  <button
                    onClick={() => setViewingExpense(expense)}
                    className="text-blue-400 hover:text-blue-300"
                    title="View Expense Details"
                  >
                    <Eye className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handleEdit(expense)}
                    className="text-yellow-400 hover:text-yellow-300"
                    title="Edit Expense"
                  >
                    <Edit className="h-5 w-5" />
                  </button>
                  {user?.role === "admin" && (
                    <button
                      onClick={() => handleDelete(expense._id)}
                      className="text-red-400 hover:text-red-300"
                      title="Delete Expense"
                    >
                      <Trash className="h-5 w-5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {expenses.length === 0 && !loading && (
          <div className="p-6 text-center text-slate-500">
            No expenses recorded. Try adjusting your search or filters.
          </div>
        )}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={totalExpenses}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
          itemName="expenses"
        />
      </div>

      <ReasonModal
        isOpen={showReasonModal}
        onClose={() => {
          setShowReasonModal(false);
          setPendingUpdate(null);
        }}
        onConfirm={handleConfirmEdit}
        title="Edit Expense Reason"
        message="Please provide a reason for editing this expense."
      />

      {showVendorModal && (
        <VendorForm
          onClose={() => setShowVendorModal(false)}
          onSave={handleSaveVendor}
        />
      )}

      {/* Expense Details Modal */}
      {viewingExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-slate-900 rounded-lg shadow-xl w-full max-w-2xl border border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-5 border-b border-slate-700">
              <h2 className="text-xl font-semibold text-white">
                Expense Details
              </h2>
              <button
                type="button"
                onClick={() => setViewingExpense(null)}
                className="text-slate-400 hover:text-white transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="block text-slate-400">Date</span>
                  <span className="text-white font-medium">
                    {formatDate(viewingExpense.date, settings)}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-400">Amount</span>
                  <span className="text-red-400 font-medium text-lg">
                    {formatCurrency(viewingExpense.amount, settings)}
                  </span>
                </div>
                <div className="md:col-span-2">
                  <span className="block text-slate-400">Description</span>
                  <span className="text-white">
                    {viewingExpense.description}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-400">Category</span>
                  <span className="inline-flex px-2 text-xs leading-5 font-semibold rounded-full bg-slate-800 text-slate-400 border border-slate-700 mt-1">
                    {viewingExpense.category}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-400">Vendor</span>
                  <span className="text-white">
                    {viewingExpense.vendor?.name || "-"}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-400">Payment Method</span>
                  <span className="text-white">
                    {viewingExpense.paymentMethod || "Cash"}
                  </span>
                </div>
                <div>
                  <span className="block text-slate-400">Reference</span>
                  <span className="text-white">
                    {viewingExpense.reference || "-"}
                  </span>
                </div>
                {viewingExpense.notes && (
                  <div className="md:col-span-2">
                    <span className="block text-slate-400">Notes</span>
                    <p className="text-white whitespace-pre-wrap mt-1">
                      {viewingExpense.notes}
                    </p>
                  </div>
                )}

                {viewingExpense.attachmentUrl && (
                  <div className="md:col-span-2 mt-4 pt-4 border-t border-slate-800">
                    <span className="block text-slate-400 mb-2">
                      Proof of Expense
                    </span>
                    <div className="bg-slate-950 p-2 rounded border border-slate-800 inline-block max-w-full">
                      <a
                        href={viewingExpense.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <img
                          src={viewingExpense.attachmentUrl}
                          alt="Expense Proof"
                          className="max-h-64 object-contain rounded cursor-pointer hover:opacity-90 transition-opacity"
                        />
                      </a>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end p-5 border-t border-slate-700">
              <button
                type="button"
                onClick={() => setViewingExpense(null)}
                className="px-4 py-2 bg-slate-700 text-white rounded hover:bg-slate-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
