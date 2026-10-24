import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { formatCurrency } from "../utils/currency";

const CustomTooltip = ({ active, payload, settings }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 p-3 border border-slate-800 rounded shadow-lg">
        <p className="text-sm font-medium text-slate-300">
          {payload[0].payload.name}
        </p>
        <p className="text-sm text-blue-400 font-semibold">
          Sales: {formatCurrency(payload[0].value, settings)}
        </p>
      </div>
    );
  }
  return null;
};

const SalesChart = ({ data, settings, period }) => {
  const chartTitles = {
    "7d": "Sales - Last 7 Days",
    month: "Sales - Last 30 Days",
    year: "Sales - Last 12 Months",
    all: "Sales - All Time",
  };
  const title = chartTitles[period] || "Sales";

  // Avoid overprinting x-axis labels for dense periods
  const xAxisProps =
    period === "month"
      ? { interval: 4, angle: -35, textAnchor: "end", height: 50 }
      : period === "7d" || period === "year"
        ? { interval: 0, angle: -35, textAnchor: "end", height: 50 }
        : { interval: "preserveStartEnd" };

  return (
    <div className="bg-slate-900 p-6 rounded-lg shadow border border-slate-800">
      <h3 className="text-lg font-bold text-white mb-4">{title}</h3>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data || []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
            <XAxis dataKey="name" stroke="#94a3b8" {...xAxisProps} />
            <YAxis stroke="#94a3b8" />
            <Tooltip content={<CustomTooltip settings={settings} />} />
            <Line
              type="monotone"
              dataKey="sales"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={{ fill: "#3b82f6", strokeWidth: 2 }}
              activeDot={{ r: 8 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SalesChart;
