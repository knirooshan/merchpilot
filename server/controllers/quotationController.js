const { getTenantModels } = require("../models/tenantModels");
const { parseStartOfDay, parseEndOfDay, getTenantTimezone } = require("../utils/dateUtils");

// @desc    Get all quotations (with optional server-side search, filters, and pagination)
// @route   GET /api/quotations
// @access  Private
const getQuotations = async (req, res) => {
  try {
    const { Quotation, Customer } = getTenantModels(req.dbConnection);
    const {
      search,
      status,
      customer,
      startDate,
      endDate,
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

    // Build filter object
    const filter = { status: { $ne: "deleted" } };

    // Search in quotation number, notes, customer name, company
    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: "i" };

      const matchingCustomers = await Customer.find({
        $or: [
          { firstName: searchRegex },
          { lastName: searchRegex },
          { email: searchRegex },
          { "billing.company": searchRegex },
        ],
      }).select("_id");
      const matchingCustomerIds = matchingCustomers.map((c) => c._id);

      filter.$or = [
        { quotationNumber: searchRegex },
        { notes: searchRegex },
        { customer: { $in: matchingCustomerIds } },
        { "customerInfo.firstName": searchRegex },
        { "customerInfo.lastName": searchRegex },
        { "customerInfo.company": searchRegex },
        { "customerInfo.email": searchRegex },
      ];
    }

    // Filter by status (in addition to not deleted)
    if (status && status !== "all") {
      filter.status = status;
    }

    // Filter by customer
    if (customer && customer !== "all") {
      filter.customer = customer;
    }

    // Filter by date range
    if (startDate || endDate) {
      const timezone = await getTenantTimezone(req.dbConnection);
      filter.quotationDate = {};
      if (startDate)
        filter.quotationDate.$gte = parseStartOfDay(startDate, timezone);
      if (endDate) filter.quotationDate.$lte = parseEndOfDay(endDate, timezone);
    }

    if (!isPaginated) {
      const quotations = await Quotation.find(filter)
        .populate("customer", "firstName lastName email billing")
        .sort({ createdAt: -1 });
      return res.json(quotations);
    }

    const currentPage = Math.max(1, Number(page || pageNumber) || 1);
    const perPage = Math.max(1, Number(limit || pageSize) || 15);

    const total = await Quotation.countDocuments(filter);
    const quotations = await Quotation.find(filter)
      .populate("customer", "firstName lastName email billing")
      .sort({ createdAt: -1 })
      .limit(perPage)
      .skip((currentPage - 1) * perPage);

    res.json({
      data: quotations,
      total,
      page: currentPage,
      pages: Math.ceil(total / perPage),
      limit: perPage,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single quotation
// @route   GET /api/quotations/:id
// @access  Private
const getQuotationById = async (req, res) => {
  try {
    const { Quotation } = getTenantModels(req.dbConnection);
    const quotation = await Quotation.findById(req.params.id)
      .populate("customer")
      .populate("items.product");

    if (quotation) {
      res.json(quotation);
    } else {
      res.status(404).json({ message: "Quotation not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create new quotation
// @route   POST /api/quotations
// @access  Private
const createQuotation = async (req, res) => {
  try {
    const { Quotation } = getTenantModels(req.dbConnection);
    const {
      customer,
      items,
      subtotal,
      tax,
      discount,
      deliveryCharge,
      deliveryNote,
      total,
      notes,
      terms,
      quotationDate,
      validUntil,
      currency,
      exchangeRate,
    } = req.body;

    const quotation = new Quotation({
      customer,
      items,
      subtotal,
      tax,
      discount,
      deliveryCharge,
      deliveryNote,
      total,
      notes,
      terms,
      quotationDate,
      validUntil,
      currency: currency?.code ? currency : undefined,
      exchangeRate:
        currency?.code && exchangeRate?.rate ? exchangeRate : undefined,
    });

    const createdQuotation = await quotation.save();
    res.status(201).json(createdQuotation);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update quotation status
// @route   PUT /api/quotations/:id/status
// @access  Private
const updateQuotationStatus = async (req, res) => {
  try {
    const { Quotation } = getTenantModels(req.dbConnection);
    const { status } = req.body;
    const quotation = await Quotation.findById(req.params.id);

    if (quotation) {
      quotation.status = status;
      const updatedQuotation = await quotation.save();
      res.json(updatedQuotation);
    } else {
      res.status(404).json({ message: "Quotation not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update quotation
// @route   PUT /api/quotations/:id
// @access  Private
const updateQuotation = async (req, res) => {
  try {
    const { Quotation } = getTenantModels(req.dbConnection);
    const quotation = await Quotation.findById(req.params.id);

    if (quotation) {
      const updateData = req.body;

      // Update quotation fields
      Object.keys(updateData).forEach((key) => {
        quotation[key] = updateData[key];
      });

      if (!quotation.currency?.code) {
        quotation.currency = undefined;
        quotation.exchangeRate = undefined;
      }

      const updatedQuotation = await quotation.save();
      res.json(updatedQuotation);
    } else {
      res.status(404).json({ message: "Quotation not found" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc Delete quotation (soft delete)
// @route DELETE /api/quotations/:id
// @access Private
const deleteQuotation = async (req, res) => {
  try {
    const { Quotation } = getTenantModels(req.dbConnection);
    const quotation = await Quotation.findById(req.params.id);

    if (quotation) {
      quotation.status = "deleted";
      await quotation.save();
      res.json({ message: "Quotation deleted successfully" });
    } else {
      res.status(404).json({ message: "Quotation not found" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getQuotations,
  getQuotationById,
  createQuotation,
  updateQuotationStatus,
  updateQuotation,
  deleteQuotation,
};
