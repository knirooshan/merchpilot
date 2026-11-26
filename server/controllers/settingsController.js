const { getTenantModels } = require("../models/tenantModels");

const DEFAULT_DOCUMENT_COLORS = {
  invoicePrimary: "#1E3A8A",
  proformaPrimary: "#065F46",
  quotationPrimary: "#1E3A8A",
  amountWordsBg: "#EFF6FF",
};

const HEX_COLOR_RE = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/;

const normalizeHexColor = (value, fallback) => {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!HEX_COLOR_RE.test(trimmed)) return fallback;
  if (trimmed.length === 4) {
    return (
      "#" +
      trimmed
        .slice(1)
        .split("")
        .map((c) => c + c)
        .join("")
        .toUpperCase()
    );
  }
  return trimmed.toUpperCase();
};

const sanitizeDocumentColors = (incoming = {}, existing = {}) => {
  const base = existing?.toObject ? existing.toObject() : existing || {};
  const result = {};
  for (const key of Object.keys(DEFAULT_DOCUMENT_COLORS)) {
    const fallback = normalizeHexColor(
      base[key],
      DEFAULT_DOCUMENT_COLORS[key],
    );
    result[key] = normalizeHexColor(incoming[key], fallback);
  }
  return result;
};

// @desc    Get store settings
// @route   GET /api/settings
// @access  Private
const getSettings = async (req, res) => {
  try {
    const { Settings } = getTenantModels(req.dbConnection);
    let settings = await Settings.findOne();

    if (!settings) {
      settings = await Settings.create({});
    }

    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update store settings
// @route   PUT /api/settings
// @access  Private/Admin
const updateSettings = async (req, res) => {
  try {
    const { Settings } = getTenantModels(req.dbConnection);
    const settings = await Settings.findOne();

    if (settings) {
      settings.storeName = req.body.storeName || settings.storeName;
      settings.website = req.body.website || settings.website;
      settings.registrationNo =
        req.body.registrationNo !== undefined
          ? req.body.registrationNo
          : settings.registrationNo;
      settings.taxIdNo =
        req.body.taxIdNo !== undefined ? req.body.taxIdNo : settings.taxIdNo;
      settings.address = req.body.address || settings.address;
      settings.contact = req.body.contact || settings.contact;
      settings.logo = req.body.logo || settings.logo;
      settings.smtp = req.body.smtp || settings.smtp;
      settings.bank = req.body.bank || settings.bank;
      settings.currency = req.body.currency || settings.currency;
      settings.tax = req.body.tax || settings.tax;
      settings.dateTime = req.body.dateTime || settings.dateTime;
      settings.terms = req.body.terms || settings.terms;
      if (req.body.documentColors) {
        settings.documentColors = sanitizeDocumentColors(
          req.body.documentColors,
          settings.documentColors,
        );
      }
      settings.wooCommerce = req.body.wooCommerce || settings.wooCommerce;
      settings.ird = req.body.ird || settings.ird;
      // support updating modules toggles
      if (req.body.modules) {
        settings.modules = {
          ...settings.modules,
          ...req.body.modules,
        };
      }

      const updatedSettings = await settings.save();
      res.json(updatedSettings);
    } else {
      // Should not happen if getSettings is called first, but handle anyway
      const newSettings = await Settings.create(req.body);
      res.json(newSettings);
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getSettings, updateSettings };
