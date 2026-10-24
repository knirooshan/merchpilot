import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../api/apiClient";
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
import toast from "react-hot-toast";
import { formatCurrency } from "../utils/currency";
import ProductForm from "../components/ProductForm";
import Pagination from "../components/Pagination";
import { useDebounce } from "../utils/useDebounce";

const Products = () => {
  const { data: settings } = useSelector((state) => state.settings);
  const queryClient = useQueryClient();

  const [pushingProductId, setPushingProductId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 350);
  const [sortBy, setSortBy] = useState("createdAt_desc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [showForm, setShowForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);

  // Reset to page 1 on search or sort change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sortBy]);

  const queryParams = {
    page,
    limit: pageSize,
    sortBy,
    ...(debouncedSearch?.trim() ? { search: debouncedSearch.trim() } : {}),
  };

  const {
    data: productsData,
    isLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: ["products", queryParams],
    queryFn: async () => {
      const res = await apiClient.get(ENDPOINTS.PRODUCTS, {
        params: queryParams,
      });
      return res.data;
    },
    placeholderData: (previousData) => previousData,
  });

  const products = Array.isArray(productsData)
    ? productsData
    : productsData?.data || [];
  const totalProducts = Array.isArray(productsData)
    ? productsData.length
    : productsData?.total || 0;
  const totalPages = Array.isArray(productsData)
    ? Math.ceil(productsData.length / pageSize) || 1
    : productsData?.pages || 1;

  const syncMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post(ENDPOINTS.PRODUCTS_SYNC, {});
    },
    onSuccess: () => {
      toast.success("Products synced successfully");
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err) => {
      console.error("Error syncing products:", err);
      toast.error(err.response?.data?.message || "Error syncing products");
    },
  });

  const pushMedusaMutation = useMutation({
    mutationFn: async (id) => {
      setPushingProductId(id);
      const res = await apiClient.post(ENDPOINTS.PRODUCT_PUSH_MEDUSA(id), {});
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(`Pushed to Medusa! ID: ${data.medusaId}`);
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err) => {
      console.error("Medusa push error:", err);
      toast.error(err.response?.data?.message || "Error pushing to Medusa");
    },
    onSettled: () => {
      setPushingProductId(null);
    },
  });

  const pushAllMedusaMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(ENDPOINTS.PRODUCTS_PUSH_MEDUSA_ALL, {});
      return res.data;
    },
    onSuccess: (data) => {
      toast.success(data.message || "All products pushed to Medusa");
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err) => {
      console.error("Medusa bulk push error:", err);
      toast.error(
        err.response?.data?.message || "Error pushing products to Medusa",
      );
    },
  });

  const toggleMedusaSyncMutation = useMutation({
    mutationFn: async (id) => {
      const res = await apiClient.patch(
        ENDPOINTS.PRODUCT_TOGGLE_MEDUSA_SYNC(id),
        {},
      );
      return { id, data: res.data };
    },
    onSuccess: () => {
      toast.success("Medusa sync updated");
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err) => {
      console.error("Toggle error:", err);
      toast.error(err.response?.data?.message || "Failed to update sync flag");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id) => {
      await apiClient.delete(ENDPOINTS.PRODUCT_BY_ID(id));
    },
    onSuccess: () => {
      toast.success("Product deleted successfully");
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err) => {
      console.error("Error deleting product:", err);
      toast.error(err.response?.data?.message || "Error deleting product");
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (productData) => {
      if (editingProduct) {
        return apiClient.put(
          ENDPOINTS.PRODUCT_BY_ID(editingProduct._id),
          productData,
        );
      }
      return apiClient.post(ENDPOINTS.PRODUCTS, productData);
    },
    onSuccess: () => {
      toast.success(
        editingProduct
          ? "Product updated successfully"
          : "Product created successfully",
      );
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (err) => {
      console.error("Error saving product:", err);
      toast.error(err.response?.data?.message || "Error saving product");
    },
  });

  const handleSync = () => syncMutation.mutate();
  const handlePushToMedusa = (id) => pushMedusaMutation.mutate(id);
  const handlePushAllToMedusa = () => {
    if (
      window.confirm(
        "Push all Medusa-enabled products to your storefront? Only products with the Medusa sync toggle ON will be pushed.",
      )
    ) {
      pushAllMedusaMutation.mutate();
    }
  };
  const handleToggleMedusaSync = (id) => toggleMedusaSyncMutation.mutate(id);
  const handleDelete = (id) => {
    if (window.confirm("Are you sure you want to delete this product?")) {
      deleteMutation.mutate(id);
    }
  };
  const handleSave = (productData) => saveMutation.mutate(productData);

  const handleAdd = () => {
    setEditingProduct(null);
    setShowForm(true);
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setShowForm(true);
  };

  if (isLoading) return <div className="text-white">Loading products...</div>;

  if (error && !productsData) {
    return (
      <div className="p-6 bg-red-900/20 border border-red-800 text-red-400 rounded-lg">
        <p className="font-semibold">Failed to load products</p>
        <p className="text-sm mt-1">
          {error.response?.data?.message || error.message}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white">Products</h1>
          {isFetching && !isLoading && (
            <span className="text-xs text-blue-400 bg-blue-950/60 border border-blue-800/60 px-2 py-0.5 rounded animate-pulse">
              Refreshing...
            </span>
          )}
        </div>
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
              disabled={syncMutation.isPending}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw
                className={`mr-2 h-5 w-5 ${syncMutation.isPending ? "animate-spin" : ""}`}
              />
              {syncMutation.isPending ? "Syncing..." : "Sync from WooCommerce"}
            </button>
          )}
          {settings?.modules?.medusaSync && (
            <button
              onClick={handlePushAllToMedusa}
              disabled={pushAllMedusaMutation.isPending}
              className="flex items-center px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              <Upload
                className={`mr-2 h-5 w-5 ${pushAllMedusaMutation.isPending ? "animate-pulse" : ""}`}
              />
              {pushAllMedusaMutation.isPending
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
                      disabled={deleteMutation.isPending}
                      className="text-red-400 hover:text-red-300 disabled:opacity-50"
                    >
                      <Trash size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {products.length === 0 && !isLoading && (
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
