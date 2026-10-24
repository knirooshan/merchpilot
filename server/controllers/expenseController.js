const { getTenantModels } = require("../models/tenantModels");
const { parseStartOfDay, parseEndOfDay, getTenantTimezone } = require("../utils/dateUtils");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

// Configure Multer Storage for Expense Attachments
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");

    const tenantId = req.tenant
      ? req.tenant.subdomain || req.tenant._id.toString()
      : "default";

    const uploadPath = path.join(
      __dirname,
      "..",
      "uploads",
      tenantId,
      "expenses",
      String(year),
      month
    );

    fs.mkdirSync(uploadPath, { recursive: true });
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const sanitized = file.originalname
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9.\-_]/g, "-");
    cb(null, uniqueSuffix + "-" + sanitized);
  },
});

const ALLOWED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
]);

const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Unsupported file type. Please upload a JPEG, PNG, GIF, WebP, or SVG image."
      ),
      false
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// @desc    Upload expense attachment
// @route   POST /api/expenses/upload
// @access  Private
const uploadExpenseAttachment = [
  (req, res, next) => {
    upload.single("file")(req, res, (err) => {
      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return res.status(400).json({
            message: "File too large. Maximum allowed size is 10 MB.",
          });
        }
        return res.status(400).json({ message: `Upload error: ${err.message}` });
      }
      if (err) {
        return res.status(400).json({ message: err.message });
      }
      next();
    });
  },
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");

      const tenantId = req.tenant
        ? req.tenant.subdomain || req.tenant._id.toString()
        : "default";

      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.get("host");
      const baseUrl = `${protocol}://${host}`;

      const relativePath = `/api/uploads/${tenantId}/expenses/${year}/${month}/${req.file.filename}`;
      const fullUrl = `${baseUrl}${relativePath}`;

      res.status(201).json({ url: fullUrl });
    } catch (error) {
      console.error("Error uploading expense attachment:", error);
      res.status(500).json({ message: "Server error during upload" });
    }
  },
];

// @desc    Get all expenses (with optional server-side search, filters, and pagination)
// @route   GET /api/expenses
// @access  Private
const getExpenses = async (req, res) => {
  try {
    const { Expense, Vendor } = getTenantModels(req.dbConnection);
    const {
      search,
      category,
      vendor,
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

    // Search in description, reference, notes, or vendor name
    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: "i" };

      const matchingVendors = await Vendor.find({
        name: searchRegex,
      }).select("_id");
      const matchingVendorIds = matchingVendors.map((v) => v._id);

      filter.$or = [
        { description: searchRegex },
        { reference: searchRegex },
        { notes: searchRegex },
        { vendor: { $in: matchingVendorIds } },
      ];
    }

    // Filter by category
    if (category && category !== "all") {
      filter.category = category;
    }

    // Filter by vendor
    if (vendor && vendor !== "all") {
      filter.vendor = vendor;
    }

    // Filter by date range using the configured timezone
    if (startDate || endDate) {
      const timezone = await getTenantTimezone(req.dbConnection);
      filter.date = {};
      if (startDate) filter.date.$gte = parseStartOfDay(startDate, timezone);
      if (endDate) filter.date.$lte = parseEndOfDay(endDate, timezone);
    }

    if (!isPaginated) {
      const expenses = await Expense.find(filter)
        .populate("vendor", "name")
        .sort({ date: -1, createdAt: -1 });
      return res.json(expenses);
    }

    const currentPage = Math.max(1, Number(page || pageNumber) || 1);
    const perPage = Math.max(1, Number(limit || pageSize) || 15);

    const total = await Expense.countDocuments(filter);
    const expenses = await Expense.find(filter)
      .populate("vendor", "name")
      .sort({ date: -1, createdAt: -1 })
      .limit(perPage)
      .skip((currentPage - 1) * perPage);

    res.json({
      expenses,
      data: expenses,
      total,
      page: currentPage,
      pages: Math.ceil(total / perPage),
      limit: perPage,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create new expense
// @route   POST /api/expenses
// @access  Private
const createExpense = async (req, res) => {
  try {
    const { Expense } = getTenantModels(req.dbConnection);
    const { description, amount, category, date, vendor, paymentMethod, reference, notes, attachmentUrl } =
      req.body;

    const expense = new Expense({
      description,
      amount,
      category,
      date,
      vendor,
      paymentMethod: paymentMethod || "Cash",
      reference,
      notes,
      attachmentUrl,
    });

    const createdExpense = await expense.save();
    res.status(201).json(createdExpense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete expense
// @route   DELETE /api/expenses/:id
// @access  Private
const deleteExpense = async (req, res) => {
  try {
    const { Expense } = getTenantModels(req.dbConnection);
    const expense = await Expense.findById(req.params.id);

    if (expense) {
      await expense.deleteOne();
      res.json({ message: "Expense removed" });
    } else {
      res.status(404).json({ message: "Expense not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update expense
// @route   PUT /api/expenses/:id
// @access  Private
const updateExpense = async (req, res) => {
  try {
    const { Expense } = getTenantModels(req.dbConnection);
    const expense = await Expense.findById(req.params.id);

    if (expense) {
      const { editReason, editedBy, ...updateData } = req.body;

      // Add to edit history if edit reason provided
      if (editReason) {
        expense.editHistory.push({
          editedAt: new Date(),
          editedBy: editedBy || "User",
          reason: editReason,
        });
      }

      // Update expense fields
      Object.keys(updateData).forEach((key) => {
        expense[key] = updateData[key];
      });

      const updatedExpense = await expense.save();
      res.json(updatedExpense);
    } else {
      res.status(404).json({ message: "Expense not found" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

module.exports = { getExpenses, createExpense, updateExpense, deleteExpense, uploadExpenseAttachment };
