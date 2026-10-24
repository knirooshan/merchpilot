const { getTenantModels } = require("../models/tenantModels");

// @desc    Get activity logs (with optional search and dynamic pagination)
// @route   GET /api/activity-logs
// @access  Private/Admin
const getLogs = async (req, res) => {
  try {
    const { ActivityLog, User } = getTenantModels(req.dbConnection);
    const { search, page, limit, pageNumber, pageSize } = req.query;

    const currentPage = Math.max(1, Number(page || pageNumber) || 1);
    const perPage = Math.max(1, Number(limit || pageSize) || 15);

    const filter = {};

    if (search && search.trim()) {
      const searchRegex = { $regex: search.trim(), $options: "i" };

      const matchingUsers = await User.find({
        $or: [{ name: searchRegex }, { email: searchRegex }],
      }).select("_id");
      const matchingUserIds = matchingUsers.map((u) => u._id);

      filter.$or = [
        { action: searchRegex },
        { collectionName: searchRegex },
        { user: { $in: matchingUserIds } },
        { ip: searchRegex },
      ];
    }

    const count = await ActivityLog.countDocuments(filter);
    const logs = await ActivityLog.find(filter)
      .populate("user", "name email")
      .sort({ createdAt: -1 })
      .limit(perPage)
      .skip(perPage * (currentPage - 1));

    res.json({
      logs,
      data: logs,
      total: count,
      page: currentPage,
      pages: Math.ceil(count / perPage),
      limit: perPage,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getLogs };
