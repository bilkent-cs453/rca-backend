const express = require('express');
const router = express.Router();
const productsController = require('../controllers/products');

// Mock data for demo
const mockProducts = [
  {
    id: 1,
    name: "Wireless Headphones",
    description: "Premium noise-cancelling wireless headphones with 30-hour battery life",
    price: 299.99,
    image: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500",
    category: "Electronics",
    stock: 50,
    rating: 4.5
  },
  {
    id: 2,
    name: "Smart Watch",
    description: "Fitness tracking smartwatch with heart rate monitor and GPS",
    price: 399.99,
    image: "https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500",
    category: "Electronics",
    stock: 30,
    rating: 4.3
  },
  {
    id: 3,
    name: "Laptop Backpack",
    description: "Water-resistant laptop backpack with USB charging port",
    price: 79.99,
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500",
    category: "Accessories",
    stock: 100,
    rating: 4.7
  },
  {
    id: 4,
    name: "Mechanical Keyboard",
    description: "RGB mechanical gaming keyboard with Cherry MX switches",
    price: 149.99,
    image: "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=500",
    category: "Electronics",
    stock: 25,
    rating: 4.6
  },
  {
    id: 5,
    name: "Portable Speaker",
    description: "Waterproof Bluetooth speaker with 360° sound",
    price: 89.99,
    image: "https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500",
    category: "Electronics",
    stock: 75,
    rating: 4.4
  },
  {
    id: 6,
    name: "Coffee Maker",
    description: "Programmable coffee maker with thermal carafe",
    price: 129.99,
    image: "https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500",
    category: "Home",
    stock: 40,
    rating: 4.2
  },
  {
    id: 7,
    name: "Yoga Mat",
    description: "Non-slip exercise yoga mat with carrying strap",
    price: 39.99,
    image: "https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500",
    category: "Fitness",
    stock: 60,
    rating: 4.8
  },
  {
    id: 8,
    name: "Desk Lamp",
    description: "LED desk lamp with adjustable brightness and color temperature",
    price: 59.99,
    image: "https://images.unsplash.com/photo-1565636192335-6ecd63e18999?w=500",
    category: "Home",
    stock: 35,
    rating: 4.5
  }
];

// Override with mock data for demo
router.get('/', (req, res) => {
  res.json({
    total: mockProducts.length,
    page: 1,
    totalPages: 1,
    products: mockProducts
  });
});

router.get('/trending', productsController.getTrendingProducts);
router.get('/search', productsController.searchProducts);
router.get('/:id', (req, res) => {
  const product = mockProducts.find(p => p.id === parseInt(req.params.id));
  if (product) {
    res.json({ product, recommendations: mockProducts.slice(0, 3) });
  } else {
    res.status(404).json({ error: 'Product not found' });
  }
});
router.post('/', productsController.createProduct);
router.put('/:id', productsController.updateProduct);

module.exports = router;