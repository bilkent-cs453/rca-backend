const { Product, Category, Review, User } = require('../models');
const { sequelize } = require('../config/database');
const { getCache, setCache } = require('../services/cache');
const { broadcastToRoom } = require('../services/websocket');

// Get all products with filters
async function getProducts(req, res) {
  try {
    const { 
      page = 1, 
      limit = 20, 
      category, 
      minPrice, 
      maxPrice, 
      sortBy = 'createdAt',
      order = 'DESC' 
    } = req.query;
    
    const offset = (page - 1) * limit;
    
    // Build query conditions
    const where = {};
    if (category) where.categoryId = category;
    if (minPrice) where.price = { ...where.price, $gte: minPrice };
    if (maxPrice) where.price = { ...where.price, $lte: maxPrice };
    
    const products = await Product.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [[sortBy, order]],
      include: [
        { model: Category, attributes: ['id', 'name'] },
        { model: Review, attributes: ['rating'], limit: 5 }
      ]
    });
    
    res.json({
      total: products.count,
      page: parseInt(page),
      totalPages: Math.ceil(products.count / limit),
      products: products.rows
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
}

// Get single product with recommendations
async function getProductById(req, res) {
  try {
    const { id } = req.params;
    
    // Check cache first
    const cacheKey = `product:${id}`;
    const cached = await getCache(cacheKey);
    if (cached) {
      return res.json(JSON.parse(cached));
    }
    
    // Fetch product with all relations
    const product = await Product.findByPk(id, {
      include: [
        { model: Category },
        { model: Review, include: [{ model: User, attributes: ['name'] }] }
      ]
    });
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    // Get recommendations (N+1 query problem)
    const recommendations = await getRecommendations(product);
    
    const response = {
      product: product.toJSON(),
      recommendations
    };
    
    // Cache the response
    await setCache(cacheKey, JSON.stringify(response), 300); // 5 minutes
    
    res.json(response);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
}

// Get product recommendations - N+1 query issue
async function getRecommendations(product) {
  const Sentry = require('@sentry/node');
  const span = Sentry.startSpan({
    op: 'db.query',
    name: 'Get product recommendations'
  }, () => {});
  
  const recommendations = [];
  
  // Find products in the same category
  const similarProducts = await Product.findAll({
    where: { 
      categoryId: product.categoryId,
      id: { $ne: product.id }
    },
    limit: 10
  });
  
  // Track N+1 query pattern
  let queryCount = 0;
  
  // Problem: Fetching related data in a loop
  for (const similarProduct of similarProducts) {
    queryCount++;
    
    // Each iteration causes a new query
    const reviews = await Review.findAll({
      where: { productId: similarProduct.id },
      attributes: ['rating']
    });
    
    queryCount++;
    const avgRating = reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length || 0;
    
    // Another query for each product
    const category = await Category.findByPk(similarProduct.categoryId);
    queryCount++;
    
    recommendations.push({
      id: similarProduct.id,
      name: similarProduct.name,
      price: similarProduct.price,
      image: similarProduct.image,
      avgRating,
      reviewCount: reviews.length,
      category: category.name
    });
  }
  
  // Alert on N+1 query pattern
  if (queryCount > 15) {
    Sentry.captureMessage('N+1 query pattern detected in recommendations', {
      level: 'warning',
      tags: { 
        issue_type: 'n_plus_one',
        endpoint: 'getRecommendations'
      },
      extra: {
        query_count: queryCount,
        product_count: similarProducts.length
      }
    });
  }
  
  return recommendations;
}

// Create new product
async function createProduct(req, res) {
  const transaction = await sequelize.transaction();
  
  try {
    const productData = req.body;
    
    // Validate required fields
    if (!productData.name || !productData.price) {
      await transaction.rollback();
      return res.status(400).json({ error: 'Name and price are required' });
    }
    
    const product = await Product.create(productData, { transaction });
    
    await transaction.commit();
    
    // Broadcast new product to WebSocket clients
    broadcastToRoom('products', {
      type: 'new_product',
      product: product.toJSON()
    });
    
    res.status(201).json(product);
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating product:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
}

// Update product
async function updateProduct(req, res) {
  const transaction = await sequelize.transaction();
  
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const product = await Product.findByPk(id, { transaction });
    
    if (!product) {
      await transaction.rollback();
      return res.status(404).json({ error: 'Product not found' });
    }
    
    await product.update(updates, { transaction });
    
    await transaction.commit();
    
    // Invalidate cache
    await getCache().del(`product:${id}`);
    
    // Broadcast update
    broadcastToRoom('products', {
      type: 'product_updated',
      productId: id,
      updates
    });
    
    res.json(product);
  } catch (error) {
    await transaction.rollback();
    console.error('Error updating product:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
}

// Search products
async function searchProducts(req, res) {
  try {
    const { q, limit = 20 } = req.query;
    
    if (!q || q.length < 2) {
      return res.status(400).json({ error: 'Search query too short' });
    }
    
    const products = await Product.findAll({
      where: {
        $or: [
          { name: { $iLike: `%${q}%` } },
          { description: { $iLike: `%${q}%` } }
        ]
      },
      limit: parseInt(limit),
      include: [{ model: Category, attributes: ['name'] }]
    });
    
    res.json(products);
  } catch (error) {
    console.error('Error searching products:', error);
    res.status(500).json({ error: 'Search failed' });
  }
}

// Get trending products
async function getTrendingProducts(req, res) {
  try {
    // Complex query to get trending products based on recent orders
    const query = `
      SELECT p.*, COUNT(oi.id) as order_count
      FROM products p
      JOIN order_items oi ON p.id = oi.product_id
      JOIN orders o ON oi.order_id = o.id
      WHERE o.created_at > NOW() - INTERVAL '7 days'
      GROUP BY p.id
      ORDER BY order_count DESC
      LIMIT 10
    `;
    
    const products = await sequelize.query(query, {
      type: sequelize.QueryTypes.SELECT
    });
    
    res.json(products);
  } catch (error) {
    console.error('Error fetching trending products:', error);
    res.status(500).json({ error: 'Failed to fetch trending products' });
  }
}

module.exports = {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  searchProducts,
  getTrendingProducts,
  getRecommendations
};