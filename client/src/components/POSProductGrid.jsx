import { Search, Package } from "lucide-react";
import { formatCurrency } from "../utils/currency";
import { useState } from "react";
import { useSelector } from "react-redux";

const POSProductGrid = ({ products, onAddToCart }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const { data: settings } = useSelector((state) => state.settings);

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 bg-slate-900 shadow-sm mb-4 rounded-lg border border-slate-800">
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400"
            size={20}
          />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-700 rounded-md text-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-1">
        {filteredProducts.map((product) => (
          <div
            key={product._id}
            onClick={() => onAddToCart(product)}
            className="bg-slate-900 p-4 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow border border-slate-800 hover:border-blue-500 flex flex-col"
          >
            <div className="bg-slate-800 rounded mb-3 flex items-center justify-center overflow-hidden aspect-square border border-slate-700">
              {product.images && product.images[0] ? (
                <img
                  src={product.images[0]}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Package className="text-slate-600" size={48} />
              )}
            </div>
            <h3 className="text-sm font-medium text-white line-clamp-2 mb-1 flex-1">
              {product.name}
            </h3>
            <div className="flex justify-between items-center mt-2">
              <span className="font-bold text-blue-400">
                {formatCurrency(product.price || 0, settings)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

import React from "react";
export default POSProductGrid;
