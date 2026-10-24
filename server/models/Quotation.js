const mongoose = require("mongoose");

const quotationSchema = new mongoose.Schema(
  {
    quotationNumber: { type: String, unique: true },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Customer",
      required: true,
    },
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
    status: {
      type: String,
      enum: ["draft", "sent", "accepted", "rejected", "deleted"],
      default: "draft",
    },
    notes: String,
    terms: String,
    quotationDate: { type: Date, default: Date.now },
    validUntil: Date,
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

// Auto-generate quotation number
quotationSchema.pre("save", async function (next) {
  if (!this.quotationNumber) {
    const count = await this.constructor.countDocuments();
    this.quotationNumber = `QT-${new Date().getFullYear()}-${(count + 1)
      .toString()
      .padStart(4, "0")}`;
  }
  next();
});

// Don't compile model here
module.exports = quotationSchema;
