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
  ShoppingCart,
  CreditCard,
  Package,
  TrendingUp,
  Hash,
  Calendar,
  ChevronDown,
  ChevronUp,
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
} from "recharts";
import { formatCurrency } from "../utils/currency";

/* ─── helpers ─────────────────────────────────────────────────── */
// fmt / fmtFull are created inside the component via useCurrencyFmt().
// The hook reads state.settings so amounts use the store's configured symbol.
const useCurrencyFmt = () => {
  const { data: settings } = useSelector((state) => state.settings);
  const fmt = (n) => {
    const s = formatCurrency(n || 0, settings);
    // strip decimals for compact display
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
  "#3b82f6",
  "#22c55e",
  "#a855f7",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#ec4899",
  "#84cc16",
];

const STATUS_COLORS = {
  paid: "#22c55e",
  partially_paid: "#f59e0b",
  overdue: "#ef4444",
  sent: "#3b82f6",
  draft: "#64748b",
  cancelled: "#dc2626",
  "written-off": "#a855f7",
  refunded: "#8b5cf6",
};

/* ─── shared atoms ─────────────────────────────────────────────── */
const StatusBadge = ({ status }) => {
  const palette = {
    paid: "bg-green-900 text-green-300",
    partially_paid: "bg-yellow-900 text-yellow-300",
    overdue: "bg-red-900 text-red-300",
    sent: "bg-blue-900 text-blue-300",
    draft: "bg-slate-700 text-slate-300",
    cancelled: "bg-red-900 text-red-300",
    "written-off": "bg-purple-900 text-purple-300",
    completed: "bg-green-900 text-green-300",
    processing: "bg-blue-900 text-blue-300",
    pending: "bg-yellow-900 text-yellow-300",
    refunded: "bg-purple-900 text-purple-300",
    failed: "bg-red-900 text-red-300",
    accepted: "bg-green-900 text-green-300",
    rejected: "bg-red-900 text-red-300",
    expired: "bg-orange-900 text-orange-300",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${palette[status] || "bg-slate-700 text-slate-300"}`}
    >
      {status?.replace(/_/g, " ")}
    </span>
  );
};
const Section = ({
  title,
  icon: Icon,
  children,
  defaultOpen = true,
  accent = "blue",
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const accentColor =
    {
      blue: "text-blue-400",
      green: "text-green-400",
      purple: "text-purple-400",
      yellow: "text-yellow-400",
    }[accent] || "text-blue-400";
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

const StatCard = ({ label, value, sub, color = "blue" }) => {
  const palette = {
    blue: { border: "border-blue-500", text: "text-blue-400" },
    green: { border: "border-green-500", text: "text-green-400" },
    yellow: { border: "border-yellow-500", text: "text-yellow-400" },
    red: { border: "border-red-500", text: "text-red-400" },
    purple: { border: "border-purple-500", text: "text-purple-400" },
  };
  const c = palette[color] || palette.blue;
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
  valueKey = "total",
  labelKey = "name",
  formatVal,
}) => {
  const max = Math.max(...items.map((i) => i[valueKey] || 0), 1);
  return (
    <div className="space-y-3 mt-2">
      {items.map((item, i) => (
        <div key={i}>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-slate-300 truncate max-w-[65%]">
              {item[labelKey]}
            </span>
            <span className="text-slate-400 font-semibold">
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

const PaidVsBalance = ({ paid, balance, fmtFull }) => {
  const total = paid + balance;
  const paidPct = total ? (paid / total) * 100 : 100;
  return (
    <div className="mt-2">
      <div className="flex justify-between text-xs text-slate-400 mb-1.5">
        <span>
          Paid{" "}
          <span className="text-green-400 font-semibold">{fmtFull(paid)}</span>
        </span>
        <span>
          Outstanding{" "}
          <span className="text-yellow-400 font-semibold">
            {fmtFull(balance)}
          </span>
        </span>
      </div>
      <div className="h-3 bg-slate-700 rounded-full overflow-hidden flex">
        <div
          className="h-full bg-green-500 transition-all duration-500"
          style={{ width: `${paidPct}%` }}
        />
        {balance > 0 && <div className="h-full bg-yellow-500 flex-1" />}
      </div>
      <p className="text-xs text-slate-500 mt-1 text-right">
        {paidPct.toFixed(0)}% collected
      </p>
    </div>
  );
};

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT
══════════════════════════════════════════════════════════════════ */
const CustomerDetailModal = ({ customerId, onClose }) => {
  const { fmt, fmtFull } = useCurrencyFmt();

  const {
    data,
    isLoading: loading,
    error: queryError,
  } = useQuery({
    queryKey: ["customerSummary", customerId],
    queryFn: async () => {
      const res = await apiClient.get(ENDPOINTS.CUSTOMER_SUMMARY(customerId));
      return res.data;
    },
    enabled: !!customerId,
  });

  const error =
    queryError?.response?.data?.message || queryError?.message || null;

  const { monthlySpend, invoiceStatusData, paymentChannelData, topProducts } =
    useMemo(() => {
      if (!data) return {};

      // Monthly spend: combine invoices + orders grouped by year-month
      const monthMap = {};
      data.invoices.forEach((inv) => {
        if (!inv.invoiceDate) return;
        const d = new Date(inv.invoiceDate);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        });
        if (!monthMap[key])
          monthMap[key] = { key, label, invoices: 0, orders: 0 };
        monthMap[key].invoices += inv.total || 0;
      });
      data.orders.forEach((ord) => {
        const d = new Date(ord.dateCreated);
        if (isNaN(d)) return;
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleDateString("en-US", {
          month: "short",
          year: "2-digit",
        });
        if (!monthMap[key])
          monthMap[key] = { key, label, invoices: 0, orders: 0 };
        monthMap[key].orders += ord.total || 0;
      });
      const monthlySpend = Object.values(monthMap)
        .sort((a, b) => a.key.localeCompare(b.key))
        .slice(-12);

      // Invoice status donut
      const statusMap = {};
      data.invoices.forEach((inv) => {
        statusMap[inv.status] = (statusMap[inv.status] || 0) + 1;
      });
      const invoiceStatusData = Object.entries(statusMap).map(
        ([name, value]) => ({ name, value }),
      );

      // Payment channels donut
      const paymentChannelData = Object.entries(data.paymentChannels).map(
        ([name, value]) => ({ name, value }),
      );

      // Top products by revenue
      const topProducts = [...data.productsBought]
        .sort((a, b) => b.total - a.total)
        .slice(0, 8);

      return {
        monthlySpend,
        invoiceStatusData,
        paymentChannelData,
        topProducts,
      };
    }, [data]);

  const customerName = data
    ? `${data.customer.salutation ? data.customer.salutation + " " : ""}${data.customer.firstName || ""} ${data.customer.lastName || ""}`.trim() ||
    data.customer.billing?.company ||
    "Unnamed Customer"
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-slate-900 rounded-xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col border border-slate-700">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-700 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-lg shadow-lg">
              {loading ? "?" : customerName.charAt(0).toUpperCase() || "?"}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">
                {loading ? "Loading…" : customerName}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Customer Profile</p>
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
              Loading customer details…
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
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard
                  label="Orders"
                  value={data.stats.totalOrders}
                  sub={fmt(data.stats.totalOrderValue) + " total"}
                  color="blue"
                />
                <StatCard
                  label="Invoices"
                  value={data.stats.totalInvoices}
                  sub={fmt(data.stats.totalInvoiceValue) + " total"}
                  color="purple"
                />
                <StatCard
                  label="Total Paid"
                  value={fmt(data.stats.totalPaid)}
                  sub={`${data.stats.totalPayments} payment(s)`}
                  color="green"
                />
                <StatCard
                  label="Balance Due"
                  value={fmt(data.stats.totalBalanceDue)}
                  sub="outstanding"
                  color={data.stats.totalBalanceDue > 0 ? "red" : "green"}
                />
              </div>

              {/* Collection rate gauge */}
              {(data.stats.totalPaid > 0 || data.stats.totalBalanceDue > 0) && (
                <div className="bg-slate-800 rounded-xl border border-slate-700 px-5 py-4">
                  <p className="text-xs text-slate-400 uppercase font-medium mb-1">
                    Collection Rate
                  </p>
                  <PaidVsBalance
                    paid={data.stats.totalPaid}
                    balance={data.stats.totalBalanceDue}
                    fmtFull={fmtFull}
                  />
                </div>
              )}

              {/* Customer info */}
              <Section title="Customer Information" icon={User} accent="blue">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2.5 mt-3 text-sm">
                  {data.customer.email && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <Mail className="h-4 w-4 text-slate-500 shrink-0" />
                      {data.customer.email}
                    </div>
                  )}
                  {data.customer.billing?.phone && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <Phone className="h-4 w-4 text-slate-500 shrink-0" />
                      {data.customer.billing.phone}
                    </div>
                  )}
                  {data.customer.billing?.company && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <Building2 className="h-4 w-4 text-slate-500 shrink-0" />
                      {data.customer.billing.company}
                    </div>
                  )}
                  {data.customer.taxNumber && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <Hash className="h-4 w-4 text-slate-500 shrink-0" />
                      Tax No: {data.customer.taxNumber}
                    </div>
                  )}
                  {data.customer.username && (
                    <div className="flex items-center gap-2 text-slate-300">
                      <User className="h-4 w-4 text-slate-500 shrink-0" />@
                      {data.customer.username}
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-slate-300">
                    <Calendar className="h-4 w-4 text-slate-500 shrink-0" />
                    Customer since {fmtDate(data.customer.createdAt)}
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                  {data.customer.billing && (
                    <div className="bg-slate-900 rounded-lg p-3">
                      <p className="text-xs text-slate-500 uppercase font-medium mb-2 flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        Billing
                      </p>
                      <div className="text-sm text-slate-300 space-y-0.5">
                        {[
                          [
                            data.customer.billing.first_name,
                            data.customer.billing.last_name,
                          ]
                            .filter(Boolean)
                            .join(" "),
                          data.customer.billing.address_1,
                          data.customer.billing.address_2,
                          [
                            data.customer.billing.city,
                            data.customer.billing.state,
                            data.customer.billing.postcode,
                          ]
                            .filter(Boolean)
                            .join(", "),
                          data.customer.billing.country,
                        ]
                          .filter(Boolean)
                          .map((l, i) => (
                            <p key={i}>{l}</p>
                          ))}
                      </div>
                    </div>
                  )}
                  {data.customer.shipping &&
                    Object.values(data.customer.shipping).some(Boolean) && (
                      <div className="bg-slate-900 rounded-lg p-3">
                        <p className="text-xs text-slate-500 uppercase font-medium mb-2 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          Shipping
                        </p>
                        <div className="text-sm text-slate-300 space-y-0.5">
                          {[
                            [
                              data.customer.shipping.first_name,
                              data.customer.shipping.last_name,
                            ]
                              .filter(Boolean)
                              .join(" "),
                            data.customer.shipping.address_1,
                            data.customer.shipping.address_2,
                            [
                              data.customer.shipping.city,
                              data.customer.shipping.state,
                              data.customer.shipping.postcode,
                            ]
                              .filter(Boolean)
                              .join(", "),
                            data.customer.shipping.country,
                          ]
                            .filter(Boolean)
                            .map((l, i) => (
                              <p key={i}>{l}</p>
                            ))}
                        </div>
                      </div>
                    )}
                </div>
              </Section>

              {/* Charts - Monthly spend + Invoice status */}
              {(monthlySpend?.length > 0 || invoiceStatusData?.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                  {monthlySpend?.length > 0 && (
                    <div className="lg:col-span-2 bg-slate-800 rounded-xl border border-slate-700 p-5">
                      <p className="text-sm font-semibold text-white mb-0.5">
                        Revenue Over Time
                      </p>
                      <p className="text-xs text-slate-400 mb-4">
                        Monthly invoiced + order value
                      </p>
                      <ResponsiveContainer width="100%" height={200}>
                        <BarChart data={monthlySpend} barGap={2}>
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
                          <Legend
                            iconSize={8}
                            wrapperStyle={{ fontSize: "11px" }}
                          />
                          <Bar
                            dataKey="invoices"
                            name="Invoices"
                            fill="#a855f7"
                            radius={[3, 3, 0, 0]}
                          />
                          <Bar
                            dataKey="orders"
                            name="Orders"
                            fill="#3b82f6"
                            radius={[3, 3, 0, 0]}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {invoiceStatusData?.length > 0 && (
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                      <p className="text-sm font-semibold text-white mb-0.5">
                        Invoice Status
                      </p>
                      <p className="text-xs text-slate-400 mb-2">
                        Distribution by count
                      </p>
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={invoiceStatusData}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={70}
                            paddingAngle={3}
                            dataKey="value"
                            nameKey="name"
                          >
                            {invoiceStatusData.map((entry, i) => (
                              <Cell
                                key={i}
                                fill={
                                  STATUS_COLORS[entry.name] ||
                                  CHART_COLORS[i % CHART_COLORS.length]
                                }
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

              {/* Payment channels + Top products */}
              {(paymentChannelData?.length > 0 || topProducts?.length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {paymentChannelData?.length > 0 && (
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                      <p className="text-sm font-semibold text-white mb-0.5 flex items-center gap-2">
                        <CreditCard className="h-4 w-4 text-blue-400" />
                        Payment Channels
                      </p>
                      <p className="text-xs text-slate-400 mb-2">
                        Amount paid by method
                      </p>
                      <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                          <Pie
                            data={paymentChannelData}
                            cx="50%"
                            cy="50%"
                            outerRadius={80}
                            paddingAngle={3}
                            dataKey="value"
                            nameKey="name"
                          >
                            {paymentChannelData.map((_, i) => (
                              <Cell
                                key={i}
                                fill={CHART_COLORS[i % CHART_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <Tooltip content={<ChartTooltip fmtFn={fmt} />} />
                          <Legend
                            iconType="circle"
                            iconSize={8}
                            wrapperStyle={{
                              fontSize: "11px",
                              color: "#94a3b8",
                            }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {topProducts?.length > 0 && (
                    <div className="bg-slate-800 rounded-xl border border-slate-700 p-5">
                      <p className="text-sm font-semibold text-white mb-0.5 flex items-center gap-2">
                        <Package className="h-4 w-4 text-green-400" />
                        Top Products Purchased
                      </p>
                      <p className="text-xs text-slate-400 mb-1">
                        Ranked by spend
                      </p>
                      <HorizontalBar
                        items={topProducts}
                        valueKey="total"
                        labelKey="name"
                        formatVal={fmt}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Payments table */}
              {data.payments.length > 0 && (
                <Section
                  title={`Payments  ·  ${data.payments.length}`}
                  icon={CreditCard}
                  accent="green"
                >
                  <div className="overflow-x-auto mt-3">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-xs text-slate-500 uppercase border-b border-slate-700">
                          <th className="pb-2 text-left">Date</th>
                          <th className="pb-2 text-left">Method</th>
                          <th className="pb-2 text-left">Source</th>
                          <th className="pb-2 text-left">Reference</th>
                          <th className="pb-2 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {data.payments.map((p) => (
                          <tr key={p._id} className="hover:bg-slate-700/30">
                            <td className="py-2 text-slate-400">
                              {fmtDate(p.date)}
                            </td>
                            <td className="py-2 text-slate-200">{p.method}</td>
                            <td className="py-2 text-slate-400">{p.source}</td>
                            <td className="py-2 text-slate-400 font-mono text-xs">
                              {p.reference || "-"}
                            </td>
                            <td className="py-2 text-right text-green-400 font-semibold">
                              {fmtFull(p.amount)}
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
                            Total Paid
                          </td>
                          <td className="pt-2 text-right text-green-400 font-bold">
                            {fmtFull(data.stats.totalPaid)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </Section>
              )}

              {/* Invoices table */}
              {data.invoices.length > 0 && (
                <Section
                  title={`Invoices  ·  ${data.invoices.length}`}
                  icon={FileText}
                  accent="purple"
                  defaultOpen={false}
                >
                  <div className="overflow-x-auto mt-3">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-xs text-slate-500 uppercase border-b border-slate-700">
                          <th className="pb-2 text-left">Invoice #</th>
                          <th className="pb-2 text-left">Date</th>
                          <th className="pb-2 text-left">Due</th>
                          <th className="pb-2 text-left">Status</th>
                          <th className="pb-2 text-right">Total</th>
                          <th className="pb-2 text-right">Paid</th>
                          <th className="pb-2 text-right">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {data.invoices.map((inv) => (
                          <tr key={inv._id} className="hover:bg-slate-700/30">
                            <td className="py-2 text-blue-400 font-mono">
                              {inv.invoiceNumber}
                            </td>
                            <td className="py-2 text-slate-400">
                              {fmtDate(inv.invoiceDate)}
                            </td>
                            <td className="py-2 text-slate-400">
                              {fmtDate(inv.dueDate)}
                            </td>
                            <td className="py-2">
                              <StatusBadge status={inv.status} />
                            </td>
                            <td className="py-2 text-right text-slate-200">
                              {fmtFull(inv.total)}
                            </td>
                            <td className="py-2 text-right text-green-400">
                              {fmtFull(inv.amountPaid)}
                            </td>
                            <td className="py-2 text-right text-yellow-400">
                              {fmtFull(inv.balanceDue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              )}

              {/* Orders table */}
              {data.orders.length > 0 && (
                <Section
                  title={`Orders  ·  ${data.orders.length}`}
                  icon={ShoppingCart}
                  accent="blue"
                  defaultOpen={false}
                >
                  <div className="overflow-x-auto mt-3">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-xs text-slate-500 uppercase border-b border-slate-700">
                          <th className="pb-2 text-left">Order #</th>
                          <th className="pb-2 text-left">Date</th>
                          <th className="pb-2 text-left">Status</th>
                          <th className="pb-2 text-left">Payment</th>
                          <th className="pb-2 text-right">Items</th>
                          <th className="pb-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {data.orders.map((ord) => (
                          <tr key={ord._id} className="hover:bg-slate-700/30">
                            <td className="py-2 text-blue-400 font-mono">
                              {ord.orderNumber}
                            </td>
                            <td className="py-2 text-slate-400">
                              {fmtDate(ord.dateCreated)}
                            </td>
                            <td className="py-2">
                              <StatusBadge status={ord.status} />
                            </td>
                            <td className="py-2 text-slate-400">
                              {ord.paymentMethodTitle ||
                                ord.paymentMethod ||
                                "-"}
                            </td>
                            <td className="py-2 text-right text-slate-400">
                              {(ord.items || []).length}
                            </td>
                            <td className="py-2 text-right font-medium text-slate-200">
                              {fmtFull(ord.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              )}

              {/* Quotations table */}
              {data.quotations.length > 0 && (
                <Section
                  title={`Quotations  ·  ${data.quotations.length}`}
                  icon={TrendingUp}
                  accent="yellow"
                  defaultOpen={false}
                >
                  <div className="overflow-x-auto mt-3">
                    <table className="min-w-full text-sm">
                      <thead>
                        <tr className="text-xs text-slate-500 uppercase border-b border-slate-700">
                          <th className="pb-2 text-left">Quotation #</th>
                          <th className="pb-2 text-left">Date</th>
                          <th className="pb-2 text-left">Status</th>
                          <th className="pb-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {data.quotations.map((q) => (
                          <tr key={q._id} className="hover:bg-slate-700/30">
                            <td className="py-2 text-blue-400 font-mono">
                              {q.quotationNumber}
                            </td>
                            <td className="py-2 text-slate-400">
                              {fmtDate(q.createdAt)}
                            </td>
                            <td className="py-2">
                              <StatusBadge status={q.status} />
                            </td>
                            <td className="py-2 text-right font-medium text-slate-200">
                              {fmtFull(q.total)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Section>
              )}

              {data.orders.length === 0 &&
                data.invoices.length === 0 &&
                data.payments.length === 0 &&
                data.quotations.length === 0 && (
                  <div className="text-center py-10 text-slate-500 text-sm">
                    No transactions found for this customer.
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

export default CustomerDetailModal;
