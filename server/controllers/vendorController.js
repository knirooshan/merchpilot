const { getTenantModels } = require("../models/tenantModels");

// @desc    Get all vendors (with optional server-side search and pagination)
// @route   GET /api/vendors
// @access  Private
const getVendors = async (req, res) => {
  try {
    const { Vendor } = getTenantModels(req.dbConnection);
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

    const filter = {};

    if (search && search.trim()) {
      const safeSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const searchRegex = { $regex: safeSearch, $options: "i" };
      filter.$or = [
        { name: searchRegex },
        { email: searchRegex },
        { phone: searchRegex },
        { contactPerson: searchRegex },
        { address: searchRegex },
      ];
    }

    if (!isPaginated) {
      const vendors = await Vendor.find(filter).sort({ createdAt: -1 });
      return res.json(vendors);
    }

    const currentPage = Math.max(1, Number(page || pageNumber) || 1);
    const perPage = Math.max(1, Number(limit || pageSize) || 15);

    const total = await Vendor.countDocuments(filter);
    const vendors = await Vendor.find(filter)
      .sort({ createdAt: -1 })
      .limit(perPage)
      .skip((currentPage - 1) * perPage);

    res.json({
      data: vendors,
      total,
      page: currentPage,
      pages: Math.ceil(total / perPage),
      limit: perPage,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a vendor
// @route   POST /api/vendors
// @access  Private/Admin
const createVendor = async (req, res) => {
  try {
    const { Vendor } = getTenantModels(req.dbConnection);
    const { name, email, phone, address, contactPerson } = req.body;

    const vendor = new Vendor({
      name,
      email,
      phone,
      address,
      contactPerson,
    });

    const createdVendor = await vendor.save();
    res.status(201).json(createdVendor);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update a vendor
// @route   PUT /api/vendors/:id
// @access  Private/Admin
const updateVendor = async (req, res) => {
  try {
    const { Vendor } = getTenantModels(req.dbConnection);
    const { name, email, phone, address, contactPerson } = req.body;

    const vendor = await Vendor.findById(req.params.id);

    if (vendor) {
      vendor.name = name || vendor.name;
      vendor.email = email || vendor.email;
      vendor.phone = phone || vendor.phone;
      vendor.address = address || vendor.address;
      vendor.contactPerson = contactPerson || vendor.contactPerson;

      const updatedVendor = await vendor.save();
      res.json(updatedVendor);
    } else {
      res.status(404).json({ message: "Vendor not found" });
    }
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete a vendor
// @route   DELETE /api/vendors/:id
// @access  Private/Admin
const deleteVendor = async (req, res) => {
  try {
    const { Vendor } = getTenantModels(req.dbConnection);
    const vendor = await Vendor.findById(req.params.id);

    if (vendor) {
      await vendor.deleteOne();
      res.json({ message: "Vendor removed" });
    } else {
      res.status(404).json({ message: "Vendor not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get full vendor summary (expenses, stats, category breakdown)
// @route   GET /api/vendors/:id/summary
// @access  Private
const getVendorSummary = async (req, res) => {
  try {
    const { Vendor, Expense } = getTenantModels(req.dbConnection);

    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const expenses = await Expense.find({ vendor: req.params.id }).sort({
      date: -1,
    });

    const totalAmount = expenses.reduce((s, e) => s + (e.amount || 0), 0);

    const categoryBreakdown = {};
    expenses.forEach((e) => {
      if (!categoryBreakdown[e.category]) categoryBreakdown[e.category] = 0;
      categoryBreakdown[e.category] += e.amount || 0;
    });

    res.json({
      vendor,
      expenses,
      stats: {
        totalExpenses: expenses.length,
        totalAmount,
        categoryBreakdown,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// @desc    Get single vendor
// @route   GET /api/vendors/:id
// @access  Private
const getVendorById = async (req, res) => {
  try {
    const { Vendor } = getTenantModels(req.dbConnection);
    const vendor = await Vendor.findById(req.params.id);
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }
    res.json(vendor);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getVendors,
  getVendorById,
  createVendor,
  updateVendor,
  deleteVendor,
  getVendorSummary,
};
