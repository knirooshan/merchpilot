const { getTenantModels } = require("../models/tenantModels");
const {
  parseStartOfDay,
  parseEndOfDay,
  getTenantTimezone,
} = require("../utils/dateUtils");

// @desc    Get Dashboard Stats
// @route   GET /api/reports/dashboard
// @access  Private
const getDashboardStats = async (req, res) => {
  try {
    if (!req.dbConnection) {
      return res.status(500).json({ message: "No Database Connection" });
    }

    const { Invoice, Expense, Payment } = getTenantModels(req.dbConnection);
    const { startDate, endDate } = req.query;

    const allowedStatuses = [
      "paid",
      "partially_paid",
      "overdue",
      "written-off",
    ];

    // Get valid invoice IDs for filtering payments - only invoices that have
    // received at least 1 payment count as an "order" (written-off invoices
    // only count if they were paid at least once before being written off)
    const validInvoices = await Invoice.find({
      status: { $in: allowedStatuses },
      amountPaid: { $gt: 0 },
    }).select("_id");
    const validInvoiceIds = validInvoices.map((inv) => inv._id);

    const dateFilter = {};
    if (startDate || endDate) {
      const timezone = await getTenantTimezone(req.dbConnection);
      dateFilter.date = {};
      if (startDate)
        dateFilter.date.$gte = parseStartOfDay(startDate, timezone);
      if (endDate) dateFilter.date.$lte = parseEndOfDay(endDate, timezone);
    }

    // Calculate Total Sales (sum of all non-deleted payments related to valid invoices)
    const salesResult = await Payment.aggregate([
      {
        $match: {
          status: "active",
          invoice: { $in: validInvoiceIds },
          ...dateFilter,
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalSales = salesResult.length > 0 ? salesResult[0].total : 0;

    // Calculate Total Expenses
    const expensesResult = await Expense.aggregate([
      { $match: dateFilter },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);
    const totalExpenses =
      expensesResult.length > 0 ? expensesResult[0].total : 0;

    // Calculate Net Profit
    const netProfit = totalSales - totalExpenses;

    // Recent Invoices (filtered by allowed statuses)
    const recentInvoices = await Invoice.find({
      status: { $in: allowedStatuses },
    })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate("customer", "firstName lastName billing");

    // Outstanding receivables (all-time snapshot, not date-filtered)
    const outstandingStatuses = ["overdue", "partially_paid", "sent", "draft"];
    const outstandingInvoices = await Invoice.find({
      status: { $in: outstandingStatuses },
    })
      .select("total amountPaid balanceDue")
      .lean();
    const totalOutstanding = outstandingInvoices.reduce(
      (sum, inv) => sum + (inv.balanceDue ?? inv.total - (inv.amountPaid || 0)),
      0,
    );

    res.json({
      totalSales,
      totalExpenses,
      netProfit,
      totalOutstanding,
      recentInvoices,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Sales Report (Flexible Timeframe)
// @route   GET /api/reports/sales
// @access  Private
const getSalesReport = async (req, res) => {
  try {
    const { Expense, Payment, Invoice } = getTenantModels(req.dbConnection);
    const { timeframe = "monthly", startDate, endDate } = req.query;

    const allowedStatuses = [
      "paid",
      "partially_paid",
      "overdue",
      "written-off",
    ];

    // Get valid invoice IDs for filtering payments - only invoices that have
    // received at least 1 payment count as an "order" (written-off invoices
    // only count if they were paid at least once before being written off)
    const validInvoices = await Invoice.find({
      status: { $in: allowedStatuses },
      amountPaid: { $gt: 0 },
    }).select("_id");
    const validInvoiceIds = validInvoices.map((inv) => inv._id);

    const timezone =
      startDate || endDate ? await getTenantTimezone(req.dbConnection) : "UTC";
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.date = {};
      if (startDate)
        dateFilter.date.$gte = parseStartOfDay(startDate, timezone);
      if (endDate) dateFilter.date.$lte = parseEndOfDay(endDate, timezone);
    }

    let dateFormat;
    switch (timeframe) {
      case "daily":
        dateFormat = "%Y-%m-%d";
        break;
      case "weekly":
        dateFormat = "%Y-W%V"; // Year and Week number
        break;
      case "yearly":
        dateFormat = "%Y";
        break;
      case "monthly":
      default:
        dateFormat = "%Y-%m";
        break;
    }

    // 1. Get Sales (from payments related to valid invoices)
    const sales = await Payment.aggregate([
      {
        $match: {
          status: "active",
          invoice: { $in: validInvoiceIds },
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: "$date" } },
          sales: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // 2. Get Expenses
    const expenses = await Expense.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: "$date" } },
          expenses: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // 3. Merge Data
    const mergedData = {};

    sales.forEach((item) => {
      if (!mergedData[item._id]) {
        mergedData[item._id] = { name: item._id, sales: 0, expenses: 0 };
      }
      mergedData[item._id].sales = item.sales;
    });

    expenses.forEach((item) => {
      if (!mergedData[item._id]) {
        mergedData[item._id] = { name: item._id, sales: 0, expenses: 0 };
      }
      mergedData[item._id].expenses = item.expenses;
    });

    // Convert to array and calculate profit
    const chartData = Object.values(mergedData)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => ({
        ...item,
        profit: item.sales - item.expenses,
      }));

    // 4. Get Raw Sales List (filtered by valid invoices)
    const salesList = await Payment.find({
      status: "active",
      invoice: { $in: validInvoiceIds },
      ...dateFilter,
    })
      .sort({ date: -1 })
      .populate("customer", "firstName lastName billing")
      .populate("invoice", "invoiceNumber");

    // Accurate order count = distinct invoices with >=1 payment (not raw payment count)
    const orderCount = new Set(
      salesList.filter((p) => p.invoice).map((p) => p.invoice._id.toString()),
    ).size;

    // 5. Product Breakdown (from Invoices in the same period)
    // Adjust dateFilter for Invoice (using invoiceDate)
    const invoiceDateFilter = {};
    if (startDate || endDate) {
      invoiceDateFilter.invoiceDate = {};
      if (startDate)
        invoiceDateFilter.invoiceDate.$gte = parseStartOfDay(
          startDate,
          timezone,
        );
      if (endDate)
        invoiceDateFilter.invoiceDate.$lte = parseEndOfDay(endDate, timezone);
    }

    const productBreakdown = await Invoice.aggregate([
      { $match: { _id: { $in: validInvoiceIds }, ...invoiceDateFilter } },
      { $unwind: "$items" },
      {
        $group: {
          _id: { $ifNull: ["$items.product", "$items.name"] },
          name: { $first: "$items.name" },
          sku: { $first: "$items.sku" },
          quantity: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.total" },
          avgPrice: { $avg: "$items.price" },
        },
      },
      { $sort: { quantity: -1 } },
    ]);

    res.json({
      chartData,
      salesList,
      orderCount,
      productBreakdown,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Profit & Loss Detailed Report
// @route   GET /api/reports/profit-loss
// @access  Private
const getProfitLossReport = async (req, res) => {
  try {
    const { Expense, Payment, Invoice } = getTenantModels(req.dbConnection);
    const { timeframe = "monthly", startDate, endDate } = req.query;

    const allowedStatuses = [
      "paid",
      "partially_paid",
      "overdue",
      "written-off",
    ];

    // Get valid invoice IDs for filtering payments - only invoices that have
    // received at least 1 payment count as an "order" (written-off invoices
    // only count if they were paid at least once before being written off)
    const validInvoices = await Invoice.find({
      status: { $in: allowedStatuses },
      amountPaid: { $gt: 0 },
    }).select("_id");
    const validInvoiceIds = validInvoices.map((inv) => inv._id);

    const timezone =
      startDate || endDate ? await getTenantTimezone(req.dbConnection) : "UTC";
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.date = {};
      if (startDate)
        dateFilter.date.$gte = parseStartOfDay(startDate, timezone);
      if (endDate) dateFilter.date.$lte = parseEndOfDay(endDate, timezone);
    }

    // 1. Get Aggregated Data (for chart)
    let dateFormat;
    switch (timeframe) {
      case "daily":
        dateFormat = "%Y-%m-%d";
        break;
      case "weekly":
        dateFormat = "%Y-W%V";
        break;
      case "yearly":
        dateFormat = "%Y";
        break;
      case "monthly":
      default:
        dateFormat = "%Y-%m";
        break;
    }

    const salesAgg = await Payment.aggregate([
      {
        $match: {
          status: "active",
          invoice: { $in: validInvoiceIds },
          ...dateFilter,
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: "$date" } },
          sales: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const expensesAgg = await Expense.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: { $dateToString: { format: dateFormat, date: "$date" } },
          expenses: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const mergedData = {};
    salesAgg.forEach((item) => {
      mergedData[item._id] = { name: item._id, sales: item.sales, expenses: 0 };
    });
    expensesAgg.forEach((item) => {
      if (!mergedData[item._id]) {
        mergedData[item._id] = { name: item._id, sales: 0, expenses: 0 };
      }
      mergedData[item._id].expenses = item.expenses;
    });

    const chartData = Object.values(mergedData)
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((item) => ({
        ...item,
        profit: item.sales - item.expenses,
      }));

    // 2. Get Raw Lists (filtered by valid invoices)
    const payments = await Payment.find({
      status: "active",
      invoice: { $in: validInvoiceIds },
      ...dateFilter,
    })
      .sort({ date: -1 })
      .populate("customer", "firstName lastName billing")
      .populate("invoice", "invoiceNumber");

    const expenses = await Expense.find(dateFilter).sort({ date: -1 });

    res.json({
      chartData,
      payments,
      expenses,
      summary: {
        totalSales: chartData.reduce((sum, i) => sum + i.sales, 0),
        totalExpenses: chartData.reduce((sum, i) => sum + i.expenses, 0),
        netProfit: chartData.reduce((sum, i) => sum + i.profit, 0),
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get Outstanding Invoices Summary
// @route   GET /api/reports/outstanding
// @access  Private
const getOutstandingSummary = async (req, res) => {
  try {
    const { Invoice } = getTenantModels(req.dbConnection);
    const { startDate, endDate, customer, status } = req.query;

    const allowedStatuses = ["overdue", "partially_paid", "sent", "draft"];
    const filter = {
      status:
        status && allowedStatuses.includes(status)
          ? status
          : { $in: allowedStatuses },
    };

    // Filter by customer
    if (customer && customer !== "all") {
      const mongoose = require("mongoose");
      filter.customer = new mongoose.Types.ObjectId(customer);
    }

    // Filter by invoice date range
    if (startDate || endDate) {
      const timezone = await getTenantTimezone(req.dbConnection);
      filter.invoiceDate = {};
      if (startDate)
        filter.invoiceDate.$gte = parseStartOfDay(startDate, timezone);
      if (endDate) filter.invoiceDate.$lte = parseEndOfDay(endDate, timezone);
    }

    const invoices = await Invoice.find(filter)
      .populate("customer", "firstName lastName email billing")
      .sort({ dueDate: 1 });

    const now = new Date();

    // Enrich each invoice with computed fields
    const enriched = invoices.map((inv) => {
      const balanceDue = inv.balanceDue ?? inv.total - (inv.amountPaid || 0);
      const dueDateVal = inv.dueDate ? new Date(inv.dueDate) : null;
      const daysOverdue =
        dueDateVal && dueDateVal < now
          ? Math.floor((now - dueDateVal) / (1000 * 60 * 60 * 24))
          : 0;
      return {
        _id: inv._id,
        invoiceNumber: inv.invoiceNumber,
        taxInvoiceNumber: inv.taxInvoiceNumber,
        customer: inv.customer,
        customerInfo: inv.customerInfo,
        invoiceDate: inv.invoiceDate,
        dueDate: inv.dueDate,
        total: inv.total,
        amountPaid: inv.amountPaid || 0,
        balanceDue,
        status: inv.status,
        daysOverdue,
        currency: inv.currency,
      };
    });

    // Per-customer aggregation
    const customerMap = {};
    for (const inv of enriched) {
      const custId = inv.customer?._id?.toString() || "unknown";
      const custName = inv.customer
        ? `${inv.customer.firstName || ""} ${inv.customer.lastName || ""}`.trim() ||
          inv.customerInfo?.company ||
          "Unknown"
        : inv.customerInfo?.firstName
          ? `${inv.customerInfo.firstName} ${inv.customerInfo.lastName || ""}`.trim()
          : "Unknown";
      if (!customerMap[custId]) {
        customerMap[custId] = {
          customerId: custId,
          customerName: custName,
          email: inv.customer?.email || inv.customerInfo?.email || "",
          totalOutstanding: 0,
          invoiceCount: 0,
          overdueCount: 0,
        };
      }
      customerMap[custId].totalOutstanding += inv.balanceDue;
      customerMap[custId].invoiceCount += 1;
      if (inv.daysOverdue > 0) customerMap[custId].overdueCount += 1;
    }

    const customerSummary = Object.values(customerMap).sort(
      (a, b) => b.totalOutstanding - a.totalOutstanding,
    );

    // Summary totals
    const totalOutstanding = enriched.reduce((s, i) => s + i.balanceDue, 0);
    const overdueCount = enriched.filter(
      (i) => i.status === "overdue" || i.daysOverdue > 0,
    ).length;
    const partiallyPaidCount = enriched.filter(
      (i) => i.status === "partially_paid",
    ).length;
    const customersWithDebt = customerSummary.length;

    res.json({
      invoices: enriched,
      customerSummary,
      summary: {
        totalOutstanding,
        overdueCount,
        partiallyPaidCount,
        customersWithDebt,
        totalInvoices: enriched.length,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getDashboardStats,
  getSalesReport,
  getProfitLossReport,
  getOutstandingSummary,
};
