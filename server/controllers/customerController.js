const { getTenantModels } = require("../models/tenantModels");
const { getWooCustomers } = require("../services/wooService");

// @desc    Get all customers (with optional server-side search and pagination)
// @route   GET /api/customers
// @access  Private
const getCustomers = async (req, res) => {
  try {
    const { Customer } = getTenantModels(req.dbConnection);
    const {
      search,
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
    const filter = {};

    // Search in name, email, phone, company, address
    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: "i" };
      filter.$or = [
        { firstName: searchRegex },
        { lastName: searchRegex },
        { email: searchRegex },
        { "billing.phone": searchRegex },
        { "billing.company": searchRegex },
        { "billing.city": searchRegex },
        { "shipping.phone": searchRegex },
        { "shipping.company": searchRegex },
      ];
    }

    if (!isPaginated) {
      const customers = await Customer.find(filter).sort({ createdAt: -1 });
      return res.json(customers);
    }

    const currentPage = Math.max(1, Number(page || pageNumber) || 1);
    const perPage = Math.max(1, Number(limit || pageSize) || 15);

    const total = await Customer.countDocuments(filter);
    const customers = await Customer.find(filter)
      .sort({ createdAt: -1 })
      .limit(perPage)
      .skip((currentPage - 1) * perPage);

    res.json({
      data: customers,
      total,
      page: currentPage,
      pages: Math.ceil(total / perPage),
      limit: perPage,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single customer
// @route   GET /api/customers/:id
// @access  Private
const getCustomerById = async (req, res) => {
  try {
    const { Customer } = getTenantModels(req.dbConnection);
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create new customer
// @route   POST /api/customers
// @access  Private
const createCustomer = async (req, res) => {
  try {
    const { Customer } = getTenantModels(req.dbConnection);
    const {
      salutation,
      email,
      firstName,
      lastName,
      taxNumber,
      billing,
      shipping,
    } = req.body;

    // Validation: Either firstName or billing.company must be present
    if (!firstName && (!billing || !billing.company)) {
      return res.status(400).json({
        message: "Either First Name or Company Name is required",
      });
    }

    // Check if customer with email already exists (only if email is provided)
    if (email) {
      const customerExists = await Customer.findOne({ email });

      if (customerExists) {
        return res
          .status(400)
          .json({ message: "Customer with this email already exists" });
      }
    }

    const customer = await Customer.create({
      salutation,
      email,
      firstName,
      lastName,
      taxNumber,
      billing,
      shipping,
    });

    res.status(201).json(customer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update customer
// @route   PUT /api/customers/:id
// @access  Private
const updateCustomer = async (req, res) => {
  try {
    const { Customer } = getTenantModels(req.dbConnection);
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const { firstName, lastName, billing } = req.body;

    // Validation: Either firstName or billing.company must be present
    // We check both the update data and the existing customer data
    const finalFirstName =
      firstName !== undefined ? firstName : customer.firstName;
    const finalLastName = lastName !== undefined ? lastName : customer.lastName;
    const finalCompany =
      billing?.company !== undefined
        ? billing.company
        : customer.billing?.company;

    if (!finalFirstName && !finalCompany) {
      return res.status(400).json({
        message: "Either First Name or Company Name is required",
      });
    }

    const updatedCustomer = await Customer.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true },
    );

    res.json(updatedCustomer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete customer
// @route   DELETE /api/customers/:id
// @access  Private/Admin
const deleteCustomer = async (req, res) => {
  try {
    const { Customer } = getTenantModels(req.dbConnection);
    const customer = await Customer.findById(req.params.id);

    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    await Customer.findByIdAndDelete(req.params.id);
    res.json({ message: "Customer deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Sync customers from WooCommerce
// @route   POST /api/customers/sync
// @access  Private/Admin
const syncCustomers = async (req, res) => {
  try {
    const { Customer, Settings } = getTenantModels(req.dbConnection);

    // Check feature toggle
    const settings = await Settings.findOne();
    if (
      settings &&
      settings.modules &&
      settings.modules.woocommerce === false
    ) {
      return res.status(403).json({ message: "WooCommerce sync disabled" });
    }

    const wooCustomers = await getWooCustomers(settings, 1, 100);

    const syncedCustomers = [];

    for (const c of wooCustomers) {
      const customerData = {
        wooId: c.id,
        email: c.email,
        firstName: c.first_name,
        lastName: c.last_name,
        role: c.role,
        username: c.username,
        billing: c.billing,
        shipping: c.shipping,
        avatar_url: c.avatar_url,
      };

      const customer = await Customer.findOneAndUpdate(
        { wooId: c.id },
        customerData,
        { new: true, upsert: true },
      );
      syncedCustomers.push(customer);
    }

    res.json({
      message: `Synced ${syncedCustomers.length} customers`,
      customers: syncedCustomers,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get full customer summary (orders, invoices, payments, products)
// @route   GET /api/customers/:id/summary
// @access  Private
const getCustomerSummary = async (req, res) => {
  try {
    const { Customer, Order, Invoice, Payment, Quotation } = getTenantModels(
      req.dbConnection,
    );

    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const [orders, invoices, payments, quotations] = await Promise.all([
      Order.find({ customer: req.params.id }).sort({ dateCreated: -1 }),
      Invoice.find({ customer: req.params.id, status: { $ne: "deleted" } })
        .populate("payments")
        .sort({ createdAt: -1 }),
      Payment.find({
        customer: req.params.id,
        status: { $ne: "deleted" },
      }).sort({ date: -1 }),
      Quotation.find({ customer: req.params.id }).sort({ createdAt: -1 }),
    ]);

    // Aggregate products bought from orders + invoices
    const productMap = {};
    orders.forEach((order) => {
      (order.items || []).forEach((item) => {
        const key = item.name || item.sku || "Unknown";
        if (!productMap[key]) {
          productMap[key] = {
            name: key,
            sku: item.sku || "",
            quantity: 0,
            total: 0,
          };
        }
        productMap[key].quantity += item.quantity || 0;
        productMap[key].total += item.total || 0;
      });
    });
    invoices.forEach((invoice) => {
      (invoice.items || []).forEach((item) => {
        const key = item.name || "Unknown";
        if (!productMap[key]) {
          productMap[key] = {
            name: key,
            sku: item.sku || "",
            quantity: 0,
            total: 0,
          };
        }
        productMap[key].quantity += item.quantity || 0;
        productMap[key].total += item.total || 0;
      });
    });
    const productsBought = Object.values(productMap).sort(
      (a, b) => b.total - a.total,
    );

    // Payment channel breakdown
    const paymentChannels = {};
    payments.forEach((p) => {
      if (!paymentChannels[p.method]) paymentChannels[p.method] = 0;
      paymentChannels[p.method] += p.amount || 0;
    });

    const totalOrderValue = orders.reduce((s, o) => s + (o.total || 0), 0);
    const totalInvoiceValue = invoices.reduce((s, i) => s + (i.total || 0), 0);
    const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
    const totalBalanceDue = invoices.reduce(
      (s, i) => s + (i.balanceDue || 0),
      0,
    );

    res.json({
      customer,
      orders,
      invoices,
      payments,
      quotations,
      productsBought,
      paymentChannels,
      stats: {
        totalOrders: orders.length,
        totalOrderValue,
        totalInvoices: invoices.length,
        totalInvoiceValue,
        totalQuotations: quotations.length,
        totalPayments: payments.length,
        totalPaid,
        totalBalanceDue,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  syncCustomers,
  getCustomerSummary,
};
