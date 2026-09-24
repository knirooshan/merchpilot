import { useState, useEffect } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { ENDPOINTS } from "../config/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useSelector } from "react-redux";
import { formatCurrency } from "../utils/currency";
import { formatDate } from "../utils/date";
import { Calendar, Download, Filter, FileText } from "lucide-react";
import DateInput from "../components/DateInput";

const Reports = () => {
  const { user } = useSelector((state) => state.auth);
  const { data: settings } = useSelector((state) => state.settings);
  const [activeTab, setActiveTab] = useState("sales"); // 'sales' or 'profit-loss'
  const [stats, setStats] = useState(null);
  const [salesData, setSalesData] = useState(null);
  const [profitLossData, setProfitLossData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState("monthly");
  const [dateRange, setDateRange] = useState({
    startDate: "",
    endDate: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const token = user.token;
        const config = {
          headers: { Authorization: `Bearer ${token}` },
          params: {
            timeframe,
            startDate: dateRange.startDate,
            endDate: dateRange.endDate,
          },
        };

        if (activeTab === "sales") {
          const [salesRes, statsRes] = await Promise.all([
            axios.get(ENDPOINTS.REPORTS_SALES, config),
            axios.get(ENDPOINTS.REPORTS_DASHBOARD, config),
          ]);
          setSalesData(salesRes.data);
          setStats(statsRes.data);
        } else {
          const res = await axios.get(ENDPOINTS.REPORTS_PROFIT_LOSS, config);
          setProfitLossData(res.data);
          setStats(res.data.summary);
        }
        setLoading(false);
      } catch (error) {
        console.error("Error fetching reports:", error);
        setLoading(false);
      }
    };
    fetchData();
  }, [user.token, timeframe, dateRange, activeTab]);

  const handleDownloadPDF = async () => {
    try {
      const token = user.token;
      const endpoint =
        activeTab === "sales"
          ? ENDPOINTS.PDF_SALES_REPORT
          : ENDPOINTS.PDF_PROFIT_LOSS_REPORT;
      const response = await axios.post(
        endpoint,
        {
          timeframe,
          startDate: dateRange.startDate,
          endDate: dateRange.endDate,
        },
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: "blob",
        },
      );

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `${
          activeTab === "sales" ? "Sales" : "Profit_Loss"
        }_Report_${timeframe}.pdf`,
      );
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error("Error downloading PDF:", error);
      alert("Failed to download report PDF");
    }
  };

  if (loading && !stats)
    return <div className="text-white p-6">Loading reports...</div>;

  const CustomLegend = ({ payload }) => {
    if (!payload) return null;
    return (
      <div className="flex justify-center gap-6 mt-4">
        {payload.map((entry, index) => (
          <div key={`item-${index}`} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded-sm"
              style={{ backgroundColor: entry.color }}
            ></div>
            <span className="text-slate-400 text-sm">{entry.value}</span>
          </div>
        ))}
      </div>
    );
  };

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-slate-900 border border-slate-800 p-3 rounded-lg shadow-xl">
          <p className="text-slate-400 text-xs mb-2 font-medium uppercase tracking-wider">
            {label}
          </p>
          <div className="space-y-1">
            {payload.map((entry, index) => {
              const isProfit = entry.dataKey === "profit";
              const value = entry.value;
              const color = isProfit
                ? value >= 0
                  ? "#10B981"
                  : "#EF4444"
                : entry.color;

              return (
                <div
                  key={index}
                  className="flex items-center justify-between gap-8"
                >
                  <span className="text-slate-400 text-sm">{entry.name}:</span>
                  <span className="font-bold text-sm" style={{ color }}>
                    {formatCurrency(value, settings)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white">Financial Reports</h1>
        <button
          onClick={handleDownloadPDF}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors text-sm font-medium"
        >
          <Download size={18} />
          Download {activeTab === "sales" ? "Sales" : "P&L"} PDF
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveTab("sales")}
          className={`px-6 py-3 text-sm font-medium transition-colors relative ${
            activeTab === "sales"
              ? "text-blue-500"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Sales Report
          {activeTab === "sales" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
          )}
        </button>
        <button
          onClick={() => setActiveTab("profit-loss")}
          className={`px-6 py-3 text-sm font-medium transition-colors relative ${
            activeTab === "profit-loss"
              ? "text-blue-500"
              : "text-slate-400 hover:text-slate-200"
          }`}
        >
          Profit & Loss
          {activeTab === "profit-loss" && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-500"></div>
          )}
        </button>
      </div>

      {/* Filters */}
      <div className="bg-slate-900 p-4 rounded-lg border border-slate-800 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-slate-400 text-sm font-medium mb-1">
            <Filter size={18} />
            <span>Timeframe</span>
          </div>
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            className="bg-slate-800 text-white text-sm rounded border border-slate-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 h-[42px]"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
        </div>

        <div className="flex items-end gap-4 ml-auto">
          <div className="w-40">
            <DateInput
              label="From"
              value={dateRange.startDate}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, startDate: e.target.value }))
              }
            />
          </div>
          <div className="w-40">
            <DateInput
              label="To"
              value={dateRange.endDate}
              onChange={(e) =>
                setDateRange((prev) => ({ ...prev, endDate: e.target.value }))
              }
            />
          </div>
          {(dateRange.startDate || dateRange.endDate) && (
            <button
              onClick={() => setDateRange({ startDate: "", endDate: "" })}
              className="text-slate-400 hover:text-white text-xs underline mb-3"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {activeTab === "sales" ? (
        <div className="space-y-6">
          {/* Sales Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900 p-6 rounded-lg shadow border border-slate-800">
              <h3 className="text-slate-400 text-sm font-medium">
                Total Sales Volume
              </h3>
              <p className="text-3xl font-bold text-white">
                {formatCurrency(stats.totalSales, settings)}
              </p>
            </div>
            <div className="bg-slate-900 p-6 rounded-lg shadow border border-slate-800">
              <h3 className="text-slate-400 text-sm font-medium">
                Average Order Value
              </h3>
              <p className="text-3xl font-bold text-blue-400">
                {formatCurrency(
                  stats.totalSales / (salesData?.orderCount || 1),
                  settings,
                )}
              </p>
            </div>
            <Link
              to="/outstanding-invoices"
              className="bg-slate-900 p-6 rounded-lg shadow border border-slate-800 hover:border-red-800/50 transition-colors"
            >
              <h3 className="text-slate-400 text-sm font-medium">
                Outstanding Receivables
              </h3>
              <p className="text-3xl font-bold text-red-400">
                {formatCurrency(stats.totalOutstanding || 0, settings)}
              </p>
            </Link>
          </div>

          {/* Sales Chart & Product Breakdown Side by Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales Chart */}
            <div className="bg-slate-900 p-6 rounded-lg shadow border border-slate-800">
              <h2 className="text-lg font-medium text-white mb-4 capitalize">
                {timeframe} Sales Breakdown
              </h2>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesData?.chartData || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                    <XAxis dataKey="name" stroke="#94a3b8" />
                    <YAxis stroke="#94a3b8" />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend content={<CustomLegend />} />
                    <Bar dataKey="sales" fill="#4F46E5" name="Sales" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Product Breakdown */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-slate-800 bg-slate-800/50 flex justify-between items-center">
                <h3 className="text-white font-medium">Top 10 Products</h3>
                <span className="text-[10px] text-slate-500 uppercase tracking-wider">
                  By Quantity
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3 text-right">Qty</th>
                      <th className="px-4 py-3 text-right">Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {salesData?.productBreakdown?.slice(0, 10).map((p) => (
                      <tr
                        key={p._id || p.name}
                        className="hover:bg-slate-800/30"
                      >
                        <td className="px-4 py-3 text-white font-medium">
                          <div
                            className="truncate max-w-[150px]"
                            title={p.name}
                          >
                            {p.name || "Unknown Product"}
                          </div>
                          <div className="text-[10px] text-slate-500">
                            {p.sku || "-"}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-slate-300">
                          {p.quantity}
                        </td>
                        <td className="px-4 py-3 text-right text-blue-400 font-medium">
                          {formatCurrency(p.revenue, settings)}
                        </td>
                      </tr>
                    ))}
                    {(!salesData?.productBreakdown ||
                      salesData.productBreakdown.length === 0) && (
                      <tr>
                        <td
                          colSpan="3"
                          className="px-4 py-8 text-center text-slate-500 italic"
                        >
                          No product data found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Sales List */}
          <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
            <div className="p-4 border-b border-slate-800 bg-slate-800/50">
              <h3 className="text-white font-medium">Sales List</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950 text-slate-400 uppercase text-xs">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Invoice #</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Method</th>
                    <th className="px-4 py-3 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {salesData?.salesList?.map((s) => (
                    <tr key={s._id} className="hover:bg-slate-800/30">
                      <td className="px-4 py-3 text-slate-300">
                        {formatDate(s.date, settings)}
                      </td>
                      <td className="px-4 py-3 text-white font-medium">
                        {s.invoice?.invoiceNumber || "N/A"}
                      </td>
                      <td className="px-4 py-3 text-white">
                        {s.customer
                          ? s.customer.firstName || s.customer.lastName
                            ? `${s.customer.firstName || ""} ${
                                s.customer.lastName || ""
                              }`.trim()
                            : s.customer.billing?.company || "N/A"
                          : "N/A"}
                      </td>
                      <td className="px-4 py-3 text-slate-400">{s.method}</td>
                      <td className="px-4 py-3 text-right text-blue-400 font-medium">
                        {formatCurrency(s.amount, settings)}
                      </td>
                    </tr>
                  ))}
                  {salesData?.salesList?.length === 0 && (
                    <tr>
                      <td
                        colSpan="5"
                        className="px-4 py-8 text-center text-slate-500 italic"
                      >
                        No sales found for this period
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* P&L Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900 p-6 rounded-lg shadow border border-slate-800">
              <h3 className="text-slate-400 text-sm font-medium">
                Total Revenue
              </h3>
              <p className="text-3xl font-bold text-white">
                {formatCurrency(stats.totalSales, settings)}
              </p>
            </div>
            <div className="bg-slate-900 p-6 rounded-lg shadow border border-slate-800">
              <h3 className="text-slate-400 text-sm font-medium">
                Total Expenses
              </h3>
              <p className="text-3xl font-bold text-red-400">
                {formatCurrency(stats.totalExpenses, settings)}
              </p>
            </div>
            <div className="bg-slate-900 p-6 rounded-lg shadow border border-slate-800">
              <h3 className="text-slate-400 text-sm font-medium">Net Profit</h3>
              <p
                className={`text-3xl font-bold ${
                  stats.netProfit >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {formatCurrency(stats.netProfit, settings)}
              </p>
            </div>
          </div>

          {/* P&L Chart */}
          <div className="bg-slate-900 p-6 rounded-lg shadow border border-slate-800">
            <h2 className="text-lg font-medium text-white mb-4 capitalize">
              {timeframe} Profit & Loss Chart
            </h2>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={profitLossData?.chartData || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#475569" />
                  <XAxis dataKey="name" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend
                    content={() => (
                      <CustomLegend
                        payload={[
                          { value: "Profit", color: "#10B981" },
                          { value: "Loss", color: "#EF4444" },
                        ]}
                      />
                    )}
                  />
                  <Bar dataKey="profit" fill="#10B981">
                    {(profitLossData?.chartData || []).map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.profit >= 0 ? "#10B981" : "#EF4444"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Detailed Lists */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Payments List */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-slate-800 bg-slate-800/50">
                <h3 className="text-white font-medium">Payments Received</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Invoice #</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {profitLossData?.payments.map((p) => (
                      <tr key={p._id} className="hover:bg-slate-800/30">
                        <td className="px-4 py-3 text-slate-300">
                          {formatDate(p.date, settings)}
                        </td>
                        <td className="px-4 py-3 text-white font-medium">
                          {p.invoice?.invoiceNumber || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-white">
                          {p.customer
                            ? p.customer.firstName || p.customer.lastName
                              ? `${p.customer.firstName || ""} ${
                                  p.customer.lastName || ""
                                }`.trim()
                              : p.customer.billing?.company || "N/A"
                            : "N/A"}
                        </td>
                        <td className="px-4 py-3 text-right text-green-400 font-medium">
                          {formatCurrency(p.amount, settings)}
                        </td>
                      </tr>
                    ))}
                    {profitLossData?.payments.length === 0 && (
                      <tr>
                        <td
                          colSpan="4"
                          className="px-4 py-8 text-center text-slate-500 italic"
                        >
                          No payments found for this period
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Expenses List */}
            <div className="bg-slate-900 rounded-lg border border-slate-800 overflow-hidden">
              <div className="p-4 border-b border-slate-800 bg-slate-800/50">
                <h3 className="text-white font-medium">Expenses Paid</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-950 text-slate-400 uppercase text-xs">
                    <tr>
                      <th className="px-4 py-3">Date</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {profitLossData?.expenses.map((e) => (
                      <tr key={e._id} className="hover:bg-slate-800/30">
                        <td className="px-4 py-3 text-slate-300">
                          {formatDate(e.date, settings)}
                        </td>
                        <td className="px-4 py-3 text-white">{e.category}</td>
                        <td className="px-4 py-3 text-right text-red-400 font-medium">
                          {formatCurrency(e.amount, settings)}
                        </td>
                      </tr>
                    ))}
                    {profitLossData?.expenses.length === 0 && (
                      <tr>
                        <td
                          colSpan="3"
                          className="px-4 py-8 text-center text-slate-500 italic"
                        >
                          No expenses found for this period
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Reports;
