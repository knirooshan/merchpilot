const mongoose = require("mongoose");

const settingsSchema = new mongoose.Schema(
  {
    storeName: { type: String, default: "My Store" },
    website: { type: String, default: "" },
    registrationNo: { type: String, default: "" },
    taxIdNo: { type: String, default: "" },
    address: {
      street: { type: String, default: "" },
      city: { type: String, default: "" },
      zip: { type: String, default: "" },
      country: { type: String, default: "" },
    },
    contact: {
      phone: { type: String, default: "" },
      email: { type: String, default: "" },
    },
    logo: { type: String, default: "" }, // URL or Base64
    smtp: {
      host: { type: String, default: "" },
      port: { type: Number, default: 587 },
      user: { type: String, default: "" },
      pass: { type: String, default: "" },
      secure: { type: Boolean, default: false },
    },
    bank: {
      accountName: { type: String, default: "" },
      accountNumber: { type: String, default: "" },
      bankName: { type: String, default: "" },
      branch: { type: String, default: "" },
      swiftCode: { type: String, default: "" },
    },
    currency: {
      code: { type: String, default: "USD" }, // e.g., USD, EUR, GBP, INR
      symbol: { type: String, default: "$" }, // e.g., $, €, £, ₹
      position: { type: String, default: "before", enum: ["before", "after"] }, // Symbol position
    },
    tax: {
      rate: { type: Number, default: 0, min: 0, max: 100 }, // Tax rate as percentage (0-100)
      label: { type: String, default: "Tax" }, // Label for tax (e.g., "VAT", "GST", "Sales Tax")
      registered: { type: Boolean, default: false }, // Registered for VAT/tax; unregistered suppliers can't issue "Tax Invoices"
      defaultMethod: {
        type: String,
        default: "exclusive",
        enum: ["inclusive", "exclusive"],
      },
    },
    dateTime: {
      dateFormat: { type: String, default: "MM/DD/YYYY" }, // MM/DD/YYYY, DD/MM/YYYY, YYYY-MM-DD
      timeFormat: { type: String, default: "12h" }, // 12h, 24h
      timezone: { type: String, default: "UTC" }, // IANA timezone, e.g. "UTC", "America/New_York"
    },
    terms: {
      invoice: { type: String, default: "" },
      quotation: { type: String, default: "" },
      deliveryReceipt: { type: String, default: "" },
    },
    wooCommerce: {
      url: { type: String, default: "" },
      consumerKey: { type: String, default: "" },
      consumerSecret: { type: String, default: "" },
    },
    medusa: {
      url: { type: String, default: "" }, // e.g. https://your-medusa-backend.com
      apiKey: { type: String, default: "" }, // Medusa Admin API secret key
      publishableKey: { type: String, default: "" }, // Publishable key (optional)
    },
    // IRD Sri Lanka Gazette 2481/22 compliance settings
    ird: {
      departmentCode: { type: String, default: "BR01" }, // Used in Tax Invoice Number: YYMMM_DEPT_SERIAL
      placeOfSupply: { type: String, default: "" }, // Default place of supply on invoices
    },
    // Feature module toggles
    modules: {
      woocommerce: { type: Boolean, default: true },
      pos: { type: Boolean, default: true },
      medusaSync: { type: Boolean, default: false },
    },
  },
  {
    timestamps: true,
  },
);

// Don't compile model here
module.exports = settingsSchema;
