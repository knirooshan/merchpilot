import { useState, useEffect } from "react";
import axios from "axios";
import { ENDPOINTS } from "../config/api";
import {
  RefreshCw,
  Search,
  Plus,
  Edit,
  Trash,
  Package,
  Upload,
} from "lucide-react";
import { useSelector } from "react-redux";
import { formatCurrency } from "../utils/currency";
import ProductForm from "../components/ProductForm";
import Pagination from "../components/Pagination";
import { useDebounce } from "../utils/useDebounce";

const Products = () => {
  const { user } = useSelector((state) => state.auth);
  const { data: settings } = useSelector((state) => state.settings);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pushingMedusa, setPushingMedusa] = useState(false);
  const [pushingProductId, setPushingProductId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [sortBy, setSortBy] = useState("createdAt_desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalPages, setTotalPages] = useState(1);
  const [totalProducts, setTotalProducts] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Reset to page 1 on search or sort change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sortBy]);

  useEffect(() => {
    fetchProducts();
  }, [page, pageSize, debouncedSearch, sortBy]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const token = user.token;
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const params = new URLSearchParams({
        page: String(page),
        limit: String(pageSize),
        sortBy,
      });
      if (debouncedSearch && debouncedSearch.trim()) {
        params.append("search", debouncedSearch.trim());
      }

      const { data } = await axios.get(
        `${ENDPOINTS.PRODUCTS}?${params.toString()}`,
        config,
      );

      if (Array.isArray(data)) {
        setProducts(data);
        setTotalProducts(data.length);
        setTotalPages(Math.ceil(data.length / pageSize) || 1);
      } else {
        setProducts(data.products || data.data || []);
        setTotalProducts(data.total || 0);
        setTotalPages(data.pages || 1);
      }
      setLoading(false);
    } catch (error) {
      console.error("Error fetching products:", error);
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      const token = user.token;
      const config = { headers: { Authorization: `Bearer ${token}` } };
      await axios.post(ENDPOINTS.PRODUCTS_SYNC, {}, config);
      await fetchProducts(); // Refresh list
    } catch (error) {
      console.error("Error syncing products:", error);
    } finally {
      setSyncing(false);
    }
  };

  const handleAdd = () => {
    setEditingProduct(null);
    setShowForm(true);
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  const handlePushToMedusa = async (id) => {
    setPushingProductId(id);
    try {
      const token = user.token;
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const { data } = await axios.post(
        ENDPOINTS.PRODUCT_PUSH_MEDUSA(id),
        {},
        config,
      );
      alert(`Pushed to Medusa! ID: ${data.medusaId}`);
      await fetchProducts();
    } catch (error) {
      console.error("Medusa push error:", error);
      alert(error.response?.data?.message || "Error pushing to Medusa");
    } finally {
      setPushingProductId(null);
    }
  };

  const handlePushAllToMedusa = async () => {
    if (
      !window.confirm(
        "Push all Medusa-enabled products to your storefront? Only products with the Medusa sync toggle ON will be pushed.",
      )
    )
      return;
    setPushingMedusa(true);
    try {
      const token = user.token;
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const { data } = await axios.post(
        ENDPOINTS.PRODUCTS_PUSH_MEDUSA_ALL,
        {},
        config,
      );
      alert(data.message);
      await fetchProducts();
    } catch (error) {
      console.error("Medusa bulk push error:", error);
      alert(
        error.response?.data?.message || "Error pushing products to Medusa",
      );
    } finally {
      setPushingMedusa(false);
    }
  };

  const handleToggleMedusaSync = async (id) => {
    try {
      const token = user.token;
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const { data } = await axios.patch(
        ENDPOINTS.PRODUCT_TOGGLE_MEDUSA_SYNC(id),
        {},
        config,
      );
      setProducts((prev) =>
        prev.map((p) =>
          p._id === id ? { ...p, syncToMedusa: data.syncToMedusa } : p,
        ),
      );
    } catch (error) {
      console.error("Toggle error:", error);
      alert(error.response?.data?.message || "Failed to update sync flag");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Are you sure you want to delete this product?")) {
      try {
        const token = user.token;
        const config = { headers: { Authorization: `Bearer ${token}` } };
        await axios.delete(ENDPOINTS.PRODUCT_BY_ID(id), config);
        await fetchProducts();
      } catch (error) {
        console.error("Error deleting product:", error);
        alert("Error deleting product");
      }
    }
  };

  const handleSave = async (productData) => {
    try {
      const token = user.token;
      const config = { headers: { Authorization: `Bearer ${token}` } };

      if (editingProduct) {
        await axios.put(
          ENDPOINTS.PRODUCT_BY_ID(editingProduct._id),
          productData,
          config,
        );
      } else {
        await axios.post(
          ENDPOINTS.PRODUCTS,
          productData,
          config,
        );
      }
      setShowForm(false);
      await fetchProducts();
    } catch (error) {
      console.error("Error saving product:", error);
      alert("Error saving product");
    }
  };

  if (loading && products.length === 0)
    return <div className="text-white">Loading products...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <h1 className="text-2xl font-bold text-white">Products</h1>
        <div className="flex gap-2">
          <button
            onClick={handleAdd}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            <Plus className="mr-2 h-5 w-5" />
            Add Product
          </button>
          {!(settings?.modules?.woocommerce === false) && (
            <button
              onClick={handleSync}
              disabled={syncing}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw
                className={`mr-2 h-5 w-5 ${syncing ? "animate-spin" : ""}`}
              />
              {syncing ? "Syncing..." : "Sync from WooCommerce"}
            </button>
          )}
          {settings?.modules?.medusaSync && (
            <button
              onClick={handlePushAllToMedusa}
              disabled={pushingMedusa}
              className="flex items-center px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              <Upload
                className={`mr-2 h-5 w-5 ${pushingMedusa ? "animate-pulse" : ""}`}
              />
              {pushingMedusa
                ? "Pushing..."
                : `Push Enabled to Medusa (${products.filter((p) => p.syncToMedusa).length})`}
            </button>
          )}
        </div>
      </div>

      {/* Search and Filter */}
      <div className="bg-slate-900 p-4 rounded-lg shadow flex items-center gap-4 border border-slate-800">
        <Search className="text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Search products by name or SKU..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-1 outline-none bg-transparent text-white placeholder-slate-500"
        />
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="bg-slate-800 border border-slate-700 text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-600 shrink-0"
        >
          <option value="createdAt_desc">Newest First</option>
          <option value="createdAt_asc">Oldest First</option>
          <option value="name_asc">Name A–Z</option>
          <option value="name_desc">Name Z–A</option>
          <option value="price_asc">Price Low–High</option>
          <option value="price_desc">Price High–Low</option>
        </select>
      </div>

      {/* Products Table */}
      <div className="bg-slate-900 shadow rounded-lg overflow-hidden border border-slate-800">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-800">
            <thead className="bg-slate-950">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Image
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Price
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Cost
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                {settings?.modules?.medusaSync && (
                  <th className="px-6 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Medusa
                  </th>
                )}
                <th className="px-6 py-3 text-right text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-slate-900 divide-y divide-slate-800">
              {products.map((product) => (
                <tr key={product._id} className="hover:bg-slate-800/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    {product.images && product.images[0] ? (
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="h-10 w-10 rounded object-cover"
                      />
                    ) : (
                      <div className="h-10 w-10 bg-slate-800 rounded flex items-center justify-center text-slate-500 border border-slate-700">
                        <Package size={20} />
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-white">
                      {product.name}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-400">
                      {product.sku || "-"}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-white">
                      {formatCurrency(product.price || 0, settings)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-slate-400">
                      {formatCurrency(product.costPrice || 0, settings)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${product.status === "publish" ||
                          product.status === "published"
                          ? "bg-green-900/50 text-green-400 border border-green-800"
                          : "bg-slate-800 text-slate-400 border border-slate-700"
                        }`}
                    >
                      {product.status.charAt(0).toUpperCase() +
                        product.status.slice(1)}
                    </span>
                  </td>
                  {settings?.modules?.medusaSync && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={product.syncToMedusa || false}
                            onChange={() => handleToggleMedusaSync(product._id)}
                            className="sr-only peer"
                          />
                          <div className="w-9 h-5 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                        </label>
                        {product.medusaId && (
                          <span
                            className="text-xs text-purple-400"
                            title={`Medusa ID: ${product.medusaId}`}
                          >
                            Synced ✓
                          </span>
                        )}
                      </div>
                    </td>
                  )}
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button
                      onClick={() => handleEdit(product)}
                      className="text-blue-400 hover:text-blue-300 mr-4"
                    >
                      <Edit size={18} />
                    </button>
                    {settings?.modules?.medusaSync && (
                      <button
                        onClick={() => handlePushToMedusa(product._id)}
                        disabled={pushingProductId === product._id}
                        title={
                          product.medusaId
                            ? `Medusa ID: ${product.medusaId}`
                            : "Push to Medusa"
                        }
                        className="text-purple-400 hover:text-purple-300 mr-4 disabled:opacity-50"
                      >
                        <Upload
                          size={18}
                          className={
                            pushingProductId === product._id
                              ? "animate-pulse"
                              : ""
                          }
                        />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(product._id)}
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
        {products.length === 0 && !loading && (
          <div className="p-6 text-center text-slate-500">
            No products found. Try adjusting your search or adding a new product.
          </div>
        )}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={totalProducts}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={(newSize) => {
            setPageSize(newSize);
            setPage(1);
          }}
          itemName="products"
        />
      </div>

      {showForm && (
        <ProductForm
          product={editingProduct}
          onClose={() => setShowForm(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
};

export default Products;
