const { getTenantModels } = require("../models/tenantModels");
const { getWooProducts } = require("../services/wooService");
const { pushProduct } = require("../services/medusaService");

// Helper: generate a URL-safe slug from a string (WordPress-style)
const slugify = (str) =>
  str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

// Helper: extract all Medusa-compatible fields from a request body
const extractProductFields = (body) => {
  const {
    name,
    handle,
    subtitle,
    sku,
    price,
    regularPrice,
    salePrice,
    costPrice,
    stockQuantity,
    images,
    thumbnail,
    categories,
    description,
    shortDescription,
    status,
    discountable,
    isGiftcard,
    weight,
    length,
    height,
    width,
    hsCode,
    midCode,
    originCountry,
    material,
    tags,
    type,
    collection,
    options,
    variants,
    metadata,
    externalId,
    medusaId,
    syncToMedusa,
  } = body;

  return {
    name,
    handle,
    subtitle,
    sku,
    price,
    regularPrice,
    salePrice,
    costPrice,
    stockQuantity,
    images,
    thumbnail,
    categories,
    description,
    shortDescription,
    status,
    discountable,
    isGiftcard,
    weight,
    length,
    height,
    width,
    hsCode,
    midCode,
    originCountry,
    material,
    tags,
    type,
    collection,
    options,
    variants,
    metadata,
    externalId,
    medusaId,
    syncToMedusa,
  };
};

