import { useState, useEffect } from "react";
import axios from "axios";
import { ENDPOINTS } from "../config/api";
import { Plus, Edit, Trash, Search, Eye } from "lucide-react";
import { useSelector } from "react-redux";
import VendorForm from "../components/VendorForm";
import VendorDetailModal from "../components/VendorDetailModal";
import Pagination from "../components/Pagination";
import { useDebounce } from "../utils/useDebounce";

const Vendors = () => {
  const { user } = useSelector((state) => state.auth);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalVendors, setTotalVendors] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [viewingVendorId, setViewingVendorId] = useState(null);

  const fetchVendors = async () => {
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

      const { data } = await axios.get(
        `${ENDPOINTS.VENDORS}?${params.toString()}`,
        config,
      );

      if (Array.isArray(data)) {
        setVendors(data);
        setTotalVendors(data.length);
        setTotalPages(Math.ceil(data.length / pageSize) || 1);
      } else {
        setVendors(data.data || []);
        setTotalVendors(data.total || 0);
        setTotalPages(data.pages || 1);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error fetching vendors:", error);
      setLoading(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    fetchVendors();
  }, [page, pageSize, debouncedSearch]);

  const handleAdd = () => {
    setEditingVendor(null);
    setShowForm(true);
  };

  const handleEdit = (vendor) => {
    setEditingVendor(vendor);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this vendor?")) {
      try {
        const token = user.token;
        const config = { headers: { Authorization: `Bearer ${token}` } };
        await axios.delete(ENDPOINTS.VENDOR_BY_ID(id), config);
        await fetchVendors();
      } catch (error) {
        console.error("Error deleting vendor:", error);
        alert("Error deleting vendor");
      }
    }
  };

  const handleSave = async (vendorData) => {
    try {
      const token = user.token;
      const config = { headers: { Authorization: `Bearer ${token}` } };

      if (editingVendor) {
        await axios.put(
          ENDPOINTS.VENDOR_BY_ID(editingVendor._id),
          vendorData,
          config,
        );
      } else {
        await axios.post(
          ENDPOINTS.VENDORS,
          vendorData,
          config,
        );
      }
      setShowForm(false);
      await fetchVendors();
    } catch (error) {
      console.error("Error saving vendor:", error);
      alert("Error saving vendor");
    }
  };

  if (loading && vendors.length === 0)
    return <div className="text-white">Loading vendors...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-white">Vendors</h1>
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
                      className="text-red-400 hover:text-red-300"
                    >
                      <Trash size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {vendors.length === 0 && !loading && (
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
