import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../api/apiClient";
import { ENDPOINTS } from "../config/api";
import { useNavigate, useParams } from "react-router-dom";
import { Plus, Trash, Save, Edit2 } from "lucide-react";
import { useSelector } from "react-redux";
import {
  formatCurrency,
  getDocumentCurrencySettings,
  isForeignCurrency,
} from "../utils/currency";
import { calculateTotals as calcTotals } from "../utils/taxCalculations";
import CustomerForm from "../components/CustomerForm";
import CurrencySelector from "../components/CurrencySelector";
import DateInput from "../components/DateInput";
import RichTextEditor from "../components/RichTextEditor";
import ItemModal from "../components/ItemModal";
import SearchableSelect from "../components/SearchableSelect";
import {
  searchCustomersApi,
  fetchCustomerByIdApi,
  formatCustomerOption,
} from "../utils/selectHelpers";
import toast from "react-hot-toast";

const EditQuotation = () => {
  const queryClient = useQueryClient();
  const { user } = useSelector((state) => state.auth);
  const { data: settings } = useSelector((state) => state.settings);
  const navigate = useNavigate();
  const { id } = useParams();
  const [selectedCustomerOpt, setSelectedCustomerOpt] = useState(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  const [currency, setCurrency] = useState(null);
  const [exchangeRate, setExchangeRate] = useState(null);

  const [formData, setFormData] = useState({
    customer: "",
    items: [],
    notes: "",
    quotationDate: "",
    validUntil: "",
    taxRate: 0,
    discount: 0,
    deliveryCharge: 0,
    deliveryNote: "",
    terms: "",
  });

  const { data: productsData, isLoading: loadingProducts } = useQuery({
    queryKey: ["products"],
    queryFn: async () => {
      const res = await apiClient.get(ENDPOINTS.PRODUCTS);
      return Array.isArray(res.data) ? res.data : res.data?.data || [];
    },
  });
  const products = productsData || [];

  const { data: quotationData, isLoading: loadingQuotation } = useQuery({
    queryKey: ["quotation", id],
    queryFn: async () => {
      const res = await apiClient.get(ENDPOINTS.QUOTATION_BY_ID(id));
      return res.data;
    },
    enabled: Boolean(id),
  });

  const loading = loadingProducts || loadingQuotation;

  useEffect(() => {
    if (quotationData) {
      if (quotationData.customer) {
        setSelectedCustomerOpt(formatCustomerOption(quotationData.customer));
      }
      setFormData({
        customer: quotationData.customer?._id || quotationData.customer || "",
        items: (quotationData.items || []).map((item) => ({
          product:
            typeof item.product === "object"
              ? item.product?._id
              : item.product || null,
          name: item.name,
          description: item.description || "",
          sku: item.sku || "",
          price: item.price,
          quantity: item.quantity,
          discount: item.discount || 0,
          discountType: item.discountType || "fixed",
          isTaxable: item.isTaxable ?? false,
          taxMethod:
            item.taxMethod || settings?.tax?.defaultMethod || "exclusive",
          itemTax: item.itemTax || 0,
          total: item.total,
        })),
        notes: quotationData.notes || "",
        quotationDate: quotationData.quotationDate
          ? quotationData.quotationDate.split("T")[0]
          : "",
        validUntil: quotationData.validUntil
          ? quotationData.validUntil.split("T")[0]
          : "",
        taxRate: quotationData.taxRate || settings?.tax?.rate || 0,
        discount: quotationData.discount || 0,
        deliveryCharge: quotationData.deliveryCharge || 0,
        deliveryNote: quotationData.deliveryNote || "",
        terms: quotationData.terms || "",
      });

      // Restore saved currency (only if foreign)
      if (isForeignCurrency(quotationData, settings)) {
        setCurrency(quotationData.currency);
        setExchangeRate(quotationData.exchangeRate || null);
      } else {
        setCurrency(null);
        setExchangeRate(null);
      }
    }
  }, [quotationData, settings]);

  const addItem = (item) => {
    if (editingItemIndex !== null) {
      const newItems = [...formData.items];
      newItems[editingItemIndex] = item;
      setFormData((prev) => ({ ...prev, items: newItems }));
      setEditingItemIndex(null);
    } else {
      setFormData((prev) => ({
        ...prev,
        items: [...prev.items, item],
      }));
    }
  };

  const removeItem = (index) => {
    const newItems = formData.items.filter((_, i) => i !== index);
    setFormData((prev) => ({ ...prev, items: newItems }));
  };

  const editItem = (index) => {
    setEditingItemIndex(index);
    setShowItemModal(true);
  };

  const calculateTotals = () => {
    return calcTotals(
      formData.items,
      formData.taxRate,
      formData.discount,
      formData.deliveryCharge,
    );
  };

  const updateQuotationMutation = useMutation({
    mutationFn: async (payload) => {
      const { data } = await apiClient.put(ENDPOINTS.QUOTATION_BY_ID(id), payload);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quotations"] });
      queryClient.invalidateQueries({ queryKey: ["quotation", id] });
      toast.success("Quotation updated successfully");
      navigate(`/quotations/${id}`);
    },
    onError: (error) => {
      console.error("Error updating quotation:", error);
      toast.error(error.response?.data?.message || "Error updating quotation");
    },
  });

  const createCustomerMutation = useMutation({
    mutationFn: async (customerData) => {
      const { data } = await apiClient.post(ENDPOINTS.CUSTOMERS, customerData);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      const opt = formatCustomerOption(data);
      setSelectedCustomerOpt(opt);
      setFormData((prev) => ({ ...prev, customer: data._id }));
      setShowCustomerModal(false);
      toast.success("Customer created successfully");
    },
    onError: (error) => {
      console.error("Error creating customer:", error);
      toast.error(error.response?.data?.message || "Error creating customer");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const totals = calculateTotals();
    const isForeign = isForeignCurrency({ currency, exchangeRate }, settings);

    updateQuotationMutation.mutate({
      ...formData,
      items: totals.itemsWithTax,
      subtotal: totals.subtotal,
      tax: totals.tax,
      taxRate: formData.taxRate,
      total: totals.total,
      currency: isForeign ? currency : null,
      exchangeRate: isForeign ? exchangeRate : null,
    });
  };

  const handleSaveCustomer = (customerData) => {
    createCustomerMutation.mutate(customerData);
  };

  const { subtotal, tax, total } = calculateTotals();
  const effectiveSettings = getDocumentCurrencySettings({ currency }, settings);

  if (loading) return <div className="text-white">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Edit Quotation</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Selection and Dates */}
        <div className="bg-slate-900 p-6 rounded-lg shadow border border-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Select Customer
              </label>
              <div className="flex gap-2">
                <SearchableSelect
                  value={formData.customer}
                  onChange={(val, opt) => {
                    setFormData({ ...formData, customer: val });
                    setSelectedCustomerOpt(opt);
                  }}
                  loadOptions={(q) => searchCustomersApi(user.token, q, 10)}
                  fetchOptionById={(id) => fetchCustomerByIdApi(user.token, id)}
                  selectedOption={selectedCustomerOpt}
                  placeholder="Select a customer..."
                  searchPlaceholder="Search customers by name, email, phone, company..."
                  required
                  className="flex-1"
                />
                <button
                  type="button"
                  onClick={() => setShowCustomerModal(true)}
                  className="bg-slate-800 hover:bg-slate-700 text-white rounded px-3 border border-slate-700"
                  title="Add New Customer"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div>
              <DateInput
                label="Quotation Date"
                name="quotationDate"
                value={formData.quotationDate}
                onChange={(e) =>
                  setFormData({ ...formData, quotationDate: e.target.value })
                }
                required
              />
            </div>
            <div>
              <DateInput
                label="Valid Until (Expiry Date)"
                name="validUntil"
                value={formData.validUntil}
                onChange={(e) =>
                  setFormData({ ...formData, validUntil: e.target.value })
                }
              />
            </div>
          </div>

          {/* Currency Selector */}
          <div className="mt-4">
            <CurrencySelector
              settings={settings}
              currency={currency}
              exchangeRate={exchangeRate}
              onChange={({ currency: c, exchangeRate: er }) => {
                setCurrency(c);
                setExchangeRate(er);
              }}
            />
          </div>
        </div>

        {/* Items List */}
        <div className="bg-slate-900 p-6 rounded-lg shadow border border-slate-800">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-white">Items</h2>
            <button
              type="button"
              onClick={() => {
                setEditingItemIndex(null);
                setShowItemModal(true);
              }}
              className="flex items-center text-sm text-blue-400 hover:text-blue-300"
            >
              <Plus className="h-4 w-4 mr-1" /> Add Item
            </button>
          </div>

          <div className="space-y-4">
            {formData.items.map((item, index) => (
              <div
                key={index}
                className="flex gap-4 items-start border-b border-slate-800 pb-4"
              >
                <div className="flex-1">
                  <div className="text-white font-medium">{item.name}</div>
                  {item.description && (
                    <div
                      className="text-slate-400 text-sm mt-1 prose prose-invert prose-sm max-w-none"
                      dangerouslySetInnerHTML={{ __html: item.description }}
                    />
                  )}
                  <div className="text-slate-500 text-xs mt-1 flex items-center gap-2">
                    <span>{item.sku ? `SKU: ${item.sku}` : "Custom Item"}</span>
                    {item.isTaxable && (
                      <span className="text-blue-400">
                        • {settings?.tax?.label || "Tax"} ({item.taxMethod})
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-24 text-right">
                  <div className="text-xs text-slate-500 mb-1">Price</div>
                  <div className="text-white">
                    {formatCurrency(item.price, effectiveSettings)}
                  </div>
                </div>
                <div className="w-16 text-center">
                  <div className="text-xs text-slate-500 mb-1">Qty</div>
                  <div className="text-white">{item.quantity}</div>
                </div>
                <div className="w-20 text-right">
                  <div className="text-xs text-slate-500 mb-1">Discount</div>
                  <div className="text-white">
                    {item.discount > 0
                      ? item.discountType === "percentage"
                        ? `${item.discount}%`
                        : formatCurrency(item.discount, effectiveSettings)
                      : "-"}
                  </div>
                </div>
                <div className="w-24 text-right font-medium text-white">
                  <div className="text-xs text-slate-500 mb-1">Total</div>
                  {formatCurrency(item.total, effectiveSettings)}
                </div>
                <div className="flex gap-2 self-center">
                  <button
                    type="button"
                    onClick={() => editItem(index)}
                    className="text-blue-400 hover:text-blue-300"
                  >
                    <Edit2 className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeItem(index)}
                    className="text-red-400 hover:text-red-300"
                  >
                    <Trash className="h-5 w-5" />
                  </button>
                </div>
              </div>
            ))}
            {formData.items.length === 0 && (
              <div className="text-center py-8 text-slate-500 border-2 border-dashed border-slate-800 rounded-lg">
                No items added yet. Click "Add Item" to start.
              </div>
            )}
          </div>

          {/* Totals */}
          <div className="mt-6 border-t border-slate-800 pt-4 flex flex-col items-end space-y-2">
            <div className="flex justify-between w-72">
              <span className="text-slate-400">Subtotal:</span>
              <span className="font-medium text-white">
                {formatCurrency(subtotal, effectiveSettings)}
              </span>
            </div>
            {tax > 0 && (
              <div className="flex justify-between w-72">
                <span className="text-slate-400">
                  {settings?.tax?.label || "Tax"} ({formData.taxRate}%):
                </span>
                <span className="font-medium text-white">
                  {formatCurrency(tax, effectiveSettings)}
                </span>
              </div>
            )}
            <div className="flex justify-between w-72 items-center">
              <span className="text-slate-400">Discount:</span>
              <input
                type="number"
                value={formData.discount}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    discount: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-right text-white focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div className="flex justify-between w-72 items-center">
              <span className="text-slate-400">Delivery Charge:</span>
              <input
                type="number"
                value={formData.deliveryCharge}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    deliveryCharge: parseFloat(e.target.value) || 0,
                  })
                }
                className="w-24 bg-slate-950 border border-slate-700 rounded px-2 py-1 text-right text-white focus:outline-none focus:ring-1 focus:ring-blue-600"
              />
            </div>
            <div className="flex justify-between w-72 text-lg font-bold pt-2 border-t border-slate-800 text-white">
              <span>Total:</span>
              <span>{formatCurrency(total, effectiveSettings)}</span>
            </div>
          </div>
        </div>

        {/* Notes Section */}
        <div className="bg-slate-900 p-6 rounded-lg shadow border border-slate-800">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Notes
            </label>
            <RichTextEditor
              value={formData.notes}
              onChange={(val) => setFormData({ ...formData, notes: val })}
              placeholder="Add any additional notes..."
              className="h-32"
            />
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Terms & Conditions
            </label>
            <RichTextEditor
              value={formData.terms}
              onChange={(val) => setFormData({ ...formData, terms: val })}
              placeholder="Add terms and conditions..."
              className="h-48"
            />
          </div>
          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Delivery Note
            </label>
            <RichTextEditor
              value={formData.deliveryNote}
              onChange={(val) =>
                setFormData({ ...formData, deliveryNote: val })
              }
              placeholder="Add delivery instructions or notes..."
              className="h-32"
            />
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={updateQuotationMutation.isPending}
            className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm font-medium transition-colors disabled:opacity-50"
          >
            <Save className="mr-2 h-5 w-5" />
            {updateQuotationMutation.isPending ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>

      {showCustomerModal && (
        <CustomerForm
          onClose={() => setShowCustomerModal(false)}
          onSave={handleSaveCustomer}
        />
      )}

      <ItemModal
        isOpen={showItemModal}
        onClose={() => {
          setShowItemModal(false);
          setEditingItemIndex(null);
        }}
        onAdd={addItem}
        products={products}
        settings={settings}
        currency={currency}
        exchangeRate={exchangeRate}
        initialItem={
          editingItemIndex !== null ? formData.items[editingItemIndex] : null
        }
      />
    </div>
  );
};

export default EditQuotation;