// @desc    Get all products (with optional server-side search, filter, and pagination)
// @route   GET /api/products
// @access  Private
const getProducts = async (req, res) => {
  try {
    const { Product } = getTenantModels(req.dbConnection);
    const {
      search,
      status,
      sortBy,
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
        { sku: searchRegex },
        { description: searchRegex },
        { handle: searchRegex },
      ];
    }

    if (status && status !== "all") {
      filter.status = status;
    }

    let sort = { createdAt: -1 };
    if (sortBy) {
      switch (sortBy) {
        case "name_asc":
          sort = { name: 1 };
          break;
        case "name_desc":
          sort = { name: -1 };
          break;
        case "price_asc":
          sort = { price: 1 };
          break;
        case "price_desc":
          sort = { price: -1 };
          break;
        case "createdAt_asc":
          sort = { createdAt: 1 };
          break;
        case "createdAt_desc":
        default:
          sort = { createdAt: -1 };
          break;
      }
    }

    if (!isPaginated) {
      const products = await Product.find(filter).sort(sort);
      return res.json(products);
    }

    const currentPage = Math.max(1, Number(page || pageNumber) || 1);
    const perPage = Math.max(1, Number(limit || pageSize) || 15);

    const total = await Product.countDocuments(filter);
    const products = await Product.find(filter)
      .sort(sort)
      .limit(perPage)
      .skip((currentPage - 1) * perPage);

    res.json({
      data: products,
      total,
      page: currentPage,
      pages: Math.ceil(total / perPage),
      limit: perPage,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Sync products from WooCommerce
// @route   POST /api/products/sync
// @access  Private/Admin
const syncProducts = async (req, res) => {
  try {
    const { Product, Settings } = getTenantModels(req.dbConnection);

    // Check feature toggle
    const settings = await Settings.findOne();
    if (
      settings &&
      settings.modules &&
      settings.modules.woocommerce === false
    ) {
      return res.status(403).json({ message: "WooCommerce sync disabled" });
    }
    let page = 1;
    let wooProducts = [];

    // Loop to fetch all products from WooCommerce
    while (true) {
      const products = await getWooProducts(settings, page, 100);
      if (!products || products.length === 0) break;
      wooProducts = [...wooProducts, ...products];
      page++;
    }

    const syncedProducts = [];

    for (const p of wooProducts) {
      // Build per-variant data from WooCommerce attributes/variations if present
      const variants = (p.variations || []).map((v, idx) => ({
        title: v.attributes
          ? v.attributes.map((a) => a.option).join(" / ")
          : `Variant ${idx + 1}`,
        sku: v.sku || "",
        price: v.price ? parseFloat(v.price) : undefined,
        regularPrice: v.regular_price ? parseFloat(v.regular_price) : undefined,
        salePrice: v.sale_price ? parseFloat(v.sale_price) : undefined,
        stockQuantity: v.stock_quantity || 0,
        weight: v.weight ? parseFloat(v.weight) : undefined,
        length: v.dimensions ? parseFloat(v.dimensions.length) : undefined,
        height: v.dimensions ? parseFloat(v.dimensions.height) : undefined,
        width: v.dimensions ? parseFloat(v.dimensions.width) : undefined,
        images: v.image ? [v.image.src] : [],
        options: v.attributes
          ? v.attributes.reduce((acc, a) => {
            acc[a.name] = a.option;
            return acc;
          }, {})
          : {},
        manageInventory: v.manage_stock || false,
        allowBackorder: v.backorders_allowed || false,
        variantRank: idx,
      }));

      // Build product-level options from WooCommerce attributes
      const options = (p.attributes || []).map((attr) => ({
        title: attr.name,
        values: attr.options || [],
      }));

      const productData = {
        wooId: p.id,
        name: p.name,
        handle: p.slug,
        sku: p.sku,
        price: p.price ? parseFloat(p.price) : 0,
        regularPrice: p.regular_price ? parseFloat(p.regular_price) : 0,
        salePrice: p.sale_price ? parseFloat(p.sale_price) : 0,
        stockQuantity: p.stock_quantity || 0,
        images: (p.images || []).map((img) => img.src),
        thumbnail: p.images && p.images[0] ? p.images[0].src : undefined,
        categories: (p.categories || []).map((cat) => ({
          id: cat.id,
          name: cat.name,
          slug: cat.slug,
        })),
        tags: (p.tags || []).map((t) => ({ value: t.name })),
        description: p.description,
        shortDescription: p.short_description,
        status: p.status,
        // Shipping dimensions from WooCommerce
        weight: p.weight ? parseFloat(p.weight) : undefined,
        length: p.dimensions ? parseFloat(p.dimensions.length) : undefined,
        height: p.dimensions ? parseFloat(p.dimensions.height) : undefined,
        width: p.dimensions ? parseFloat(p.dimensions.width) : undefined,
        options,
        variants,
      };

      const product = await Product.findOneAndUpdate(
        { wooId: p.id },
        productData,
        { new: true, upsert: true },
      );
      syncedProducts.push(product);
    }

    res.json({
      message: `Synced ${syncedProducts.length} products`,
      products: syncedProducts,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create a product
// @route   POST /api/products
// @access  Private/Admin
const createProduct = async (req, res) => {
  try {
    const { Product } = getTenantModels(req.dbConnection);

    // Generate wooId for manually created products using timestamp
    const now = new Date();
    const wooId = parseInt(
      now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, "0") +
      now.getDate().toString().padStart(2, "0") +
      now.getHours().toString().padStart(2, "0") +
      now.getMinutes().toString().padStart(2, "0") +
      now.getSeconds().toString().padStart(2, "0"),
    );

    const productData = { wooId, ...extractProductFields(req.body) };

    // Auto-generate handle from name if not provided
    if (!productData.handle && productData.name) {
      productData.handle = slugify(productData.name);
    }

    const product = new Product(productData);
    const createdProduct = await product.save();
    res.status(201).json(createdProduct);
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(400).json({ message: error.message });
  }
};

// @desc    Update a product
// @route   PUT /api/products/:id
// @access  Private/Admin
const updateProduct = async (req, res) => {
  try {
    const { Product } = getTenantModels(req.dbConnection);

    const product = await Product.findById(req.params.id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    const fields = extractProductFields(req.body);

    // Apply each field only when explicitly provided (undefined = not sent)
    Object.entries(fields).forEach(([key, value]) => {
      if (value !== undefined) {
        product[key] = value;
      }
    });

    const updatedProduct = await product.save();
    res.json(updatedProduct);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// @desc    Delete a product
// @route   DELETE /api/products/:id
// @access  Private/Admin
const deleteProduct = async (req, res) => {
  try {
    const { Product } = getTenantModels(req.dbConnection);
    const product = await Product.findById(req.params.id);

    if (product) {
      await product.deleteOne();
      res.json({ message: "Product removed" });
    } else {
      res.status(404).json({ message: "Product not found" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getProducts,
  syncProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  pushToMedusa,
  pushAllToMedusa,
  toggleMedusaSync,
};

// ─── Toggle syncToMedusa flag ──────────────────────────────────────────────
// @desc    Toggle whether a product is included in Medusa bulk-push
// @route   PATCH /api/products/:id/toggle-medusa-sync
// @access  Private/Admin
async function toggleMedusaSync(req, res) {
  try {
    const { Product } = getTenantModels(req.dbConnection);
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    product.syncToMedusa = !product.syncToMedusa;
    await product.save();

    res.json({ syncToMedusa: product.syncToMedusa });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

// ─── Medusa push: single product ──────────────────────────────────────────
// @desc    Push a single product to Medusa (create or update)
// @route   POST /api/products/:id/push-medusa
// @access  Private/Admin
async function pushToMedusa(req, res) {
  try {
    const { Product, Settings } = getTenantModels(req.dbConnection);

    const settings = await Settings.findOne();
    if (!settings?.medusa?.url || !settings?.medusa?.apiKey) {
      return res
        .status(400)
        .json({ message: "Medusa credentials not configured in Settings" });
    }
    if (settings?.modules?.medusaSync === false) {
      return res.status(403).json({ message: "Medusa sync is disabled" });
    }

    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const { medusaId, medusaVariantIds } = await pushProduct(
      product,
      settings.medusa,
    );

    // Persist the Medusa ID back on the product
    product.medusaId = medusaId;
    // Update each variant's medusaVariantId
    if (product.variants?.length) {
      product.variants.forEach((v) => {
        if (medusaVariantIds[v.title]) {
          v.medusaVariantId = medusaVariantIds[v.title];
        }
      });
    }
    await product.save();

    res.json({
      message: "Product pushed to Medusa",
      medusaId,
      medusaVariantIds,
    });
  } catch (error) {
    console.error("Medusa push error:", error.response?.data || error.message);
    res
      .status(500)
      .json({ message: error.response?.data?.message || error.message });
  }
}

// ─── Medusa push: all products ─────────────────────────────────────────────
// @desc    Push ALL products to Medusa
// @route   POST /api/products/push-medusa-all
// @access  Private/Admin
async function pushAllToMedusa(req, res) {
  try {
    const { Product, Settings } = getTenantModels(req.dbConnection);

    const settings = await Settings.findOne();
    if (!settings?.medusa?.url || !settings?.medusa?.apiKey) {
      return res
        .status(400)
        .json({ message: "Medusa credentials not configured in Settings" });
    }
    if (settings?.modules?.medusaSync === false) {
      return res.status(403).json({ message: "Medusa sync is disabled" });
    }

    const products = await Product.find({ syncToMedusa: true });
    if (products.length === 0) {
      return res.json({
        message:
          "No products are marked for Medusa sync. Enable sync on individual products first.",
        pushed: 0,
        failed: 0,
        errors: [],
      });
    }
    const results = { pushed: 0, failed: 0, errors: [] };

    for (const product of products) {
      try {
        const { medusaId, medusaVariantIds } = await pushProduct(
          product,
          settings.medusa,
        );
        product.medusaId = medusaId;
        if (product.variants?.length) {
          product.variants.forEach((v) => {
            if (medusaVariantIds[v.title])
              v.medusaVariantId = medusaVariantIds[v.title];
          });
        }
        await product.save();
        results.pushed++;
      } catch (err) {
        results.failed++;
        results.errors.push({
          product: product.name,
          error: err.response?.data?.message || err.message,
        });
      }
    }

    res.json({
      message: `Pushed ${results.pushed} products to Medusa, ${results.failed} failed`,
      ...results,
    });
  } catch (error) {
    console.error("Medusa bulk push error:", error);
    res.status(500).json({ message: error.message });
  }
}
