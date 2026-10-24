const { getTenantModels } = require("../models/tenantModels");
const {
  parseStartOfDay,
  parseEndOfDay,
  getTenantTimezone,
} = require("../utils/dateUtils");

// Generate IRD-compliant Tax Invoice Number: YYMMM_DEPT_SERIAL
// e.g. 26JUL_BR01_1
const generateTaxInvoiceNumber = async (Invoice, settings, invoiceDate) => {
  const date = invoiceDate ? new Date(invoiceDate) : new Date();
  const yy = date.getFullYear().toString().slice(-2);
  const months = [
    "JAN",
    "FEB",
    "MAR",
    "APR",
    "MAY",
    "JUN",
    "JUL",
    "AUG",
    "SEP",
    "OCT",
    "NOV",
    "DEC",
  ];
  const mmm = months[date.getMonth()];
  const dept = settings?.ird?.departmentCode || "BR01";

  // Count invoices in the same month/year to get serial
  const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
  const endOfMonth = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
    23,
    59,
    59,
  );
  const countInMonth = await Invoice.countDocuments({
    createdAt: { $gte: startOfMonth, $lte: endOfMonth },
  });
  const serial = countInMonth + 1;

  return `${yy}${mmm}_${dept}_${serial}`;
};

// @desc    Get all invoices (with optional server-side search, filters, and pagination)
// @route   GET /api/invoices
// @access  Private
const getInvoices = async (req, res) => {
  try {
    const { Invoice, Customer } = getTenantModels(req.dbConnection);
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

    // Search in invoice number, tax invoice number, notes, customer name, company
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
        { invoiceNumber: searchRegex },
        { taxInvoiceNumber: searchRegex },
        { notes: searchRegex },
        { customer: { $in: matchingCustomerIds } },
        { "customerInfo.firstName": searchRegex },
        { "customerInfo.lastName": searchRegex },
        { "customerInfo.company": searchRegex },
        { "customerInfo.email": searchRegex },
      ];
    }

    // Filter by status
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
      filter.invoiceDate = {};
      if (startDate)
        filter.invoiceDate.$gte = parseStartOfDay(startDate, timezone);
      if (endDate) filter.invoiceDate.$lte = parseEndOfDay(endDate, timezone);
    }

    if (!isPaginated) {
      const invoices = await Invoice.find(filter)
        .populate("customer", "firstName lastName email billing")
        .populate("payments")
        .sort({ createdAt: -1 });
      return res.json(invoices);
    }

    const currentPage = Math.max(1, Number(page || pageNumber) || 1);
    const perPage = Math.max(1, Number(limit || pageSize) || 15);

    const total = await Invoice.countDocuments(filter);
    const invoices = await Invoice.find(filter)
      .populate("customer", "firstName lastName email billing")
      .populate("payments")
      .sort({ createdAt: -1 })
      .limit(perPage)
      .skip((currentPage - 1) * perPage);

    res.json({
      invoices,
      data: invoices,
      total,
      page: currentPage,
      pages: Math.ceil(total / perPage),
      limit: perPage,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single invoice
// @route   GET /api/invoices/:id
// @access  Private
const getInvoiceById = async (req, res) => {
  try {
    const { Invoice } = getTenantModels(req.dbConnection);
    const invoice = await Invoice.findById(req.params.id)
      .populate("customer")
      .populate("items.product")
      .populate("payments");

    if (invoice) {
      res.json(invoice);
    } else {
      res.status(404).json({ message: "Invoice not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create new invoice
// @route   POST /api/invoices
// @access  Private
const createInvoice = async (req, res) => {
  try {
    const { Invoice, Customer, Payment, Settings } = getTenantModels(
      req.dbConnection,
    );

    let {
      customer,
      customerInfo,
      items,
      subtotal,
      tax,
      discount,
      deliveryCharge,
      deliveryNote,
      total,
      notes,
      terms,
      invoiceDate,
      dueDate,
      deliveryDate,
      paymentMethod,
      status,
      reference,
      placeOfSupply,
      currency,
      exchangeRate,
      invoiceType,
    } = req.body;

    // Check if this is a walk-in customer invoice
    if (customer === "walk-in") {
      // Find or create walk-in customer
      let walkInCustomer = await Customer.findOne({
        email: "walkin@pos.local",
        firstName: "Walk-in",
      });

      if (!walkInCustomer) {
        walkInCustomer = await Customer.create({
          firstName: "Walk-in",
          lastName: "Customer",
          email: "walkin@pos.local",
          billing: {
            first_name: "Walk-in",
            last_name: "Customer",
            phone: "",
          },
        });
      }

      customer = walkInCustomer._id;
    }

    // If customerInfo is not provided, fetch it from the customer record
    if (!customerInfo && customer) {
      const customerDoc = await Customer.findById(customer);
      if (customerDoc) {
        customerInfo = {
          firstName: customerDoc.firstName,
          lastName: customerDoc.lastName,
          company: customerDoc.billing?.company,
          email: customerDoc.email,
          phone: customerDoc.billing?.phone,
          taxNumber: customerDoc.taxNumber,
        };
      }
    }

    // Fetch settings to get IRD department code
    const settings = await Settings.findOne();

    // Generate IRD-compliant Tax Invoice Number
    const taxInvoiceNumber = await generateTaxInvoiceNumber(
      Invoice,
      settings,
      invoiceDate,
    );

    // Default placeOfSupply from settings if not provided
    const resolvedPlaceOfSupply =
      placeOfSupply ||
      settings?.ird?.placeOfSupply ||
      settings?.address?.city ||
      "";

    const invoice = new Invoice({
      customer,
      customerInfo,
      items,
      subtotal,
      tax,
      discount,
      deliveryCharge,
      deliveryNote,
      total,
      notes,
      terms,
      invoiceDate,
      dueDate,
      deliveryDate,
      paymentMethod,
      status: status || "draft",
      reference,
      taxInvoiceNumber,
      placeOfSupply: resolvedPlaceOfSupply,
      currency: currency?.code ? currency : undefined,
      exchangeRate:
        currency?.code && exchangeRate?.rate ? exchangeRate : undefined,
      invoiceType: invoiceType || "tax",
    });

    const createdInvoice = await invoice.save();

    // If invoice status is paid, create a payment record
    if (status === "paid") {
      const payment = new Payment({
        invoice: createdInvoice._id,
        customer: customer,
        amount: total,
        method: paymentMethod || "cash",
        paymentDate: invoiceDate || new Date(),
        notes: "Payment recorded upon invoice creation",
      });

      await payment.save();

      // Update invoice with payment information
      createdInvoice.amountPaid = total;
      createdInvoice.balanceDue = 0;
      createdInvoice.payments = [payment._id];
      if (createdInvoice.invoiceType === "proforma") {
        createdInvoice.invoiceType = "tax";
      }
      await createdInvoice.save();
    }

    res.status(201).json(createdInvoice);
  } catch (error) {
    res.status(500).json({ message: error });
  }
};

// @desc    Update invoice status
// @route   PUT /api/invoices/:id/status
// @access  Private
const updateInvoiceStatus = async (req, res) => {
  try {
    const { Invoice } = getTenantModels(req.dbConnection);
    const { status } = req.body;
    const invoice = await Invoice.findById(req.params.id);

    if (invoice) {
      invoice.status = status;
      // Keep amountPaid/balanceDue consistent when manually marking as paid
      if (status === "paid") {
        invoice.amountPaid = invoice.total;
      }
      const updatedInvoice = await invoice.save();
      res.json(updatedInvoice);
    } else {
      res.status(404).json({ message: "Invoice not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Write off an invoice
// @route   PUT /api/invoices/:id/write-off
// @access  Private
const writeOffInvoice = async (req, res) => {
  try {
    const { Invoice } = getTenantModels(req.dbConnection);
    const invoice = await Invoice.findById(req.params.id);

    if (invoice) {
      invoice.isWrittenOff = true;
      invoice.status = "written-off";
      // balanceDue will be calculated by pre-save hook

      const updatedInvoice = await invoice.save();
      res.json(updatedInvoice);
    } else {
      res.status(404).json({ message: "Invoice not found" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc Update invoice
// @route PUT /api/invoices/:id
// @access Private
const updateInvoice = async (req, res) => {
  try {
    const { Invoice } = getTenantModels(req.dbConnection);
    const invoice = await Invoice.findById(req.params.id);

    if (invoice) {
      const { editReason, editedBy, ...updateData } = req.body;

      // Add to edit history if edit reason provided
      if (editReason) {
        invoice.editHistory.push({
          editedAt: new Date(),
          editedBy: editedBy || "User",
          reason: editReason,
        });
      }

      // Update invoice fields
      Object.keys(updateData).forEach((key) => {
        invoice[key] = updateData[key];
      });

      if (!invoice.currency?.code) {
        invoice.currency = undefined;
        invoice.exchangeRate = undefined;
      }

      const updatedInvoice = await invoice.save();
      res.json(updatedInvoice);
    } else {
      res.status(404).json({ message: "Invoice not found" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc Delete invoice (soft delete)
// @route DELETE /api/invoices/:id
// @access Private
const deleteInvoice = async (req, res) => {
  try {
    const { Invoice, Payment } = getTenantModels(req.dbConnection);
    const invoice = await Invoice.findById(req.params.id);

    if (invoice) {
      // Soft delete associated payments
      await Payment.updateMany(
        { invoice: req.params.id },
        { status: "deleted" },
      );

      // Soft delete the invoice
      invoice.status = "deleted";
      await invoice.save();

      res.json({ message: "Invoice deleted successfully" });
    } else {
      res.status(404).json({ message: "Invoice not found" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoice,
  updateInvoiceStatus,
  writeOffInvoice,
  deleteInvoice,
};
