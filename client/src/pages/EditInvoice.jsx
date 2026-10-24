import { useState, useEffect } from "react";
import axios from "axios";
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
import ReasonModal from "../components/ReasonModal";
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

const EditInvoice = () => {
  const { user } = useSelector((state) => state.auth);
  const { data: settings } = useSelector((state) => state.settings);
  const navigate = useNavigate();
  const { id } = useParams();
  const [selectedCustomerOpt, setSelectedCustomerOpt] = useState(null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showReasonModal, setShowReasonModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState(null);
  const [currency, setCurrency] = useState(null);
  const [exchangeRate, setExchangeRate] = useState(null);

  const [formData, setFormData] = useState({
    customer: "",
    reference: "",
    items: [],
    notes: "",
    invoiceDate: "",
    dueDate: "",
    paymentMethod: "Bank Transfer",
    taxRate: 0,
    discount: 0,
    deliveryCharge: 0,
    deliveryNote: "",
    terms: "",
    status: "draft",
    placeOfSupply: "",
    invoiceType: "tax",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = user.token;
        const config = { headers: { Authorization: `Bearer ${token}` } };
        const [prodRes, invoiceRes] = await Promise.all([
          axios.get(ENDPOINTS.PRODUCTS, config),
          axios.get(ENDPOINTS.INVOICE_BY_ID(id), config),
        ]);
        setProducts(prodRes.data);

        const invoice = invoiceRes.data;
        if (invoice.customer) {
          setSelectedCustomerOpt(formatCustomerOption(invoice.customer));
        }
        setFormData({
          customer: invoice.customer?._id || invoice.customer || "",
          items: invoice.items.map((item) => ({
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
          notes: invoice.notes || "",
          invoiceDate: invoice.invoiceDate
            ? invoice.invoiceDate.split("T")[0]
            : "",
          dueDate: invoice.dueDate ? invoice.dueDate.split("T")[0] : "",
          deliveryDate: invoice.deliveryDate
            ? invoice.deliveryDate.split("T")[0]
            : "",
          paymentMethod: invoice.paymentMethod || "Bank Transfer",
          taxRate: invoice.taxRate || settings?.tax?.rate || 0,
          discount: invoice.discount || 0,
          deliveryCharge: invoice.deliveryCharge || 0,
          deliveryNote: invoice.deliveryNote || "",
          terms: invoice.terms || "",
          status: invoice.status,
          reference: invoice.reference || "",
          placeOfSupply:
            invoice.placeOfSupply ||
            settings?.ird?.placeOfSupply ||
            settings?.address?.city ||
            "",
          invoiceType: invoice.invoiceType || "tax",
        });

        // Restore saved currency (only if foreign)
        if (isForeignCurrency(invoice, settings)) {
          setCurrency(invoice.currency);
          setExchangeRate(invoice.exchangeRate || null);
        } else {
          setCurrency(null);
          setExchangeRate(null);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error fetching data:", error);
        setLoading(false);
      }
    };
    fetchData();
  }, [user.token, id, settings]);

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

  const handleSaveClick = (e) => {
    e.preventDefault();
    setShowReasonModal(true);
  };

  const handleConfirmSave = async (reason) => {
    const totals = calculateTotals();

    try {
      const token = user.token;
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const isForeign = isForeignCurrency({ currency, exchangeRate }, settings);
      await axios.put(
        ENDPOINTS.INVOICE_BY_ID(id),
        {
          ...formData,
          items: totals.itemsWithTax,
          subtotal: totals.subtotal,
          tax: totals.tax,
          taxRate: formData.taxRate,
          total: totals.total,
          editReason: reason,
          editedBy: user.name,
          currency: isForeign ? currency : null,
          exchangeRate: isForeign ? exchangeRate : null,
        },
        config,
      );
      navigate(`/invoices/${id}`);
    } catch (error) {
      console.error("Error updating invoice:", error);
    }
    setShowReasonModal(false);
  };

  const handleSaveCustomer = async (customerData) => {
    try {
      const token = user.token;
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const { data } = await axios.post(
        ENDPOINTS.CUSTOMERS,
        customerData,
        config,
      );
      const opt = formatCustomerOption(data);
      setSelectedCustomerOpt(opt);
      setFormData({ ...formData, customer: data._id });
      setShowCustomerModal(false);
    } catch (error) {
      console.error("Error creating customer:", error);
      alert("Error creating customer");
    }
  };

  const { subtotal, tax, total } = calculateTotals();
  const effectiveSettings = getDocumentCurrencySettings({ currency }, settings);

  if (loading) return <div className="text-white">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-white mb-6">Edit Invoice</h1>

      <form onSubmit={handleSaveClick} className="space-y-6">
        {/* Customer Selection */}
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
                label="Invoice Date"
                name="invoiceDate"
                value={formData.invoiceDate}
                onChange={(e) =>
                  setFormData({ ...formData, invoiceDate: e.target.value })
                }
                required
              />
            </div>
            <div>
              <DateInput
                label="Due Date"
                name="dueDate"
                value={formData.dueDate}
                onChange={(e) =>
                  setFormData({ ...formData, dueDate: e.target.value })
                }
              />
            </div>
            <div>
              <DateInput
                label="Date of Delivery"
                name="deliveryDate"
                value={formData.deliveryDate}
                onChange={(e) =>
                  setFormData({ ...formData, deliveryDate: e.target.value })
                }
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Reference (PO #, etc.)
              </label>
              <input
                type="text"
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.reference}
                onChange={(e) =>
                  setFormData({ ...formData, reference: e.target.value })
                }
                placeholder="e.g. PO-12345"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Place of Supply
              </label>
              <input
                type="text"
                className="w-full bg-slate-950 border border-slate-700 text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={formData.placeOfSupply}
                onChange={(e) =>
                  setFormData({ ...formData, placeOfSupply: e.target.value })
                }
                placeholder="e.g. Colombo"
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
                className="w-24 bg-slate-950 border border-slate-700 text-white rounded px-2 py-1 text-right"
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
                className="w-24 bg-slate-950 border border-slate-700 text-white rounded px-2 py-1 text-right"
              />
            </div>
            <div className="flex justify-between w-72 text-lg font-bold pt-2 border-t">
              <span>Total:</span>
              <span>{formatCurrency(total, effectiveSettings)}</span>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="bg-slate-900 p-6 rounded-lg shadow border border-slate-800">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Invoice Type
              </label>
              <select
                value={formData.invoiceType}
                onChange={(e) =>
                  setFormData({ ...formData, invoiceType: e.target.value })
                }
                className="block w-full bg-slate-950 border border-slate-700 text-white rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="tax">Tax Invoice</option>
                <option value="proforma">Proforma Invoice</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Payment Method
              </label>
              <select
                value={formData.paymentMethod}
                onChange={(e) =>
                  setFormData({ ...formData, paymentMethod: e.target.value })
                }
                className="block w-full bg-slate-950 border border-slate-700 text-white rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Cash">Cash</option>
                <option value="Cheque">Cheque</option>
                <option value="Check">Check</option>
                <option value="Credit Card">Credit Card</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value })
                }
                className="block w-full bg-slate-950 border border-slate-700 text-white rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="draft">Draft</option>
                <option value="sent">Sent</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>
          <div className="mt-4">
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
            className="flex items-center px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm font-medium"
          >
            <Save className="mr-2 h-5 w-5" />
            Save Changes
          </button>
        </div>
      </form>

      <ReasonModal
        isOpen={showReasonModal}
        onClose={() => setShowReasonModal(false)}
        onConfirm={handleConfirmSave}
        title="Edit Invoice Reason"
        message="Please provide a reason for editing this invoice."
      />

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

export default EditInvoice;
