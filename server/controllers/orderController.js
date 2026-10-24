const { getTenantModels } = require("../models/tenantModels");
const { getWooOrders } = require("../services/wooService");
const { parseStartOfDay, parseEndOfDay, getTenantTimezone } = require("../utils/dateUtils");

// @desc    Get all orders (with optional server-side search, filters, and pagination)
// @route   GET /api/orders
// @access  Private
const getOrders = async (req, res) => {
  try {
    const { Order, Customer } = getTenantModels(req.dbConnection);
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
    const filter = {};

    // Search in order number, notes, customer name, shipping/billing info
    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: "i" };

      // Find any customers matching name/email/company
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
        { orderNumber: searchRegex },
        { notes: searchRegex },
        { customer: { $in: matchingCustomerIds } },
        { "shipping.firstName": searchRegex },
        { "shipping.lastName": searchRegex },
        { "shipping.company": searchRegex },
        { "billing.firstName": searchRegex },
        { "billing.lastName": searchRegex },
        { "billing.email": searchRegex },
        { "billing.phone": searchRegex },
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
      filter.dateCreated = {};
      if (startDate)
        filter.dateCreated.$gte = parseStartOfDay(startDate, timezone);
      if (endDate) filter.dateCreated.$lte = parseEndOfDay(endDate, timezone);
    }

    if (!isPaginated) {
      const orders = await Order.find(filter)
        .populate("customer")
        .sort({ dateCreated: -1 });
      return res.json(orders);
    }

    const currentPage = Math.max(1, Number(page || pageNumber) || 1);
    const perPage = Math.max(1, Number(limit || pageSize) || 15);

    const total = await Order.countDocuments(filter);
    const orders = await Order.find(filter)
      .populate("customer")
      .sort({ dateCreated: -1 })
      .limit(perPage)
      .skip((currentPage - 1) * perPage);

    res.json({
      orders,
      data: orders,
      total,
      page: currentPage,
      pages: Math.ceil(total / perPage),
      limit: perPage,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Sync orders from WooCommerce
// @route   POST /api/orders/sync
// @access  Private/Admin
const syncOrders = async (req, res) => {
  try {
    const { Order, Customer, Invoice, Payment, Settings } = getTenantModels(
      req.dbConnection,
    );

    // Check feature toggle
    const settings = await Settings.findOne();
    if (
      settings &&
      settings.modules &&
      settings.modules.woocommerce === false
    ) {
      return res.status(403).json({ message: "WooCommerce sync disabled" });
    }
    // Fetch orders from WooCommerce (first 100 for now)
    const wooOrders = await getWooOrders(settings, 1, 100);

    const syncedOrders = [];

    for (const order of wooOrders) {
      // Try to find matching customer by email, or create if doesn't exist
      let customer = null;
      if (order.billing && order.billing.email) {
        customer = await Customer.findOne({ email: order.billing.email });

        // If customer doesn't exist, create one
        if (!customer) {
          customer = await Customer.create({
            firstName: order.billing.first_name || "",
            lastName: order.billing.last_name || "",
            email: order.billing.email,
            billing: {
              first_name: order.billing.first_name || "",
              last_name: order.billing.last_name || "",
              company: order.billing.company || "",
              address_1: order.billing.address_1 || "",
              address_2: order.billing.address_2 || "",
              city: order.billing.city || "",
              state: order.billing.state || "",
              postcode: order.billing.postcode || "",
              country: order.billing.country || "",
              email: order.billing.email || "",
              phone: order.billing.phone || "",
            },
            shipping: {
              first_name: order.shipping?.first_name || "",
              last_name: order.shipping?.last_name || "",
              company: order.shipping?.company || "",
              address_1: order.shipping?.address_1 || "",
              address_2: order.shipping?.address_2 || "",
              city: order.shipping?.city || "",
              state: order.shipping?.state || "",
              postcode: order.shipping?.postcode || "",
              country: order.shipping?.country || "",
            },
          });
        }
      }

      const orderData = {
        wooOrderId: order.id,
        orderNumber: order.number || `#${order.id}`,
        customer: customer ? customer._id : null,
        customerInfo: {
          firstName: order.billing?.first_name || "",
          lastName: order.billing?.last_name || "",
          email: order.billing?.email || "",
          phone: order.billing?.phone || "",
        },
        items: order.line_items.map((item) => ({
          productId: item.product_id,
          name: item.name,
          sku: item.sku,
          quantity: item.quantity,
          price: parseFloat(item.price),
          total: parseFloat(item.total),
        })),
        subtotal: parseFloat(order.total) - parseFloat(order.total_tax || 0),
        tax: parseFloat(order.total_tax || 0),
        shippingTotal: parseFloat(order.shipping_total || 0),
        discount: parseFloat(order.discount_total || 0),
        total: parseFloat(order.total),
        status: order.status,
        paymentMethod: order.payment_method,
        paymentMethodTitle: order.payment_method_title,
        shippingAddress: {
          firstName: order.shipping?.first_name || "",
          lastName: order.shipping?.last_name || "",
          company: order.shipping?.company || "",
          address1: order.shipping?.address_1 || "",
          address2: order.shipping?.address_2 || "",
          city: order.shipping?.city || "",
          state: order.shipping?.state || "",
          postcode: order.shipping?.postcode || "",
          country: order.shipping?.country || "",
        },
        billingAddress: {
          firstName: order.billing?.first_name || "",
          lastName: order.billing?.last_name || "",
          company: order.billing?.company || "",
          address1: order.billing?.address_1 || "",
          address2: order.billing?.address_2 || "",
          city: order.billing?.city || "",
          state: order.billing?.state || "",
          postcode: order.billing?.postcode || "",
          country: order.billing?.country || "",
          email: order.billing?.email || "",
          phone: order.billing?.phone || "",
        },
        dateCreated: order.date_created
          ? new Date(order.date_created)
          : new Date(),
        datePaid: order.date_paid ? new Date(order.date_paid) : null,
        dateCompleted: order.date_completed
          ? new Date(order.date_completed)
          : null,
        currency: order.currency || "USD",
        notes: order.customer_note || "",
      };

      const savedOrder = await Order.findOneAndUpdate(
        { wooOrderId: order.id },
        orderData,
        { new: true, upsert: true },
      );

      // Create or update corresponding invoice
      const invoiceData = {
        customer: customer ? customer._id : null,
        customerInfo: {
          firstName: order.billing?.first_name || "",
          lastName: order.billing?.last_name || "",
          email: order.billing?.email || "",
          phone: order.billing?.phone || "",
        },
        items: order.line_items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: parseFloat(item.price),
          total: parseFloat(item.total),
        })),
        subtotal: parseFloat(order.total) - parseFloat(order.total_tax || 0),
        tax: parseFloat(order.total_tax || 0),
        discount: parseFloat(order.discount_total || 0),
        total: parseFloat(order.total),
        status:
          order.status === "completed" || order.status === "processing"
            ? "paid"
            : "draft",
        paymentMethod:
          order.payment_method_title || order.payment_method || "WooCommerce",
        dueDate: order.date_paid ? new Date(order.date_paid) : null,
        notes: `WooCommerce Order #${order.number || order.id}${order.customer_note ? "\n" + order.customer_note : ""
          }`,
      };

      // Check if invoice already exists for this order
      let invoice;
      if (savedOrder.invoice) {
        // Update existing invoice
        invoice = await Invoice.findByIdAndUpdate(
          savedOrder.invoice,
          invoiceData,
          { new: true },
        );
      } else {
        // Create new invoice
        invoice = await Invoice.create(invoiceData);
        // Link invoice to order
        savedOrder.invoice = invoice._id;
        await savedOrder.save();
      }

      syncedOrders.push(savedOrder);

      // Create Payment record if order is paid and doesn't have one (simplified check)
      if (order.status === "completed" || order.status === "processing") {
        const existingPayment = await Payment.findOne({
          order: savedOrder._id,
        });

        if (!existingPayment) {
          const mapWooPaymentMethod = (title) => {
            if (!title) return "WooCommerce";
            const lower = title.toLowerCase();
            if (lower.includes("bank transfer") || lower.includes("bacs"))
              return "Bank Transfer";
            if (lower.includes("check") || lower.includes("cheque"))
              return "Check";
            if (lower.includes("cash")) return "Cash";
            if (
              lower.includes("card") ||
              lower.includes("stripe") ||
              lower.includes("credit")
            )
              return "Card";
            return "Other";
          };

          await Payment.create({
            amount: parseFloat(order.total),
            date: order.date_paid ? new Date(order.date_paid) : new Date(),
            method: mapWooPaymentMethod(order.payment_method_title),
            reference: order.transaction_id || `WOO-${order.id}`,
            source: "WooCommerce",
            order: savedOrder._id,
            invoice: invoice._id, // Link to the invoice we just created/updated
            customer: customer ? customer._id : null,
            notes: `Auto-created from WooCommerce Order #${order.number || order.id
              }. Method: ${order.payment_method_title || "Unknown"}`,
          });

          // Update invoice status/paid amount since we just added a payment
          invoice.amountPaid = parseFloat(order.total);
          invoice.status = "paid";
          await invoice.save();
        }
      }
    }

    res.json({
      message: `Synced ${syncedOrders.length} orders and created/updated invoices`,
      orders: syncedOrders,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single order by ID
// @route   GET /api/orders/:id
// @access  Private
const getOrderById = async (req, res) => {
  try {
    const { Order } = getTenantModels(req.dbConnection);
    const order = await Order.findById(req.params.id).populate("customer");
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    res.json(order);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a new order
// @route   POST /api/orders
// @access  Private
const createOrder = async (req, res) => {
  try {
    const { Order, Customer } = getTenantModels(req.dbConnection);
    let orderData = req.body;

    // Check if this is a walk-in customer order (no customer ID or special identifier)
    if (!orderData.customer || orderData.customer === "walk-in") {
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

      // Assign walk-in customer to order
      orderData.customer = walkInCustomer._id;
    }

    const order = await Order.create(orderData);
    const populatedOrder = await Order.findById(order._id).populate("customer");
    res.status(201).json(populatedOrder);
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update an order
// @route   PUT /api/orders/:id
// @access  Private
const updateOrder = async (req, res) => {
  try {
    const { Order } = getTenantModels(req.dbConnection);
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }
    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true },
    ).populate("customer");
    res.json(updatedOrder);
  } catch (error) {
    console.error("Error updating order:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete an order and associated invoice/payments
// @route   DELETE /api/orders/:id
// @access  Private
const deleteOrder = async (req, res) => {
  try {
    const { Order, Invoice, Payment } = getTenantModels(req.dbConnection);
    const order = await Order.findById(req.params.id);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Soft delete associated payments
    await Payment.updateMany({ order: order._id }, { status: "deleted" });

    // Delete associated invoice and soft delete its payments
    if (order.invoice) {
      await Payment.updateMany(
        { invoice: order.invoice },
        { status: "deleted" },
      );
      await Invoice.findByIdAndDelete(order.invoice);
    }

    // Delete the order
    await order.deleteOne();

    res.json({ message: "Order and associated records deleted successfully" });
  } catch (error) {
    console.error("Error deleting order:", error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Refund an order
// @route   PUT /api/orders/:id/refund
// @access  Private
const refundOrder = async (req, res) => {
  try {
    const { Order, Invoice, Payment } = getTenantModels(req.dbConnection);
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.status === "refunded") {
      return res.status(400).json({ message: "Order is already refunded" });
    }

    // Update order status
    order.status = "refunded";
    await order.save();

    // Update associated invoice status
    if (order.invoice) {
      await Invoice.findByIdAndUpdate(order.invoice, { status: "refunded" });
    }

    // Update associated payments status
    // Note: This updates existing payments to 'refunded'.
    // If you wanted to KEEP the payment history and separate refund, you'd create a negative payment.
    // Based on requirements "add a new status to invoice and payments... say refunded", we update status.
    await Payment.updateMany({ order: order._id }, { status: "refunded" });

    // Also update payments linked to the invoice if not linked to order directly (double check)
    if (order.invoice) {
      await Payment.updateMany(
        { invoice: order.invoice },
        { status: "refunded" },
      );
    }

    res.json({ message: "Order and associated records marked as refunded" });
  } catch (error) {
    console.error("Error refunding order:", error);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getOrders,
  syncOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
  refundOrder,
};
