const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/authMiddleware");
const { getTenantModels } = require("../models/tenantModels");

/**
 * Compute UTC start/end dates for a given period.
 * Returns { start, end } where end may be undefined for "all".
 */
function getPeriodRange(period) {
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  if (period === "7d") {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    start.setHours(0, 0, 0, 0);
    return { start, end: endOfToday };
  }
  if (period === "month") {
    // Last 30 days (rolling)
    const start = new Date(now);
    start.setDate(now.getDate() - 29);
    start.setHours(0, 0, 0, 0);
    return { start, end: endOfToday };
  }
  if (period === "year") {
    // Last 12 months (rolling)
    const start = new Date(now);
    start.setMonth(now.getMonth() - 11);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return { start, end: endOfToday };
  }
  // "all" - no range
  return {};
}

// @desc    Get dashboard statistics
// @route   GET /api/dashboard/stats?period=7d|month|year|all
// @access  Private
router.get("/stats", protect, async (req, res) => {
  try {
    const { Payment, Invoice, Customer, Product, Expense } = getTenantModels(
      req.dbConnection,
    );

    const { period = "month" } = req.query;
    const { start, end } = getPeriodRange(period);

    // Build match filters
    // Only count active (non-refunded, non-deleted) payments as revenue
    const paymentMatch = { status: "active" };
    if (start) paymentMatch.date = { $gte: start, $lte: end };

    const expenseMatch = {};
    if (start) expenseMatch.date = { $gte: start, $lte: end };

    // Exclude deleted and cancelled invoices; only count invoices with at
    // least 1 payment as an "order"; use invoiceDate for period filtering
    const invoiceMatch = {
      status: { $nin: ["deleted", "cancelled"] },
      amountPaid: { $gt: 0 },
    };
    if (start) invoiceMatch.invoiceDate = { $gte: start, $lte: end };

    // Period sales - use find() + reduce for reliability
    const periodPayments = await Payment.find(paymentMatch)
      .select("amount")
      .lean();
    const periodSales = periodPayments.reduce(
      (sum, p) => sum + (p.amount || 0),
      0,
    );

    // Period orders
    const periodOrders = await Invoice.countDocuments(invoiceMatch);

    // Period expenses - use find() + reduce for reliability
    const periodExpensesDocs = await Expense.find(expenseMatch)
      .select("amount")
      .lean();
    const periodExpenses = periodExpensesDocs.reduce(
      (sum, e) => sum + (e.amount || 0),
      0,
    );

    const periodNetProfit = periodSales - periodExpenses;

    // All-time counts (not time-filtered)
    const totalCustomers = await Customer.countDocuments();
    const totalProducts = await Product.countDocuments();

    // Outstanding receivables (all-time snapshot, not period-filtered)
    const outstandingStatuses = ["overdue", "partially_paid", "sent", "draft"];
    const outstandingInvoices = await Invoice.find({
      status: { $in: outstandingStatuses },
    })
      .select("total amountPaid balanceDue status dueDate")
      .lean();

    const now = new Date();
    let totalOutstanding = 0;
    let overdueOutstanding = 0;
    let overdueCount = 0;
    for (const inv of outstandingInvoices) {
      const balanceDue = inv.balanceDue ?? inv.total - (inv.amountPaid || 0);
      totalOutstanding += balanceDue;
      const isOverdue =
        inv.status === "overdue" ||
        (inv.dueDate && new Date(inv.dueDate) < now);
      if (isOverdue) {
        overdueOutstanding += balanceDue;
        overdueCount += 1;
      }
    }

    res.json({
      periodSales,
      periodOrders,
      periodExpenses,
      periodNetProfit,
      totalCustomers,
      totalProducts,
      totalOutstanding,
      overdueOutstanding,
      overdueCount,
    });
  } catch (error) {
    console.error("Dashboard Stats Error:", error);
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get sales chart data
// @route   GET /api/dashboard/chart?period=7d|month|year|all
// @access  Private
router.get("/chart", protect, async (req, res) => {
  try {
    const { Payment } = getTenantModels(req.dbConnection);
    const { period = "month" } = req.query;

    const now = new Date();
    const { start, end } = getPeriodRange(period);

    const matchStage = { status: "active" };
    if (start) matchStage.date = { $gte: start, $lte: end };

    // Choose mongo date format
    const groupFormat =
      period === "all" ? "%Y" : period === "year" ? "%Y-%m" : "%Y-%m-%d";

    const sales = await Payment.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: "$date" } },
          sales: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const salesMap = {};
    sales.forEach((s) => {
      salesMap[s._id] = s.sales;
    });

    const chartData = [];

    const monthNames = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    if (period === "7d") {
      // Last 7 days: one point per day
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        const label = `${monthNames[d.getMonth()]} ${d.getDate()}`;
        chartData.push({
          name: label,
          date: dateStr,
          sales: salesMap[dateStr] || 0,
        });
      }
    } else if (period === "month") {
      // Last 30 days: one point per day
      for (let i = 29; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const dateStr = d.toISOString().split("T")[0];
        const label = `${monthNames[d.getMonth()]} ${d.getDate()}`;
        chartData.push({
          name: label,
          date: dateStr,
          sales: salesMap[dateStr] || 0,
        });
      }
    } else if (period === "year") {
      // Last 12 months: one point per month (rolling)
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
        chartData.push({ name: label, date: key, sales: salesMap[key] || 0 });
      }
    } else {
      // all - group by year
      sales.forEach((s) => {
        chartData.push({ name: s._id, date: s._id, sales: s.sales });
      });
    }

    res.json(chartData);
  } catch (error) {
    console.error("Dashboard Chart Error:", error);
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get recent activities
// @route   GET /api/dashboard/activities
// @access  Private
router.get("/activities", protect, async (req, res) => {
  try {
    const { ActivityLog } = getTenantModels(req.dbConnection);

    const logs = await ActivityLog.find({})
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .limit(5);

    res.json(logs);
  } catch (error) {
    console.error("Dashboard Activities Error:", error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
