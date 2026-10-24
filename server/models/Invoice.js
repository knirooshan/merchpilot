const mongoose = require("mongoose");

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, unique: true },
    taxInvoiceNumber: { type: String, default: "" }, // IRD Gazette 2481/22 format: YYMMM_DEPT_SERIAL
    invoiceType: {
      type: String,
      enum: ["tax", "proforma"],
      default: "tax",
    },
    placeOfSupply: { type: String, default: "" }, // Required by IRD Gazette 2481/22
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: false,
    },
    customerInfo: {
      firstName: String,
      lastName: String,
      company: String,
      email: String,
      phone: String,
      taxNumber: String,
    },
    reference: String,
    items: [
      {
        product: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Product",
        },
        name: String,
        description: String,
        sku: String,
        price: Number,
        quantity: Number,
        discount: { type: Number, default: 0 },
        discountType: {
          type: String,
          enum: ["fixed", "percentage"],
          default: "fixed",
        },
        isTaxable: { type: Boolean, default: false },
        taxMethod: {
          type: String,
          enum: ["inclusive", "exclusive"],
          default: "exclusive",
        },
        itemTax: { type: Number, default: 0 },
        total: Number,
      },
    ],
    subtotal: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    taxRate: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    deliveryCharge: { type: Number, default: 0 },
    deliveryNote: { type: String },
    total: { type: Number, required: true },
    paymentMethod: String,
    payments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Payment",
      },
    ],
    amountPaid: { type: Number, default: 0 },
    balanceDue: { type: Number },
    isWrittenOff: { type: Boolean, default: false },
    status: {
      type: String,
      enum: [
        "draft",
        "sent",
        "paid",
        "partially_paid",
        "overdue",
        "cancelled",
        "written-off",
        "deleted",
        "refunded",
      ],
      default: "draft",
    },
    editHistory: [
      {
        editedAt: { type: Date, default: Date.now },
        editedBy: { type: String },
        reason: { type: String },
      },
    ],
    invoiceDate: { type: Date, default: Date.now },
    dueDate: Date,
    deliveryDate: Date,
    notes: String,
    terms: String,
    woocommerceOrderId: Number,
    currency: {
      code: { type: String },
      symbol: { type: String },
      position: { type: String, default: "before", enum: ["before", "after"] },
    },
    exchangeRate: {
      rate: { type: Number },
      baseCurrency: { type: String },
    },
  },
  {
    timestamps: true,
  },
);

// Auto-generate invoice number
invoiceSchema.pre("save", async function (next) {
  if (!this.invoiceNumber) {
    const count = await this.constructor.countDocuments();
    this.invoiceNumber = `INV-${new Date().getFullYear()}-${(count + 1)
      .toString()
      .padStart(4, "0")}`;
  }

  // Calculate balance due
  if (this.total !== undefined) {
    this.balanceDue = this.total - (this.amountPaid || 0);
    if (this.isWrittenOff) {
      this.balanceDue = 0;
    }
  }

  next();
});

// Don't compile model here
module.exports = invoiceSchema;
