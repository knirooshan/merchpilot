const { getTenantModels } = require("../models/tenantModels");

// @desc Update or create delivery status and tracking
// @route PUT /api/deliveries/invoice/:invoiceId
// @access Private
const updateDelivery = async (req, res) => {
  try {
    const { Delivery, Invoice } = getTenantModels(req.dbConnection);
    const invoiceId = req.params.invoiceId;

    // Verify invoice exists
    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    let delivery = await Delivery.findOne({ invoice: invoiceId });

    const { status, trackingNumbers, note, updatedBy } = req.body;

    if (!delivery) {
      delivery = new Delivery({
        invoice: invoiceId,
        status: status || "pending",
        trackingNumbers: trackingNumbers || [],
        lifecycle: [],
      });
    } else {
      if (status) delivery.status = status;
      if (trackingNumbers !== undefined) delivery.trackingNumbers = trackingNumbers;
    }

    // Add to lifecycle
    delivery.lifecycle.push({
      status: status || delivery.status,
      note: note || "",
      updatedBy: updatedBy || "System",
      timestamp: new Date(),
    });

    const savedDelivery = await delivery.save();
    res.json(savedDelivery);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc Get active delivery queue (with optional search and pagination)
// @route GET /api/deliveries/queue
// @access Private
const getDeliveryQueue = async (req, res) => {
  try {
    const { Delivery } = getTenantModels(req.dbConnection);
    const {
      search,
      status,
      page,
      limit,
      pageNumber,
      pageSize,
      paginate,
    } = req.query;

    const isPaginated =
      page !== undefined ||
      pageNumber !== undefined ||
      limit !== undefined ||
      pageSize !== undefined ||
      paginate === "true";

    const statusFilter =
      status && status !== "all"
        ? [status]
        : ["pending", "preparing", "dispatched"];

    // Find deliveries matching active statuses
    const deliveries = await Delivery.find({
      status: { $in: statusFilter },
    }).populate({
      path: "invoice",
      match: { status: { $nin: ["deleted", "cancelled", "written-off"] } },
      populate: {
        path: "customer",
        select: "firstName lastName email phone company",
      },
    });

    // Filter out deliveries where invoice is null (due to match condition)
    let validDeliveries = deliveries.filter((d) => d.invoice != null);

    // Filter by search term if provided
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      validDeliveries = validDeliveries.filter((d) => {
        const invNo = d.invoice?.invoiceNumber?.toLowerCase() || "";
        const tracking = (d.trackingNumbers || []).join(" ").toLowerCase();
        const custName = `${d.invoice?.customer?.firstName || ""} ${d.invoice?.customer?.lastName || ""}`.toLowerCase();
        const custEmail = (d.invoice?.customer?.email || "").toLowerCase();
        const custCompany = (d.invoice?.customer?.company || "").toLowerCase();

        return (
          invNo.includes(q) ||
          tracking.includes(q) ||
          custName.includes(q) ||
          custEmail.includes(q) ||
          custCompany.includes(q)
        );
      });
    }

    // Sort by invoice date (oldest first for queue management)
    validDeliveries.sort(
      (a, b) =>
        new Date(a.invoice.invoiceDate) - new Date(b.invoice.invoiceDate),
    );

    if (!isPaginated) {
      return res.json(validDeliveries);
    }

    const currentPage = Math.max(1, Number(page || pageNumber) || 1);
    const perPage = Math.max(1, Number(limit || pageSize) || 15);
    const total = validDeliveries.length;

    const paged = validDeliveries.slice(
      (currentPage - 1) * perPage,
      currentPage * perPage,
    );

    res.json({
      data: paged,
      total,
      page: currentPage,
      pages: Math.ceil(total / perPage),
      limit: perPage,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc Search delivery by invoice number
// @route GET /api/deliveries/search/:invoiceNumber
// @access Private
const searchDeliveryByInvoice = async (req, res) => {
  try {
    const { Delivery, Invoice } = getTenantModels(req.dbConnection);
    const invoiceNumber = req.params.invoiceNumber;

    const invoice = await Invoice.findOne({ invoiceNumber })
      .populate("customer", "firstName lastName email phone company");

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const delivery = await Delivery.findOne({ invoice: invoice._id }).populate({
      path: "invoice",
      populate: { path: "customer", select: "firstName lastName email phone company" }
    });

    if (delivery) {
      res.json(delivery);
    } else {
      // Return a mocked pending delivery if none exists yet
      res.json({
        invoice: invoice,
        status: "pending",
        trackingNumbers: [],
        lifecycle: []
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  updateDelivery,
  getDeliveryQueue,
  searchDeliveryByInvoice,
};
