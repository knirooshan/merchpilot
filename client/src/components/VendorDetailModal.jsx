import { useState, useMemo } from "react";
import { useSelector } from "react-redux";
import { useQuery } from "@tanstack/react-query";
import apiClient from "../api/apiClient";
import { ENDPOINTS } from "../config/api";
import {
  X,
  User,
  Mail,
  Phone,
  MapPin,
  Building2,
  FileText,
  ChevronDown,
  ChevronUp,
  Calendar,
  Tag,
} from "lucide-react";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  LineChart,
  Line,
} from "recharts";
import { formatCurrency } from "../utils/currency";

/* ─── helpers ─────────────────────────────────────────────────── */
// fmt / fmtFull are created inside the component via useCurrencyFmt().
const useCurrencyFmt = () => {
  const { data: settings } = useSelector((state) => state.settings);
  const fmt = (n) => {
    const s = formatCurrency(n || 0, settings);
    return s.replace(/\.00$/, "").replace(/(\.[0-9])0$/, "$1");
  };
  const fmtFull = (n) => formatCurrency(n || 0, settings);
  return { fmt, fmtFull };
};

const fmtDate = (d) =>
  d
    ? new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
    : "-";

const CHART_COLORS = [
  "#ef4444",
  "#f59e0b",
  "#a855f7",
  "#3b82f6",
  "#22c55e",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
];

/* ─── atoms ───────────────────────────────────────────────────── */
const Section = ({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  accent = "green",
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const accentColor =
    {
      green: "text-green-400",
      blue: "text-blue-400",
      red: "text-red-400",
      yellow: "text-yellow-400",
      purple: "text-purple-400",
    }[accent] || "text-green-400";
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-slate-700/30 transition-colors"
      >
        <div className="flex items-center gap-2 font-semibold text-white">
          <Icon className={`h-4 w-4 ${accentColor}`} />
          {title}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 text-slate-400" />
        )}
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </div>
  );
};

const StatCard = ({ label, value, sub, color = "green" }) => {
  const palette = {
    green: { border: "border-green-500", text: "text-green-400" },
    blue: { border: "border-blue-500", text: "text-blue-400" },
    yellow: { border: "border-yellow-500", text: "text-yellow-400" },
    red: { border: "border-red-500", text: "text-red-400" },
    purple: { border: "border-purple-500", text: "text-purple-400" },
  };
  const c = palette[color] || palette.green;
  return (
    <div
      className={`bg-slate-900 rounded-xl p-4 border border-slate-700 border-l-4 ${c.border}`}
    >
      <p className="text-xs text-slate-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${c.text}`}>{value}</p>
      {sub && <p className="text-xs text-slate-500 mt-1">{sub}</p>}
    </div>
  );
};

const ChartTooltip = ({ active, payload, label, fmtFn }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 shadow-xl text-xs">
      {label && <p className="text-slate-400 mb-1">{label}</p>}
      {payload.map((p, i) => (
        <p
          key={i}
          style={{ color: p.color || p.fill }}
          className="font-semibold"
        >
          {p.name}:{" "}
          {typeof p.value === "number" && p.value > 100 && fmtFn
            ? fmtFn(p.value)
            : p.value}
        </p>
      ))}
    </div>
  );
};

