const { getCentralConnection } = require("../services/connectionManager");
const { sendTenantWelcomeEmail } = require("../services/emailService");
const crypto = require("crypto");

// Helper to get Tenant model from Central DB
const getTenantModel = () => {
  const conn = getCentralConnection();
  return conn.model("Tenant");
};

// @desc    Get all tenants (with optional search, status filter, and pagination)
// @route   GET /api/tenants
// @access  Super Admin
const getTenants = async (req, res) => {
  try {
    const Tenant = getTenantModel();
    const {
      search,
      status,
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
      const searchRegex = { $regex: search.trim(), $options: "i" };
      filter.$or = [
        { name: searchRegex },
        { subdomain: searchRegex },
        { email: searchRegex },
        { dbName: searchRegex },
      ];
    }

    if (status && status !== "all") {
      if (status === "active") filter.isActive = true;
      if (status === "inactive") filter.isActive = false;
    }

    if (!isPaginated) {
      const tenants = await Tenant.find(filter).sort({ createdAt: -1 });
      return res.json(tenants);
    }

    const currentPage = Math.max(1, Number(page || pageNumber) || 1);
    const perPage = Math.max(1, Number(limit || pageSize) || 15);

    const total = await Tenant.countDocuments(filter);
    const tenants = await Tenant.find(filter)
      .sort({ createdAt: -1 })
      .limit(perPage)
      .skip((currentPage - 1) * perPage);

    res.json({
      data: tenants,
      total,
      page: currentPage,
      pages: Math.ceil(total / perPage),
      limit: perPage,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get tenant by ID
// @route   GET /api/tenants/:id
// @access  Super Admin
const getTenantById = async (req, res) => {
  try {
    const Tenant = getTenantModel();
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }
    res.json(tenant);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a tenant
// @route   POST /api/tenants
// @access  Super Admin
const createTenant = async (req, res) => {
  try {
    const Tenant = getTenantModel();
    const { name, subdomain, email } = req.body;

    // Check if subdomain exists
    const existingTenant = await Tenant.findOne({ subdomain });
    if (existingTenant) {
      return res.status(400).json({ message: "Subdomain already taken" });
    }

    // Generate Passkey
    const setupPasskey = crypto.randomBytes(4).toString("hex").toUpperCase();

    const tenant = new Tenant({
      name,
      subdomain: subdomain.toLowerCase(),
      dbName: `tenant_${subdomain.toLowerCase()}`,
      email,
      setupPasskey,
      isSetupComplete: false,
    });

    const createdTenant = await tenant.save();

    // Send Welcome Email
    try {
      await sendTenantWelcomeEmail(email, name, subdomain, setupPasskey);
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
      // Don't fail the request, just log it.
      // In a production app, we might want to alert admin.
    }

    res.status(201).json({
      ...createdTenant.toObject(),
      // Return passkey so admin can share it (in real app, email it)
      setupPasskey,
    });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update a tenant
// @route   PUT /api/tenants/:id
// @access  Super Admin
const updateTenant = async (req, res) => {
  try {
    const Tenant = getTenantModel();
    const { name, email, isActive } = req.body;

    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    if (name) tenant.name = name;
    if (email) tenant.email = email;
    if (isActive !== undefined) tenant.isActive = isActive;

    const updatedTenant = await tenant.save();
    res.json(updatedTenant);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Generate new passkey for tenant
// @route   POST /api/tenants/:id/passkey
// @access  Super Admin
const generatePasskey = async (req, res) => {
  try {
    const Tenant = getTenantModel();
    const tenant = await Tenant.findById(req.params.id);
    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    const setupPasskey = crypto.randomBytes(4).toString("hex").toUpperCase();
    tenant.setupPasskey = setupPasskey;
    // We might want to reset setupComplete? No, maybe just for re-onboarding?
    // Usually this is for initial lookup if lost.

    await tenant.save();

    // Send Passkey Reset Email
    try {
      const { sendPasskeyResetEmail } = require("../services/emailService");
      await sendPasskeyResetEmail(
        tenant.email,
        tenant.name,
        tenant.subdomain,
        setupPasskey
      );
    } catch (emailError) {
      console.error("Failed to send passkey reset email:", emailError);
      // Continue, as passkey was generated successfully
    }

    res.json({ setupPasskey });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete a tenant
// @route   DELETE /api/tenants/:id
// @access  Super Admin
const deleteTenant = async (req, res) => {
  try {
    const Tenant = getTenantModel();
    const tenant = await Tenant.findByIdAndDelete(req.params.id);

    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    // Note: The actual tenant database (dbName) is intentionally left intact.

    res.json({ message: "Tenant removed" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Resend welcome email to tenant
// @route   POST /api/tenants/:id/resend-welcome
// @access  Super Admin
const resendWelcomeEmail = async (req, res) => {
  try {
    const Tenant = getTenantModel();
    // Need to select setupPasskey explicitly as it's hidden by default
    const tenant = await Tenant.findById(req.params.id).select("+setupPasskey");

    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    if (!tenant.setupPasskey) {
      return res
        .status(400)
        .json({ message: "Tenant has no setup passkey generated" });
    }

    await sendTenantWelcomeEmail(
      tenant.email,
      tenant.name,
      tenant.subdomain,
      tenant.setupPasskey
    );

    res.json({ message: "Welcome email sent successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getTenants,
  getTenantById,
  createTenant,
  updateTenant,
  deleteTenant,
  generatePasskey,
  resendWelcomeEmail,
};
