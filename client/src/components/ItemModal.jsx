import React, { useState, useEffect } from "react";
import { X, Search, Package, PlusCircle } from "lucide-react";
import { formatCurrency, getDocumentCurrencySettings } from "../utils/currency";
import { calculateItemTax } from "../utils/taxCalculations";
import RichTextEditor from "./RichTextEditor";

const ItemModal = ({
  isOpen,
  onClose,
  onAdd,
  products,
  settings,
  initialItem = null,
  currency = null,
  exchangeRate = null,
}) => {
  const [activeTab, setActiveTab] = useState("existing"); // 'existing' or 'custom'
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProduct, setSelectedProduct] = useState(null);
  const taxRate = settings?.tax?.rate || 0;
  const defaultTaxMethod = settings?.tax?.defaultMethod || "exclusive";

  // Determine if we're working in a foreign currency with a valid exchange rate
  const baseCurrencyCode = settings?.currency?.code || "LKR";
  const isForeign =
    currency?.code &&
    currency.code !== baseCurrencyCode &&
    exchangeRate?.rate > 0;
  const effectiveSettings = getDocumentCurrencySettings({ currency }, settings);

  // Convert a base-currency price to the document currency
  const toDocCurrency = (basePrice) => {
    if (!isForeign) return basePrice;
    return Math.round((basePrice / exchangeRate.rate) * 10000) / 10000;
  };

  // Convert a document-currency price back to base (for display hint)
  const toBaseCurrency = (docPrice) => {
    if (!isForeign) return docPrice;
    return Math.round(docPrice * exchangeRate.rate * 100) / 100;
  };

  const [customItem, setCustomItem] = useState({
    name: "",
    description: "",
    price: 0,
    quantity: 1,
    discount: 0,
    discountType: "fixed",
    isTaxable: false,
    taxMethod: defaultTaxMethod,
    sku: "",
  });

  const resetForm = () => {
    setSelectedProduct(null);
    setCustomItem({
      name: "",
      description: "",
      price: 0,
      quantity: 1,
      discount: 0,
      discountType: "fixed",
      isTaxable: false,
      taxMethod: defaultTaxMethod,
      sku: "",
    });
    setSearchTerm("");
    setActiveTab("existing");
  };

  useEffect(() => {
    if (isOpen) {
      if (initialItem) {
        if (initialItem.product) {
          setActiveTab("existing");
          const prod = products.find(
            (p) => p._id === (initialItem.product._id || initialItem.product),
          );
          setSelectedProduct(prod || null);
          setCustomItem({
            name: initialItem.name || "",
            description: initialItem.description || "",
            price: initialItem.price || 0,
            quantity: initialItem.quantity || 1,
            discount: initialItem.discount || 0,
            discountType: initialItem.discountType || "fixed",
            isTaxable: initialItem.isTaxable ?? false,
            taxMethod: initialItem.taxMethod || defaultTaxMethod,
            sku: initialItem.sku || "",
          });
        } else {
          setActiveTab("custom");
          setCustomItem({
            name: initialItem.name || "",
            description: initialItem.description || "",
            price: initialItem.price || 0,
            quantity: initialItem.quantity || 1,
            discount: initialItem.discount || 0,
            discountType: initialItem.discountType || "fixed",
            isTaxable: initialItem.isTaxable ?? false,
            taxMethod: initialItem.taxMethod || defaultTaxMethod,
            sku: initialItem.sku || "",
          });
        }
      } else {
        resetForm();
      }
    }
  }, [initialItem, isOpen, products]);

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchTerm.toLowerCase())),
  );

  const handleSelectProduct = (product) => {
    setSelectedProduct(product);
    setCustomItem({
      ...customItem,
      name: product.name,
      price: toDocCurrency(product.price || 0),
      sku: product.sku || "",
      description: product.shortDescription || "",
    });
  };

  // Calculate preview total using shared utility
  const previewCalc = calculateItemTax(customItem, taxRate);

  const handleSave = () => {
    const calc = calculateItemTax(customItem, taxRate);
    const itemToAdd = {
      ...customItem,
      product: activeTab === "existing" ? selectedProduct?._id : undefined,
      itemTax: calc.itemTax,
      total: calc.total,
    };
    onAdd(itemToAdd);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-slate-900 w-full max-w-2xl rounded-lg shadow-xl border border-slate-800 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-slate-800">
          <h2 className="text-xl font-bold text-white">
            {initialItem ? "Edit Item" : "Add Item"}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            <X size={24} />
          </button>
        </div>

        <div className="flex border-b border-slate-800">
          <button
            className={`flex-1 py-3 text-sm font-medium ${activeTab === "existing"
                ? "text-blue-400 border-b-2 border-blue-400"
                : "text-slate-400 hover:text-slate-200"
              }`}
            onClick={() => setActiveTab("existing")}
          >
            Existing Product
          </button>
          <button
            className={`flex-1 py-3 text-sm font-medium ${activeTab === "custom"
                ? "text-blue-400 border-b-2 border-blue-400"
                : "text-slate-400 hover:text-slate-200"
              }`}
            onClick={() => setActiveTab("custom")}
          >
            Custom Item
          </button>
        </div>

        <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
          {activeTab === "existing" && !selectedProduct ? (
            <div className="space-y-4">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Search products by name or SKU..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-md py-2 pl-10 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto custom-scrollbar">
                {filteredProducts.map((p) => (
                  <button
                    key={p._id}
                    type="button"
                    onClick={() => handleSelectProduct(p)}
                    className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/50 hover:bg-slate-800 border border-slate-700 text-left transition-colors"
                  >
                    <div className="w-12 h-12 rounded bg-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {p.images && p.images[0] ? (
                        <img
                          src={p.images[0]}
                          alt={p.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <Package className="text-slate-500" size={24} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-medium truncate">
                        {p.name}
                      </div>
                      <div className="text-slate-400 text-xs">
                        {p.sku || "No SKU"}
                      </div>
                    </div>
                    <div className="text-blue-400 font-bold">
                      {formatCurrency(
                        toDocCurrency(p.price),
                        effectiveSettings,
                      )}
                      {isForeign && (
                        <div className="text-slate-500 text-xs font-normal">
                          {formatCurrency(p.price, settings)}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="text-center py-8 text-slate-500">
                    No products found
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {activeTab === "existing" ? (
                <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 flex items-center gap-4">
                  <div className="w-16 h-16 rounded bg-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {selectedProduct.images && selectedProduct.images[0] ? (
                      <img
                        src={selectedProduct.images[0]}
                        alt={selectedProduct.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Package className="text-slate-500" size={32} />
                    )}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-white font-bold">
                      {selectedProduct.name}
                    </h3>
                    <p className="text-slate-400 text-sm">
                      {selectedProduct.sku}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedProduct(null)}
                    className="text-blue-400 hover:text-blue-300 text-sm font-medium"
                  >
                    Change
                  </button>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Item Name
                  </label>
                  <input
                    type="text"
                    className="w-full bg-slate-950 border border-slate-700 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    value={customItem.name}
                    onChange={(e) =>
                      setCustomItem({ ...customItem, name: e.target.value })
                    }
                    placeholder="e.g. Consultation Service"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1">
                  Description (Optional)
                </label>
                <RichTextEditor
                  value={customItem.description}
                  onChange={(val) =>
                    setCustomItem({ ...customItem, description: val })
                  }
                  placeholder="Short description of the service or product..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4 mt-6">
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Price
                    {isForeign && (
                      <span className="ml-1 text-amber-500">
                        ({currency.code})
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    className="w-full bg-slate-950 border border-slate-700 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    value={customItem.price}
                    onChange={(e) =>
                      setCustomItem({
                        ...customItem,
                        price: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                  {isForeign && customItem.price > 0 && (
                    <div className="text-xs text-slate-500 mt-1">
                      ≈{" "}
                      {formatCurrency(
                        toBaseCurrency(customItem.price),
                        settings,
                      )}{" "}
                      base
                    </div>
                  )}
                  {currency?.code &&
                    currency.code !== baseCurrencyCode &&
                    !exchangeRate?.rate && (
                      <div className="text-xs text-amber-600 mt-1">
                        Enter exchange rate above to auto-convert prices
                      </div>
                    )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    className="w-full bg-slate-950 border border-slate-700 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                    value={customItem.quantity}
                    onChange={(e) =>
                      setCustomItem({
                        ...customItem,
                        quantity: parseFloat(e.target.value) || 0,
                      })
                    }
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-400 mb-1">
                    Discount
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      className="w-full bg-slate-950 border border-slate-700 rounded-md py-2 px-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                      value={customItem.discount}
                      onChange={(e) =>
                        setCustomItem({
                          ...customItem,
                          discount: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                    <select
                      value={customItem.discountType}
                      onChange={(e) =>
                        setCustomItem({
                          ...customItem,
                          discountType: e.target.value,
                        })
                      }
                      className="bg-slate-950 border border-slate-700 rounded-md py-2 px-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 w-20"
                    >
                      <option value="fixed">
                        {effectiveSettings?.currency?.symbol ||
                          settings?.currency?.symbol ||
                          "$"}
                      </option>
                      <option value="percentage">%</option>
                    </select>
                  </div>
                </div>
                <div className="flex flex-col justify-end">
                  <div className="text-right">
                    <div className="text-slate-400 text-xs mb-1">Total</div>
                    <div className="text-white text-xl font-bold">
                      {formatCurrency(previewCalc.total, effectiveSettings)}
                    </div>
                    {isForeign && (
                      <div className="text-slate-500 text-xs">
                        ≈{" "}
                        {formatCurrency(
                          toBaseCurrency(previewCalc.total),
                          settings,
                        )}{" "}
                        base
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Tax Settings */}
              <div className="flex items-center gap-6 mt-4 pt-4 border-t border-slate-700/50">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={customItem.isTaxable}
                    onChange={(e) =>
                      setCustomItem({
                        ...customItem,
                        isTaxable: e.target.checked,
                      })
                    }
                    className="w-4 h-4 rounded border-slate-600 bg-slate-950 text-blue-600 focus:ring-blue-600"
                  />
                  <span className="text-sm text-slate-300">Taxable</span>
                </label>
                {customItem.isTaxable && (
                  <div className="flex items-center gap-2">
                    <label className="text-sm text-slate-400">
                      Tax Method:
                    </label>
                    <select
                      value={customItem.taxMethod}
                      onChange={(e) =>
                        setCustomItem({
                          ...customItem,
                          taxMethod: e.target.value,
                        })
                      }
                      className="bg-slate-950 border border-slate-700 rounded-md py-1.5 px-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
                    >
                      <option value="exclusive">
                        Exclusive (tax added on top)
                      </option>
                      <option value="inclusive">
                        Inclusive (tax in price)
                      </option>
                    </select>
                  </div>
                )}
                {customItem.isTaxable && previewCalc.itemTax > 0 && (
                  <div className="text-xs text-slate-400 ml-auto">
                    {settings?.tax?.label || "Tax"}:{" "}
                    {formatCurrency(previewCalc.itemTax, effectiveSettings)}
                    {customItem.taxMethod === "inclusive" && " (included)"}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-800 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={
              activeTab === "existing" ? !selectedProduct : !customItem.name
            }
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-2 rounded-md font-medium transition-colors"
          >
            <PlusCircle size={18} />
            {initialItem ? "Update Item" : "Add to List"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ItemModal;