const HorizontalBar = ({
  items,
  valueKey = "amount",
  labelKey = "name",
  formatVal,
}) => {
  const max = Math.max(...items.map((i) => i[valueKey] || 0), 1);
  return (
    <div className="space-y-3 mt-2">
      {items.map((item, i) => (
        <div key={i}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-300 truncate max-w-[65%] capitalize">
              {item[labelKey]}
            </span>
            <span className="text-red-400 font-semibold">
              {formatVal(item[valueKey])}
            </span>
          </div>
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(item[valueKey] / max) * 100}%`,
                backgroundColor: CHART_COLORS[i % CHART_COLORS.length],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════ */
const VendorDetailModal = ({ vendorId, onClose }) => {
  const { fmt, fmtFull } = useCurrencyFmt();

  const {
    data,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ["vendorSummary", vendorId],
    queryFn: async () => {
      const res = await apiClient.get(ENDPOINTS.VENDOR_SUMMARY(vendorId));
      return res.data;
    },
    enabled: !!vendorId,
  });

  const error =
    queryError?.response?.data?.message || queryError?.message || null;

  const { monthlyExpenses, categoryChartData, topExpenses } = useMemo(() => {
    if (!data) return {};

    // Monthly expenses - group by year-month
    const monthMap = {};
    data.expenses.forEach((exp) => {
      if (!exp.date) return;
      const d = new Date(exp.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", {
        month: "short",
        year: "2-digit",
      });
      if (!monthMap[key]) monthMap[key] = { key, label, amount: 0 };
      monthMap[key].amount += exp.amount || 0;
    });
    const monthlyExpenses = Object.values(monthMap)
      .sort((a, b) => a.key.localeCompare(b.key))
      .slice(-12);

    // Category pie data
    const categoryChartData = Object.entries(data.stats.categoryBreakdown)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value }));

    // Top individual expenses by amount
    const topExpenses = [...data.expenses]
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8)
      .map((e) => ({ name: e.description, amount: e.amount }));

    return { monthlyExpenses, categoryChartData, topExpenses };
  }, [data]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-slate-900 rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center text-white font-bold text-lg shadow-lg">
              {loading
                ? "?"
                : data?.vendor?.name?.charAt(0).toUpperCase() || "?"}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {loading ? "Loading…" : data?.vendor?.name}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Vendor Profile</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {loading && (
            <div className="flex items-center justify-center py-24 text-slate-400 text-sm">
              Loading vendor details…
            </div>
          )}
          {error && (
            <div className="text-red-400 text-center py-12 text-sm">
              {error}
            </div>
          )}

          {data && (
            <>
              {/* KPI cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard
                  label="Total Expenses"
                  value={data.stats.totalExpenses}
                  sub="transactions"
                  color="blue"
                />
                <StatCard
                  label="Total Spent"
                  value={fmt(data.stats.totalAmount)}
                  sub="all time"
                  color="red"
                />
                <StatCard
                  label="Categories"
                  value={Object.keys(data.stats.categoryBreakdown).length}
                  sub="expense types"
                  color="purple"
                />
              </div>

              {/* Vendor info */}
              <Section
                title="Vendor Information"
                icon={Building2}
                accent="green"
              >
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5 mt-3 text-sm">
                  {data.vendor.email && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <Mail className="h-4 w-4 text-slate-500 shrink-0" />
                      {data.vendor.email}
                    </div>
                  )}
                  {data.vendor.phone && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <Phone className="h-4 w-4 text-slate-500 shrink-0" />
                      {data.vendor.phone}
                    </div>
                  )}
                  {data.vendor.contactPerson && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <User className="h-4 w-4 text-slate-500 shrink-0" />
                      Contact: {data.vendor.contactPerson}
                    </div>
                  )}
                  {data.vendor.address && (
                    <div className="flex items-start gap-2 text-slate-300">
                      <MapPin className="h-4 w-4 text-slate-500 shrink-0 mt-0.5" />
                      {data.vendor.address}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-slate-300">
                    <Calendar className="h-4 w-4 text-slate-500 shrink-0" />
                    Added {fmtDate(data.vendor.createdAt)}
                  </div>
                </div>
              </Section>

              {/* Charts row: Monthly trend + Category donut */}
              {(monthlyExpenses?.length > 0 ||
                categoryChartData?.length > 0) && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Monthly spending trend */}
                    {monthlyExpenses?.length > 0 && (
                      <div className="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700 p-5">
                        <p className="text-sm font-semibold text-white mb-0.5">
                          Spending Over Time
                        </p>
                        <p className="text-xs text-slate-400 mb-4">
                          Monthly expense totals
                        </p>
                        <ResponsiveContainer width="100%" height={200}>
                          <BarChart data={monthlyExpenses}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              stroke="#334155"
                            />
                            <XAxis
                              dataKey="label"
                              stroke="#64748b"
                              tick={{ fontSize: 10 }}
                            />
                            <YAxis
                              stroke="#64748b"
                              tick={{ fontSize: 10 }}
                              tickFormatter={(v) => fmt(v)}
                              width={45}
                            />
                            <Tooltip content={<ChartTooltip fmtFn={fmt} />} />
                            <Bar
                              dataKey="amount"
                              name="Expenses"
                              fill="#ef4444"
                              radius={[4, 4, 0, 0]}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}

                    {/* Category donut */}
                    {categoryChartData?.length > 0 && (
                      <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                        <p className="text-sm font-semibold text-white mb-0.5">
                          By Category
                        </p>
                        <p className="text-xs text-slate-400 mb-2">
                          Spend distribution
                        </p>
                        <ResponsiveContainer width="100%" height={200}>
                          <PieChart>
                            <Pie
                              data={categoryChartData}
                              cx="50%"
                              cy="50%"
                              innerRadius={45}
                              outerRadius={70}
                              paddingAngle={3}
                              dataKey="value"
                              nameKey="name"
                            >
                              {categoryChartData.map((_, i) => (
                                <Cell
                                  key={i}
                                  fill={CHART_COLORS[i % CHART_COLORS.length]}
                                />
                              ))}
                            </Pie>
                            <Tooltip content={<ChartTooltip fmtFn={fmt} />} />
                            <Legend
                              iconType="circle"
                              iconSize={7}
                              wrapperStyle={{
                                fontSize: "10px",
                                color: "#94a3b8",
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                  </div>
                )}

              {/* Category breakdown + Top expenses */}
              {(categoryChartData?.length > 0 || topExpenses?.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {/* Category horizontal bars */}
                  {categoryChartData?.length > 0 && (
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                      <p className="text-sm font-semibold text-white mb-0.5 flex items-center gap-2">
                        <Tag className="h-4 w-4 text-yellow-400" />
                        Category Breakdown
                      </p>
                      <p className="text-xs text-slate-400 mb-1">
                        Share of total spend
                      </p>
                      <div className="space-y-3 mt-3">
                        {categoryChartData.map((cat, i) => (
                          <div key={cat.name}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-300 capitalize">
                                {cat.name}
                              </span>
                              <span className="text-red-400 font-semibold">
                                {fmtFull(cat.value)}{" "}
                                <span className="text-slate-500">
                                  (
                                  {(
                                    (cat.value / data.stats.totalAmount) *
                                    100
                                  ).toFixed(0)}
                                  %)
                                </span>
                              </span>
                            </div>
                            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{
                                  width: `${(cat.value / data.stats.totalAmount) * 100}%`,
                                  backgroundColor:
                                    CHART_COLORS[i % CHART_COLORS.length],
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top individual expenses */}
                  {topExpenses?.length > 0 && (
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                      <p className="text-sm font-semibold text-white mb-0.5 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-red-400" />
                        Largest Expenses
                      </p>
                      <p className="text-xs text-slate-400 mb-1">
                        Top transactions by amount
                      </p>
                      <HorizontalBar
                        items={topExpenses}
                        valueKey="amount"
                        labelKey="name"
                        formatVal={fmtFull}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Expenses table */}
              {data.expenses.length > 0 ? (
                <Section
                  title={`All Expenses  ·  ${data.expenses.length}`}
                  icon={FileText}
                  accent="red"
                >
                  <div className="overflow-x-auto mt-3">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-xs text-slate-500 uppercase border-b border-slate-700">
                          <th className="pb-2 text-left">Date</th>
                          <th className="pb-2 text-left">Description</th>
                          <th className="pb-2 text-left">Category</th>
                          <th className="pb-2 text-left">Reference</th>
                          <th className="pb-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {data.expenses.map((exp) => (
                          <tr key={exp._id} className="hover:bg-slate-700/30">
                            <td className="py-2 text-slate-400 whitespace-nowrap">
                              {fmtDate(exp.date)}
                            </td>
                            <td className="py-2 text-slate-200">
                              <div>{exp.description}</div>
                              {exp.notes && (
                                <div className="text-xs text-slate-500 mt-0.5">
                                  {exp.notes}
                                </div>
                              )}
                            </td>
                            <td className="py-2">
                              <span className="px-2 py-0.5 bg-slate-700 text-slate-300 rounded text-xs capitalize">
                                {exp.category}
                              </span>
                            </td>
                            <td className="py-2 text-slate-400 font-mono text-xs">
                              {exp.reference || "-"}
                            </td>
                            <td className="py-2 text-right text-red-400 font-semibold whitespace-nowrap">
                              {fmtFull(exp.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-slate-600">
                          <td
                            colSpan={4}
                            className="pt-2 text-xs text-slate-500 uppercase font-medium"
                          >
                            Total
                          </td>
                          <td className="pt-2 text-right text-red-400 font-bold">
                            {fmtFull(data.stats.totalAmount)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Edit history */}
                  {data.expenses.some((e) => e.editHistory?.length > 0) && (
                    <div className="mt-4 pt-4 border-t border-slate-700">
                      <p className="text-xs text-slate-500 uppercase font-medium mb-2">
                        Edit History
                      </p>
                      <div className="space-y-1.5">
                        {data.expenses
                          .filter((e) => e.editHistory?.length > 0)
                          .flatMap((e) =>
                            e.editHistory.map((h) => ({
                              ...h,
                              expenseDesc: e.description,
                            })),
                          )
                          .sort(
                            (a, b) =>
                              new Date(b.editedAt) - new Date(a.editedAt),
                          )
                          .slice(0, 10)
                          .map((h, i) => (
                            <div
                              key={i}
                              className="text-xs text-slate-400 flex gap-2 flex-wrap"
                            >
                              <span className="text-slate-500">
                                {fmtDate(h.editedAt)}
                              </span>
                              <span className="text-slate-300">
                                {h.editedBy}
                              </span>
                              <span>edited &quot;{h.expenseDesc}&quot;:</span>
                              <span className="text-slate-300 italic">
                                {h.reason}
                              </span>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </Section>
              ) : (
                <div className="text-center py-10 text-slate-500 text-sm">
                  No expenses found for this vendor.
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-slate-700 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default VendorDetailModal;
